import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, RefreshCw, RotateCcw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { emitAssistantHint } from '@/utils/assistant'
import { api } from '@/api/service'
import { attemptStatusMeta, examTypeLabel, typeLabel } from '@/constants'
import { displayedSeconds, examDeadline } from '@/utils/examClock'
import {
  clearAttemptEssayDrafts,
  clearEssayDraft,
  loadAttemptEssayDrafts,
  saveEssayDraft,
} from '@/utils/essayDraftStorage'
import {
  classifyAttemptStatus,
  isAttemptCancelledError,
  isAttemptClosedError,
  isCancelledAttemptStatus,
  isInProgressAttemptStatus,
  isSubmittedAttemptStatus,
} from '@/utils/examAttemptStatus'
import type {
  ApiErrorShape,
  AttemptResultResponse,
  PaperQuestionItem,
  StartExamAttemptResponse,
  StudentExamDetail,
} from '@/types/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmModal, EmptyState, ErrorState, LoadingState } from '@/components/common/StateFeedback'
import { cn } from '@/lib/utils'

interface DraftAnswer {
  selectedAnswerIds: string[]
  essayAnswer: string
}

type AnswersMap = Record<string, DraftAnswer>

interface QuestionSaveState {
  status: 'saving' | 'saved' | 'error'
  message?: string
}

interface PendingSaveEntry {
  answer: DraftAnswer
  revision: number
}

interface LocationState {
  attemptId?: string
}

const blankAnswer = (): DraftAnswer => ({ selectedAnswerIds: [], essayAnswer: '' })

function cloneAnswersMap(source: AnswersMap | null | undefined): AnswersMap {
  return Object.fromEntries(
    Object.entries(source || {}).map(([qId, ans]) => [
      qId,
      {
        selectedAnswerIds: [...(ans?.selectedAnswerIds || [])],
        essayAnswer: ans?.essayAnswer ?? '',
      },
    ])
  )
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as ApiErrorShape).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const err = error as ApiErrorShape
  return err.status ?? err.response?.status
}

function summarizeConfirmedAnswer(question: PaperQuestionItem, confirmed?: DraftAnswer): string {
  if (!confirmed) return 'Chưa có câu trả lời nào được lưu trên máy chủ.'
  if (question.type === 'ESSAY') {
    const text = (confirmed.essayAnswer || '').trim()
    if (!text) return 'Chưa có nội dung tự luận nào được lưu trên máy chủ.'
    return text.length > 140 ? `${text.slice(0, 140)}…` : text
  }
  const selectedIds = confirmed.selectedAnswerIds || []
  if (!selectedIds.length) return 'Chưa có đáp án nào được lưu trên máy chủ.'
  const labels = selectedIds
    .map((id) => {
      const idx = (question.answers || []).findIndex((ans) => ans.id === id)
      return idx >= 0 ? String.fromCharCode(65 + idx) : null
    })
    .filter((label): label is string => Boolean(label))
  return labels.length
    ? `Đáp án đã xác nhận gần nhất trên máy chủ: ${labels.join(', ')}`
    : `Đã lưu ${selectedIds.length} phương án trên máy chủ.`
}

export default function StudentExamTakingPage() {
  const auth = useAuth() as { user?: { id?: string } | null } | null
  const currentUserId = auth?.user?.id ? String(auth.user.id) : ''
  const { paperId } = useParams<{ paperId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const forceNew = searchParams.get('forceNew') === '1'
  const navigate = useNavigate()
  const locationState = (useLocation().state as LocationState | null) ?? null
  const knownAttemptId = locationState?.attemptId
  const queryClient = useQueryClient()

  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [attemptStatus, setAttemptStatus] = useState<string>('IN_PROGRESS')
  const [answers, setAnswers] = useState<AnswersMap>({})
  const [confirmedAnswers, setConfirmedAnswers] = useState<AnswersMap>({})
  const [questionSaveStates, setQuestionSaveStates] = useState<Record<string, QuestionSaveState>>({})
  const [dirtyQuestions, setDirtyQuestions] = useState<Record<string, boolean>>({})
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sessionError, setSessionError] = useState<unknown>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [timeoutSyncError, setTimeoutSyncError] = useState<string | null>(null)
  const [unknownStatusNotice, setUnknownStatusNotice] = useState<string | null>(null)
  const [isRecheckingStatus, setIsRecheckingStatus] = useState(false)

  const initStartedRef = useRef(false)
  const attemptStatusRef = useRef<string>('IN_PROGRESS')
  const answerStateRef = useRef<AnswersMap>({})
  const confirmedAnswersRef = useRef<AnswersMap>({})
  const answerRevisionRef = useRef<Record<string, number>>({})
  const confirmedRevisionRef = useRef<Record<string, number>>({})
  const deadlineRef = useRef<number | null>(null)
  const pendingSavesRef = useRef<Map<string, PendingSaveEntry>>(new Map())
  const flushPromiseRef = useRef<Promise<void> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSubmitTriggeredRef = useRef(false)
  const timerSyncInFlightRef = useRef(false)
  const submitInFlightRef = useRef(false)

  const updateAttemptStatus = useCallback((nextStatus: string) => {
    attemptStatusRef.current = nextStatus
    setAttemptStatus(nextStatus)
  }, [])

  const paperQuery = useQuery<StudentExamDetail>({
    queryKey: ['student', 'exam-paper', paperId],
    queryFn: () => api.getStudentExam(paperId as string) as Promise<StudentExamDetail>,
    enabled: Boolean(paperId),
  })

  const cancelAllPendingRetries = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    pendingSavesRef.current.clear()
  }, [])

  const lockAsCancelled = useCallback(
    (
      snapshot: AttemptResultResponse | null = null,
      message = 'Lượt làm đã bị hủy. Bạn không thể tiếp tục chỉnh sửa hay nộp bài.'
    ) => {
      cancelAllPendingRetries()
      deadlineRef.current = null
      setTimeLeft(null)
      autoSubmitTriggeredRef.current = true
      setShowSubmitModal(false)
      setTimeoutSyncError(null)
      setUnknownStatusNotice(null)
      updateAttemptStatus('CANCELLED')
      setDirtyQuestions({})
      if (currentUserId && (snapshot?.attemptId || attemptId)) {
        clearAttemptEssayDrafts(currentUserId, snapshot?.attemptId || (attemptId as string))
      }
      if (snapshot) {
        const hydrated: AnswersMap = {}
        for (const question of paperQuery.data?.questions || []) {
          hydrated[question.id] = blankAnswer()
        }
        for (const answer of snapshot.answers || []) {
          hydrated[answer.questionId] = {
            selectedAnswerIds: [...(answer.selectedAnswerIds || [])],
            essayAnswer: answer.essayAnswer ?? '',
          }
        }
        confirmedAnswersRef.current = cloneAnswersMap(hydrated)
        setConfirmedAnswers(cloneAnswersMap(hydrated))
        answerStateRef.current = cloneAnswersMap(hydrated)
        setAnswers(cloneAnswersMap(hydrated))
      }
      setQuestionSaveStates((prev) => {
        const next: Record<string, QuestionSaveState> = { ...prev }
        for (const key of Object.keys(next)) {
          if (next[key]?.status === 'saving' || next[key]?.status === 'error') {
            next[key] = { status: 'saved' }
          }
        }
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['student', 'exams'] })
      toast.error(message)
      emitAssistantHint({
        title: 'Lượt làm đã bị hủy',
        message,
        tone: 'error',
      })
    },
    [attemptId, cancelAllPendingRetries, currentUserId, paperQuery.data?.questions, queryClient, updateAttemptStatus]
  )

  const applyServerResultSnapshot = useCallback(
    (result: AttemptResultResponse | null | undefined) => {
      if (!result) return
      const targetAttemptId = result.attemptId || attemptId || ''
      const hydrated: AnswersMap = {}
      for (const question of paperQuery.data?.questions || []) {
        hydrated[question.id] = blankAnswer()
        answerRevisionRef.current[question.id] = (answerRevisionRef.current[question.id] || 0) + 1
        confirmedRevisionRef.current[question.id] = answerRevisionRef.current[question.id]
      }
      for (const answer of result.answers || []) {
        hydrated[answer.questionId] = {
          selectedAnswerIds: [...(answer.selectedAnswerIds || [])],
          essayAnswer: answer.essayAnswer ?? '',
        }
      }
      confirmedAnswersRef.current = cloneAnswersMap(hydrated)
      setConfirmedAnswers(cloneAnswersMap(hydrated))
      cancelAllPendingRetries()

      const nextStates: Record<string, QuestionSaveState> = {}
      for (const question of paperQuery.data?.questions || []) {
        nextStates[question.id] = { status: 'saved' }
      }
      const nextDirty: Record<string, boolean> = {}

      const outcome = classifyAttemptStatus(result.status)
      if (outcome === 'IN_PROGRESS' && currentUserId && targetAttemptId) {
        const storedDrafts = loadAttemptEssayDrafts(currentUserId, targetAttemptId)
        for (const question of paperQuery.data?.questions || []) {
          if (question.type !== 'ESSAY') continue
          const draft = storedDrafts[question.id]
          if (!draft) continue
          const serverText = hydrated[question.id]?.essayAnswer ?? ''
          if (draft.text !== serverText) {
            hydrated[question.id] = { selectedAnswerIds: [], essayAnswer: draft.text }
            const nextRev = (answerRevisionRef.current[question.id] || 0) + 1
            answerRevisionRef.current[question.id] = nextRev
            pendingSavesRef.current.set(question.id, { answer: hydrated[question.id], revision: nextRev })
            nextDirty[question.id] = true
            nextStates[question.id] = {
              status: 'error',
              message: 'Đã khôi phục bản nháp chưa lưu lên máy chủ — bấm Lưu lại để gửi.',
            }
          } else {
            clearEssayDraft(currentUserId, targetAttemptId, question.id)
          }
        }
      } else if (currentUserId && targetAttemptId) {
        clearAttemptEssayDrafts(currentUserId, targetAttemptId)
      }

      answerStateRef.current = cloneAnswersMap(hydrated)
      setAnswers(cloneAnswersMap(hydrated))
      setDirtyQuestions(nextDirty)
      if (result.status) {
        updateAttemptStatus(result.status)
      }
      setQuestionSaveStates(nextStates)
    },
    [attemptId, cancelAllPendingRetries, currentUserId, paperQuery.data?.questions, updateAttemptStatus]
  )

  const syncAttemptStatusFromBackend = useCallback(
    async (targetAttemptId: string | null = attemptId): Promise<AttemptResultResponse | null> => {
      if (!targetAttemptId) return null
      const latest = (await api.getAttemptResult(targetAttemptId)) as AttemptResultResponse
      const outcome = classifyAttemptStatus(latest?.status)
      if (outcome === 'CANCELLED') {
        lockAsCancelled(latest)
        return latest
      }
      if (outcome === 'SUBMITTED') {
        applyServerResultSnapshot(latest)
        setTimeoutSyncError(null)
        setUnknownStatusNotice(null)
        deadlineRef.current = null
        queryClient.invalidateQueries({ queryKey: ['student', 'exams'] })
        return latest
      }
      if (outcome === 'UNKNOWN') {
        setUnknownStatusNotice(
          `Máy chủ trả trạng thái không xác định (${latest?.status || 'trống'}). Vui lòng kiểm tra lại trạng thái lượt thi.`
        )
        return latest
      }
      setUnknownStatusNotice(null)
      return latest
    },
    [applyServerResultSnapshot, attemptId, lockAsCancelled, queryClient]
  )

  const handleManualStatusRecheck = useCallback(async () => {
    if (!attemptId || isRecheckingStatus) return
    setIsRecheckingStatus(true)
    try {
      const latest = await syncAttemptStatusFromBackend(attemptId)
      const outcome = classifyAttemptStatus(latest?.status)
      if (outcome === 'SUBMITTED') {
        toast.success('Xác nhận bài thi đã được nộp trên máy chủ.')
        navigate(`/hoc-sinh/ket-qua/${latest?.attemptId || attemptId}`, { replace: true })
      } else if (outcome === 'IN_PROGRESS') {
        updateAttemptStatus('IN_PROGRESS')
        toast.info('Lượt làm bài vẫn đang mở. Bạn có thể tiếp tục làm hoặc nộp bài.')
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Chưa thể kiểm tra lại trạng thái lúc này.'))
    } finally {
      setIsRecheckingStatus(false)
    }
  }, [attemptId, isRecheckingStatus, navigate, syncAttemptStatusFromBackend, updateAttemptStatus])

  const flushPendingAnswers = useCallback(
    async (silent = false): Promise<void> => {
      if (!attemptId) throw new Error('Lượt làm bài chưa sẵn sàng để lưu câu trả lời.')
      if (isCancelledAttemptStatus(attemptStatusRef.current)) {
        cancelAllPendingRetries()
        return
      }
      if (flushPromiseRef.current) {
        await flushPromiseRef.current
        if (pendingSavesRef.current.size > 0 && isInProgressAttemptStatus(attemptStatusRef.current)) {
          return flushPendingAnswers(silent)
        }
        return
      }

      const flushPromise = (async () => {
        const entries = Array.from(pendingSavesRef.current.entries())
        for (const [questionId] of entries) {
          pendingSavesRef.current.delete(questionId)
        }

        let firstError: unknown = null
        let closedOnServer = false
        let cancelledOnServer = false

        for (const [questionId, entry] of entries) {
          const payload = entry.answer
          const revision = entry.revision ?? (answerRevisionRef.current[questionId] || 0)
          if (!silent) {
            setQuestionSaveStates((prev) => ({
              ...prev,
              [questionId]: { status: 'saving' },
            }))
          }
          try {
            await api.saveAttemptAnswer(attemptId, {
              questionId,
              selectedAnswerIds: payload.selectedAnswerIds || [],
              essayAnswer: payload.essayAnswer ?? null,
            })
            const savedCopy: DraftAnswer = {
              selectedAnswerIds: [...(payload.selectedAnswerIds || [])],
              essayAnswer: payload.essayAnswer ?? '',
            }
            const latestConfirmedRev = confirmedRevisionRef.current[questionId] || 0
            if (revision >= latestConfirmedRev) {
              confirmedRevisionRef.current[questionId] = revision
              confirmedAnswersRef.current = {
                ...confirmedAnswersRef.current,
                [questionId]: savedCopy,
              }
              if (!silent) {
                setConfirmedAnswers((prev) => ({ ...prev, [questionId]: savedCopy }))
              }
            }
            const currentLocalRev = answerRevisionRef.current[questionId] || 0
            if (revision >= currentLocalRev) {
              if (currentUserId && attemptId) {
                clearEssayDraft(currentUserId, attemptId, questionId)
              }
              setDirtyQuestions((prev) => {
                if (!prev[questionId]) return prev
                const next = { ...prev }
                delete next[questionId]
                return next
              })
            }
            if (!silent && revision === currentLocalRev && !pendingSavesRef.current.has(questionId)) {
              setQuestionSaveStates((prev) => ({
                ...prev,
                [questionId]: { status: 'saved' },
              }))
            }
          } catch (error) {
            const currentLocalRev = answerRevisionRef.current[questionId] || 0
            const hasNewerAnswer = pendingSavesRef.current.has(questionId) || currentLocalRev > revision
            const errMessage = getErrorMessage(error, 'Chưa lưu được lên máy chủ')
            if (isAttemptCancelledError(error)) {
              cancelledOnServer = true
              closedOnServer = true
            } else if (isAttemptClosedError(error)) {
              closedOnServer = true
            }
            if (!hasNewerAnswer && !closedOnServer) {
              pendingSavesRef.current.set(questionId, { answer: payload, revision })
            }
            if ((!hasNewerAnswer || closedOnServer) && !firstError) firstError = error
            if (!silent && !hasNewerAnswer && !cancelledOnServer) {
              setQuestionSaveStates((prev) => ({
                ...prev,
                [questionId]: { status: 'error', message: errMessage },
              }))
            }
            if (closedOnServer) break
          }
        }

        if (closedOnServer) {
          cancelAllPendingRetries()
          if (!silent) {
            const synced = await syncAttemptStatusFromBackend(attemptId).catch(() => null)
            const outcome = classifyAttemptStatus(synced?.status)
            if (outcome === 'CANCELLED') {
              return
            }
            if (outcome === 'SUBMITTED') {
              toast.warning('Bài thi đã được nộp hoặc hết giờ trên máy chủ. Đã đồng bộ trạng thái thực tế.')
              return
            }
            if (cancelledOnServer) {
              lockAsCancelled(null)
              return
            }
          }
        }

        if (firstError) {
          throw firstError
        }
      })()

      flushPromiseRef.current = flushPromise
      try {
        await flushPromise
      } finally {
        if (flushPromiseRef.current === flushPromise) flushPromiseRef.current = null
      }
      if (pendingSavesRef.current.size > 0 && isInProgressAttemptStatus(attemptStatusRef.current)) {
        return flushPendingAnswers(silent)
      }
    },
    [attemptId, cancelAllPendingRetries, currentUserId, lockAsCancelled, syncAttemptStatusFromBackend]
  )

  const { mutate: submit, isPending: isSubmitting, isError: submitFailed } = useMutation<AttemptResultResponse | null>({
    mutationFn: async () => {
      try {
        await flushPendingAnswers()
      } catch (flushError) {
        const latest = await syncAttemptStatusFromBackend(attemptId).catch(() => null)
        const outcome = classifyAttemptStatus(latest?.status)
        if (outcome === 'SUBMITTED' || outcome === 'CANCELLED') {
          return latest
        }
        throw flushError
      }
      return api.submitExamAttempt(attemptId as string) as Promise<AttemptResultResponse>
    },
    onSuccess: (result) => {
      const outcome = classifyAttemptStatus(result?.status)
      if (outcome === 'SUBMITTED' && result) {
        setTimeoutSyncError(null)
        setUnknownStatusNotice(null)
        updateAttemptStatus(result.status)
        deadlineRef.current = null
        cancelAllPendingRetries()
        setDirtyQuestions({})
        if (currentUserId && (result.attemptId || attemptId)) {
          clearAttemptEssayDrafts(currentUserId, result.attemptId || (attemptId as string))
        }
        queryClient.invalidateQueries({ queryKey: ['student', 'exams'] })
        toast.success('Đã nộp bài thi')
        emitAssistantHint({
          title: 'Đã nộp bài thi',
          message: 'Bạn có thể xem kết quả. Nếu bài có câu tự luận, điểm cuối cùng sẽ hiện sau khi giáo viên chấm.',
          tone: 'success',
        })
        navigate(`/hoc-sinh/ket-qua/${result.attemptId || attemptId}`, { replace: true })
        return
      }
      if (outcome === 'CANCELLED') {
        lockAsCancelled(result)
        return
      }
      setShowSubmitModal(false)
      setUnknownStatusNotice(
        `Chưa xác nhận được trạng thái nộp bài từ máy chủ (${result?.status || 'không rõ'}). Vui lòng bấm “Kiểm tra lại trạng thái”.`
      )
      toast.warning('Chưa xác nhận được trạng thái nộp bài. Vui lòng kiểm tra lại trạng thái.')
    },
    onError: async (error) => {
      const synced = await syncAttemptStatusFromBackend(attemptId).catch(() => null)
      const outcome = classifyAttemptStatus(synced?.status)
      if (outcome === 'SUBMITTED') {
        toast.info('Bài thi đã được ghi nhận nộp trên máy chủ.')
        navigate(`/hoc-sinh/ket-qua/${synced?.attemptId || attemptId}`, { replace: true })
        return
      }
      if (outcome === 'CANCELLED') {
        return
      }
      if (isAttemptCancelledError(error)) {
        lockAsCancelled(null)
        return
      }
      const message = getErrorMessage(error, 'Không thể nộp bài thi')
      if (getErrorStatus(error) === 409) {
        setUnknownStatusNotice(
          `Máy chủ từ chối nộp bài (${message}). Vui lòng kiểm tra lại trạng thái lượt thi.`
        )
      }
      if (timeLeft === 0) {
        setTimeoutSyncError(message)
      }
      toast.error(message)
      emitAssistantHint({
        title: 'Bài thi chưa được nộp',
        message: `${message} Kết nối lại rồi kiểm tra trạng thái lưu câu trả lời trước khi thử nộp lại.`,
        tone: 'error',
      })
    },
    onSettled: () => {
      submitInFlightRef.current = false
    },
  })

  const requestSubmit = useCallback(() => {
    if (submitInFlightRef.current || !isInProgressAttemptStatus(attemptStatus)) return
    submitInFlightRef.current = true
    submit()
  }, [attemptStatus, submit])

  const initializeAttempt = useCallback(async () => {
    setSessionStatus('loading')
    setSessionError(null)
    setUnknownStatusNotice(null)
    try {
      const started = (await api.startExamAttempt(
        paperId as string,
        forceNew ? { forceNew: true } : undefined
      )) as StartExamAttemptResponse
      if (forceNew) {
        setSearchParams({}, { replace: true })
      }
      const deadline = examDeadline(started?.remainingSeconds, performance.now())
      if (!started?.attemptId) throw new Error('Máy chủ không trả mã lượt làm bài.')
      const result = (await api.getAttemptResult(started.attemptId)) as AttemptResultResponse
      const outcome = classifyAttemptStatus(result?.status || started?.status)
      if (outcome === 'SUBMITTED') {
        navigate(`/hoc-sinh/ket-qua/${started.attemptId}`, { replace: true })
        return
      }
      if (outcome === 'CANCELLED') {
        setAttemptId(started.attemptId)
        applyServerResultSnapshot(result)
        updateAttemptStatus('CANCELLED')
        deadlineRef.current = null
        setTimeLeft(null)
        setSessionStatus('ready')
        return
      }
      if (outcome === 'UNKNOWN') {
        setAttemptId(started.attemptId)
        updateAttemptStatus('UNKNOWN')
        setUnknownStatusNotice(
          `Máy chủ trả trạng thái lượt thi không xác định (${result?.status || started?.status || 'trống'}). Vui lòng kiểm tra lại trạng thái.`
        )
        setSessionStatus('ready')
        return
      }

      applyServerResultSnapshot(result)
      setAttemptId(started.attemptId)
      updateAttemptStatus('IN_PROGRESS')
      deadlineRef.current = deadline
      setTimeLeft(displayedSeconds(deadline, performance.now()))
      setSessionStatus('ready')
    } catch (error) {
      if (getErrorStatus(error) === 409 && knownAttemptId) {
        const latest = (await api.getAttemptResult(knownAttemptId).catch(() => null)) as AttemptResultResponse | null
        const outcome = classifyAttemptStatus(latest?.status)
        if (latest?.paperId === paperId && outcome === 'SUBMITTED') {
          navigate(`/hoc-sinh/ket-qua/${knownAttemptId}`, { replace: true })
          return
        }
        if (latest?.paperId === paperId && outcome === 'CANCELLED') {
          setAttemptId(knownAttemptId)
          applyServerResultSnapshot(latest)
          updateAttemptStatus('CANCELLED')
          deadlineRef.current = null
          setTimeLeft(null)
          setSessionStatus('ready')
          return
        }
        if (latest?.paperId === paperId && outcome === 'UNKNOWN') {
          setAttemptId(knownAttemptId)
          updateAttemptStatus('UNKNOWN')
          setUnknownStatusNotice(
            `Máy chủ trả trạng thái lượt thi không xác định (${latest?.status || 'trống'}). Vui lòng kiểm tra lại trạng thái.`
          )
          deadlineRef.current = null
          setTimeLeft(null)
          setSessionStatus('ready')
          return
        }
      }
      if (isAttemptCancelledError(error)) {
        cancelAllPendingRetries()
        updateAttemptStatus('CANCELLED')
        deadlineRef.current = null
        setTimeLeft(null)
        setSessionStatus('ready')
        return
      }
      setSessionError(error)
      setSessionStatus('error')
    }
  }, [applyServerResultSnapshot, cancelAllPendingRetries, forceNew, knownAttemptId, navigate, paperId, setSearchParams, updateAttemptStatus])

  const syncServerTimer = useCallback(async () => {
    if (!attemptId || timerSyncInFlightRef.current || submitInFlightRef.current || !isInProgressAttemptStatus(attemptStatusRef.current)) return
    timerSyncInFlightRef.current = true
    try {
      const started = (await api.startExamAttempt(
        paperId as string,
        forceNew ? { forceNew: true } : undefined
      )) as StartExamAttemptResponse
      if (forceNew) {
        setSearchParams({}, { replace: true })
      }
      if (started?.attemptId !== attemptId) throw new Error('Mã lượt làm bài đã thay đổi.')
      if (submitInFlightRef.current) return
      const outcome = classifyAttemptStatus(started?.status)
      if (outcome === 'CANCELLED') {
        lockAsCancelled(null)
        return
      }
      if (outcome === 'SUBMITTED') {
        const latestAttempt = await syncAttemptStatusFromBackend(attemptId).catch(() => null)
        if (isSubmittedAttemptStatus(latestAttempt?.status)) {
          navigate(`/hoc-sinh/ket-qua/${attemptId}`, { replace: true })
        }
        return
      }
      if (outcome === 'UNKNOWN') {
        setUnknownStatusNotice(
          `Máy chủ trả trạng thái lượt thi không xác định (${started?.status || 'trống'}). Vui lòng kiểm tra lại trạng thái.`
        )
        return
      }
      const now = performance.now()
      deadlineRef.current = examDeadline(started.remainingSeconds, now)
      setTimeLeft(displayedSeconds(deadlineRef.current, now))
    } catch (error) {
      try {
        const latestAttempt = await syncAttemptStatusFromBackend(attemptId)
        const outcome = classifyAttemptStatus(latestAttempt?.status)
        if (outcome === 'SUBMITTED') {
          navigate(`/hoc-sinh/ket-qua/${attemptId}`, { replace: true })
          return
        }
        if (outcome === 'CANCELLED') {
          return
        }
      } catch {

      }
      if (isAttemptCancelledError(error)) {
        lockAsCancelled(null)
        return
      }
      toast.warning(getErrorMessage(error, 'Chưa đồng bộ được thời gian với máy chủ.'))
    } finally {
      timerSyncInFlightRef.current = false
    }
  }, [attemptId, lockAsCancelled, navigate, paperId, syncAttemptStatusFromBackend])

  useEffect(() => {
    document.title = 'Đang làm bài | Exam Matrix'
  }, [])

  useEffect(() => {
    if (!paperQuery.data || initStartedRef.current) return
    initStartedRef.current = true
    initializeAttempt()
  }, [initializeAttempt, paperQuery.data])

  const flushPendingAnswersRef = useRef(flushPendingAnswers)
  useEffect(() => {
    flushPendingAnswersRef.current = flushPendingAnswers
  }, [flushPendingAnswers])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (pendingSavesRef.current.size > 0 && isInProgressAttemptStatus(attemptStatusRef.current)) {
      flushPendingAnswersRef.current(true).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (sessionStatus !== 'ready' || deadlineRef.current == null || attemptStatus !== 'IN_PROGRESS') return undefined
    const updateTimer = () => {
      const next = displayedSeconds(deadlineRef.current, performance.now())
      setTimeLeft((current) => (current === next ? current : next))
    }
    const resyncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncServerTimer()
    }
    updateTimer()
    const interval = window.setInterval(updateTimer, 1000)
    document.addEventListener('visibilitychange', resyncWhenVisible)
    window.addEventListener('focus', resyncWhenVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', resyncWhenVisible)
      window.removeEventListener('focus', resyncWhenVisible)
    }
  }, [attemptStatus, sessionStatus, syncServerTimer])

  useEffect(() => {
    if (timeLeft !== 0 || !attemptId || autoSubmitTriggeredRef.current || attemptStatus !== 'IN_PROGRESS') return
    autoSubmitTriggeredRef.current = true
    toast.warning('Hết giờ. Đang lưu câu trả lời cuối và đồng bộ trạng thái nộp...')
    setShowSubmitModal(false)
    requestSubmit()
  }, [attemptId, attemptStatus, requestSubmit, timeLeft])

  const queueAnswer = useCallback(
    (questionId: string, answer: DraftAnswer, debounce = false, revision: number | null = null) => {
      if (!isInProgressAttemptStatus(attemptStatus)) return
      const nextRev = revision ?? (answerRevisionRef.current[questionId] || 0)
      pendingSavesRef.current.set(questionId, { answer, revision: nextRev })
      setQuestionSaveStates((prev) => ({
        ...prev,
        [questionId]: { status: 'saving' },
      }))
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (debounce) {
        saveTimerRef.current = setTimeout(() => {
          saveTimerRef.current = null
          flushPendingAnswers().catch(() => {})
        }, 650)
      } else {
        saveTimerRef.current = null
        flushPendingAnswers().catch(() => {})
      }
    },
    [attemptStatus, flushPendingAnswers]
  )

  const hasDirtyAnswers = Object.keys(dirtyQuestions).length > 0

  useEffect(() => {
    if (!hasDirtyAnswers || !isInProgressAttemptStatus(attemptStatus)) return undefined
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const handleLinkClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (!href || href.startsWith('#') || anchor.target === '_blank') return
      const ok = window.confirm(
        'Bạn vẫn còn câu trả lời chưa được lưu lên máy chủ. Rời trang lúc này có thể làm gián đoạn quá trình đồng bộ. Bạn có chắc muốn rời trang?'
      )
      if (!ok) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleLinkClickCapture, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleLinkClickCapture, true)
    }
  }, [attemptStatus, hasDirtyAnswers])

  const commitAnswer = (questionId: string, nextAnswer: DraftAnswer, debounce = false) => {
    if (!isInProgressAttemptStatus(attemptStatus) || timeLeft === 0) return
    const nextRev = (answerRevisionRef.current[questionId] || 0) + 1
    answerRevisionRef.current[questionId] = nextRev
    const next: AnswersMap = { ...answerStateRef.current, [questionId]: nextAnswer }
    answerStateRef.current = next
    setAnswers(next)
    setDirtyQuestions((prev) => (prev[questionId] ? prev : { ...prev, [questionId]: true }))
    const targetQuestion = (paperQuery.data?.questions || []).find((q) => q.id === questionId)
    if (targetQuestion?.type === 'ESSAY' && currentUserId && attemptId) {
      saveEssayDraft({
        userId: currentUserId,
        attemptId,
        questionId,
        revision: nextRev,
        text: nextAnswer.essayAnswer ?? '',
        updatedAt: Date.now(),
      })
    }
    queueAnswer(questionId, nextAnswer, debounce, nextRev)
  }

  const handleSingleChoice = (questionId: string, answerId: string) => {
    commitAnswer(questionId, { selectedAnswerIds: [answerId], essayAnswer: '' })
  }

  const handleMultipleChoice = (questionId: string, answerId: string, checked: boolean) => {
    const current = answerStateRef.current[questionId]?.selectedAnswerIds || []
    const nextIds = checked ? [...current, answerId] : current.filter((id) => id !== answerId)
    commitAnswer(questionId, { selectedAnswerIds: nextIds, essayAnswer: '' })
  }

  const handleEssayChange = (questionId: string, essayAnswer: string) => {
    commitAnswer(questionId, { selectedAnswerIds: [], essayAnswer }, true)
  }

  const retrySingleQuestion = (questionId: string) => {
    const draft = answerStateRef.current[questionId]
    if (!draft || attemptStatus !== 'IN_PROGRESS' || timeLeft === 0) return
    queueAnswer(questionId, draft, false)
  }

  const revertToConfirmedAnswer = (questionId: string) => {
    const confirmed = confirmedAnswersRef.current[questionId] || blankAnswer()
    const restored: DraftAnswer = {
      selectedAnswerIds: [...(confirmed.selectedAnswerIds || [])],
      essayAnswer: confirmed.essayAnswer ?? '',
    }
    pendingSavesRef.current.delete(questionId)
    if (currentUserId && attemptId) {
      clearEssayDraft(currentUserId, attemptId, questionId)
    }
    setDirtyQuestions((prev) => {
      if (!prev[questionId]) return prev
      const next = { ...prev }
      delete next[questionId]
      return next
    })
    const next: AnswersMap = { ...answerStateRef.current, [questionId]: restored }
    answerStateRef.current = next
    setAnswers(next)
    setQuestionSaveStates((prev) => ({
      ...prev,
      [questionId]: { status: 'saved' },
    }))
  }

  const questions = paperQuery.data?.questions || []
  const answeredCount = questions.filter((question) => {
    const answer = answers[question.id]
    if (!answer) return false
    return question.type === 'ESSAY'
      ? Boolean(answer.essayAnswer?.trim())
      : Boolean(answer.selectedAnswerIds?.length)
  }).length

  const savingSummary = useMemo(() => {
    const entries = Object.values(questionSaveStates)
    const errorCount = entries.filter((item) => item?.status === 'error').length
    const savingCount = entries.filter((item) => item?.status === 'saving').length
    if (errorCount > 0) return { status: 'error' as const, errorCount, savingCount }
    if (savingCount > 0) return { status: 'saving' as const, errorCount, savingCount }
    if (entries.some((item) => item?.status === 'saved')) return { status: 'saved' as const, errorCount: 0, savingCount: 0 }
    return { status: 'idle' as const, errorCount: 0, savingCount: 0 }
  }, [questionSaveStates])

  const formatTimer = (seconds: number | null): string => {
    if (seconds == null) return '--:--'
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  }

  if (paperQuery.error) return <ErrorState error={paperQuery.error} onRetry={() => paperQuery.refetch()} />
  if (paperQuery.isLoading || sessionStatus === 'loading') {
    return <LoadingState label="Đang tải đề thi, khôi phục bài làm và đồng bộ thời gian..." />
  }
  if (sessionStatus === 'error') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-4 p-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">Không thể mở lượt làm bài</h1>
          <p className="text-sm text-slate-600">
            {getErrorMessage(sessionError, 'Hệ thống chưa thể khôi phục lượt làm bài.')}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button onClick={() => { initStartedRef.current = true; initializeAttempt() }}>
              <RefreshCw className="h-4 w-4" />
              Thử đồng bộ lại
            </Button>
            <Button variant="outline" onClick={() => navigate('/hoc-sinh/de-thi')}>
              Về danh sách đề
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  if (!questions.length) {
    return <EmptyState title="Đề thi chưa có câu hỏi" description="Đề này không có câu hỏi để làm." />
  }

  const isAttemptClosed = attemptStatus !== 'IN_PROGRESS'
  const controlsDisabled = sessionStatus !== 'ready' || isAttemptClosed || timeLeft === 0 || isSubmitting
  const saveLabel =
    savingSummary.status === 'saving'
      ? `Đang lưu (${savingSummary.savingCount})...`
      : savingSummary.status === 'error'
        ? `${savingSummary.errorCount} câu chưa lưu — giữ đáp án đã xác nhận`
        : savingSummary.status === 'saved'
          ? 'Đã lưu lên máy chủ'
          : 'Chưa có thay đổi'

  return (
    <div className="space-y-6" data-role="student">

      <header className="sticky top-16 z-10 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-lg font-extrabold text-slate-900 truncate">{paperQuery.data?.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Badge variant="indigo">{examTypeLabel(paperQuery.data?.examType)}</Badge>
              <span className="font-semibold tabular-nums">
                {answeredCount}/{questions.length} câu đã trả lời
              </span>
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold',
                  savingSummary.status === 'error'
                    ? 'bg-rose-50 text-rose-700'
                    : savingSummary.status === 'saving'
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-emerald-50 text-emerald-700'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    savingSummary.status === 'error'
                      ? 'bg-rose-600'
                      : savingSummary.status === 'saving'
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                  )}
                />
                {saveLabel}
              </span>
              {savingSummary.status === 'error' && !controlsDisabled && (
                <Button variant="outline" size="sm" onClick={() => flushPendingAnswers().catch(() => {})}>
                  Thử lưu tất cả
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              role="timer"
              aria-label={`Thời gian còn lại ${formatTimer(timeLeft)}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-base font-extrabold tabular-nums',
                timeLeft != null && timeLeft < 300
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              )}
            >
              <Clock className="h-4 w-4" />
              <span>{formatTimer(timeLeft)}</span>
            </div>

            <Button variant="amber" onClick={() => setShowSubmitModal(true)} disabled={controlsDisabled}>
              <Send className="h-4 w-4" />
              Nộp bài
            </Button>
          </div>
        </div>

        <nav aria-label="Điều hướng câu hỏi" className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
          {questions.map((question, index) => {
            const order = question.questionOrder || index + 1
            const confirmed = confirmedAnswers[question.id]
            const qState = questionSaveStates[question.id]?.status
            const isConfirmedAnswered =
              question.type === 'ESSAY'
                ? Boolean(confirmed?.essayAnswer?.trim())
                : Boolean(confirmed?.selectedAnswerIds?.length)
            return (
              <button
                key={question.id}
                type="button"
                aria-label={`Đi tới câu ${order}${qState === 'error' ? ', lỗi lưu' : isConfirmedAnswered ? ', đã lưu' : ', chưa trả lời'}`}
                onClick={() => document.getElementById(`question-${order}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={cn(
                  'h-8 min-w-8 rounded-md border px-2 text-xs font-bold tabular-nums transition-colors cursor-pointer',
                  qState === 'error'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : isConfirmedAnswered
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                {order}
              </button>
            )
          })}
        </nav>
      </header>

      {unknownStatusNotice && !isCancelledAttemptStatus(attemptStatus) && !isSubmittedAttemptStatus(attemptStatus) && (
        <Alert variant="warning">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{unknownStatusNotice}</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualStatusRecheck}
                disabled={isRecheckingStatus}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRecheckingStatus && 'animate-spin')} />
                {isRecheckingStatus ? 'Đang kiểm tra...' : 'Kiểm tra lại trạng thái'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {(isAttemptClosed || timeLeft === 0) && (
        <Alert
          variant={
            isCancelledAttemptStatus(attemptStatus)
              ? 'destructive'
              : isSubmittedAttemptStatus(attemptStatus)
                ? 'info'
                : 'warning'
          }
        >
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {isCancelledAttemptStatus(attemptStatus)
                ? 'Lượt làm đã bị hủy. Chức năng chỉnh sửa và nộp bài đã khóa, bộ đếm giờ đã dừng.'
                : isSubmittedAttemptStatus(attemptStatus)
                  ? `Lượt thi hiện ở trạng thái: ${attemptStatusMeta(attemptStatus).label}. Chức năng chỉnh sửa đã khóa theo trạng thái từ máy chủ.`
                  : isAttemptClosed
                    ? `Trạng thái lượt thi chưa xác định (${attemptStatus || 'không rõ'}). Vui lòng kiểm tra lại trạng thái trước khi thao tác tiếp.`
                    : timeoutSyncError
                      ? `Đã hết giờ làm bài (${timeoutSyncError}). Đáp án chưa được gửi lên máy chủ sẽ không được tính nếu lượt thi đã khóa.`
                      : 'Đã hết giờ làm bài. Đang đồng bộ trạng thái nộp bài với máy chủ...'}
            </span>
            <div className="flex flex-wrap gap-2">
              {isCancelledAttemptStatus(attemptStatus) ? (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/hoc-sinh/de-thi">Về danh sách đề</Link>
                  </Button>
                  {attemptId && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/hoc-sinh/ket-qua/${attemptId}`}>Xem chi tiết lượt thi</Link>
                    </Button>
                  )}
                </>
              ) : isSubmittedAttemptStatus(attemptStatus) ? (
                <Button variant="teal" size="sm" asChild>
                  <Link to={`/hoc-sinh/ket-qua/${attemptId}`}>Xem kết quả bài thi</Link>
                </Button>
              ) : isAttemptClosed ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualStatusRecheck}
                  disabled={isRecheckingStatus}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isRecheckingStatus && 'animate-spin')} />
                  {isRecheckingStatus ? 'Đang kiểm tra...' : 'Kiểm tra lại trạng thái'}
                </Button>
              ) : (
                (submitFailed || timeoutSyncError) && (
                  <Button variant="destructive" size="sm" onClick={requestSubmit} disabled={isSubmitting}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Đồng bộ trạng thái & Nộp bài
                  </Button>
                )
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <main className="space-y-4">
        {questions.map((question, index) => {
          const order = question.questionOrder || index + 1
          const currentAnswer = answers[question.id] || blankAnswer()
          const confirmedAnswer = confirmedAnswers[question.id]
          const qSave = questionSaveStates[question.id] || { status: 'saved' as const }
          const selectedIds = currentAnswer.selectedAnswerIds || []
          const essayId = `essay-answer-${question.id}`

          return (
            <Card key={question.id} id={`question-${order}`} aria-labelledby={`question-title-${question.id}`}>
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id={`question-title-${question.id}`} className="text-base font-extrabold text-slate-900">
                    Câu {order}{' '}
                    <span className="text-xs font-semibold text-slate-500">({question.points ?? '—'} điểm)</span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        qSave.status === 'error'
                          ? 'danger'
                          : qSave.status === 'saving'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {qSave.status === 'error'
                        ? 'Lỗi lưu đáp án'
                        : qSave.status === 'saving'
                          ? 'Đang lưu...'
                          : 'Đã xác nhận lưu'}
                    </Badge>
                    <Badge variant="neutral">{typeLabel(question.type)}</Badge>
                  </div>
                </div>

                {qSave.status === 'error' && (
                  <Alert variant="destructive">
                    <AlertDescription className="space-y-2 text-xs">
                      <p>
                        <strong>Chưa lưu được thay đổi mới:</strong> {qSave.message || 'Lỗi kết nối máy chủ.'}
                      </p>
                      <p className="text-rose-900">{summarizeConfirmedAnswer(question, confirmedAnswer)}</p>
                      {!controlsDisabled && (
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={() => retrySingleQuestion(question.id)}>
                            <RefreshCw className="h-3 w-3" />
                            Thử lưu lại câu này
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => revertToConfirmedAnswer(question.id)}>
                            <RotateCcw className="h-3 w-3" />
                            Khôi phục đáp án đã xác nhận
                          </Button>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-base leading-relaxed text-slate-900 whitespace-pre-line">{question.content}</div>

                {(question.type === 'SINGLE_CHOICE' || question.type === 'TRUE_FALSE') && (
                  <fieldset className="space-y-2.5" disabled={controlsDisabled}>
                    <legend className="sr-only">Chọn một đáp án cho câu {order}</legend>
                    {(question.answers || []).map((answer, answerIndex) => {
                      const isChecked = selectedIds.includes(answer.id)
                      return (
                        <label
                          key={answer.id}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors cursor-pointer',
                            isChecked
                              ? 'border-teal-600 bg-teal-50/70 font-semibold text-slate-900'
                              : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                            controlsDisabled && 'cursor-not-allowed opacity-75'
                          )}
                        >
                          <input
                            type="radio"
                            name={`answer-${question.id}`}
                            value={answer.id}
                            checked={isChecked}
                            onChange={() => handleSingleChoice(question.id, answer.id)}
                            className="mt-0.5 h-4 w-4 accent-teal-700"
                          />
                          <span className="font-bold text-slate-500">{String.fromCharCode(65 + answerIndex)}.</span>
                          <span className="flex-1 whitespace-pre-line">{answer.content}</span>
                        </label>
                      )
                    })}
                  </fieldset>
                )}

                {question.type === 'MULTIPLE_CHOICE' && (
                  <fieldset className="space-y-2.5" disabled={controlsDisabled}>
                    <legend className="sr-only">Chọn một hoặc nhiều đáp án cho câu {order}</legend>
                    <p className="text-xs font-medium text-slate-500">Có thể chọn nhiều phương án đúng.</p>
                    {(question.answers || []).map((answer, answerIndex) => {
                      const isChecked = selectedIds.includes(answer.id)
                      return (
                        <label
                          key={answer.id}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors cursor-pointer',
                            isChecked
                              ? 'border-teal-600 bg-teal-50/70 font-semibold text-slate-900'
                              : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                            controlsDisabled && 'cursor-not-allowed opacity-75'
                          )}
                        >
                          <input
                            type="checkbox"
                            name={`answer-${question.id}`}
                            value={answer.id}
                            checked={isChecked}
                            onChange={(event) => handleMultipleChoice(question.id, answer.id, event.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-teal-700"
                          />
                          <span className="font-bold text-slate-500">{String.fromCharCode(65 + answerIndex)}.</span>
                          <span className="flex-1 whitespace-pre-line">{answer.content}</span>
                        </label>
                      )
                    })}
                  </fieldset>
                )}

                {question.type === 'ESSAY' && (
                  <div className="space-y-1.5">
                    <label htmlFor={essayId} className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Bài làm tự luận
                    </label>
                    <Textarea
                      id={essayId}
                      rows={7}
                      value={currentAnswer.essayAnswer || ''}
                      placeholder="Nhập câu trả lời của bạn..."
                      onChange={(event) => handleEssayChange(question.id, event.target.value)}
                      disabled={controlsDisabled}
                      className="text-sm leading-relaxed"
                    />
                    <p className="text-xs text-slate-500">Nội dung được tự động lưu sau khi bạn dừng nhập.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </main>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-8">
        <Button variant="amber" size="lg" onClick={() => setShowSubmitModal(true)} disabled={controlsDisabled}>
          <CheckCircle2 className="h-4 w-4" />
          Kiểm tra và nộp bài
        </Button>
        {timeLeft === 0 && !isAttemptClosed && (submitFailed || timeoutSyncError) && (
          <Button variant="destructive" onClick={requestSubmit} disabled={isSubmitting}>
            Thử nộp lại
          </Button>
        )}
      </div>

      {showSubmitModal && (
        <ConfirmModal
          title="Xác nhận nộp bài"
          message={`Bạn đã trả lời ${answeredCount}/${questions.length} câu. ${answeredCount < questions.length ? `Còn ${questions.length - answeredCount} câu chưa có câu trả lời.` : 'Tất cả câu hỏi đã có câu trả lời.'} Sau khi nộp, bạn không thể chỉnh sửa bài làm.`}
          confirmLabel="Lưu và nộp bài"
          variant="amber"
          busy={isSubmitting}
          onConfirm={requestSubmit}
          onClose={() => !isSubmitting && setShowSubmitModal(false)}
        />
      )}
    </div>
  )
}
