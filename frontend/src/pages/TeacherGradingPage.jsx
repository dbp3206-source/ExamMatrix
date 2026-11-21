import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { formatDate } from '@/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmModal, EmptyState, ErrorState, FieldError, LoadingState, PageHeader, Pagination } from '@/components/common/StateFeedback'
import { cn } from '@/lib/utils'

export default function TeacherGradingPage() {
  const queryClient = useQueryClient()
  const [statusTab, setStatusTab] = useState('WAITING_GRADING')
  const [page, setPage] = useState(0)
  const [activeAttemptId, setActiveAttemptId] = useState(null)
  const [confirmCompleteId, setConfirmCompleteId] = useState(null)
  const [confirmDiscardTarget, setConfirmDiscardTarget] = useState(null)
  const [dirtyAnswers, setDirtyAnswers] = useState({})
  const [answerErrors, setAnswerErrors] = useState({})
  const size = 10

  useEffect(() => {
    document.title = 'Chấm bài tự luận | Exam Matrix'
  }, [])

  const queueQuery = useQuery({
    queryKey: ['teacher', 'grading', 'queue', statusTab, page, size],
    queryFn: () => api.getPendingGrading({ status: statusTab, page, size }),
  })

  const lastPage = queueQuery.data == null ? null : Math.max(0, queueQuery.data.totalPages - 1)
  useEffect(() => {
    if (lastPage != null && !queueQuery.isFetching && page > lastPage) {
      setPage(lastPage)
    }
  }, [lastPage, page, queueQuery.isFetching])

  const attemptQuery = useQuery({
    queryKey: ['teacher', 'grading', 'attempt', activeAttemptId],
    queryFn: () => api.getGradingAttempt(activeAttemptId),
    enabled: Boolean(activeAttemptId),
  })

  const gradeAnswerMutation = useMutation({
    mutationFn: ({ attemptId, attemptAnswerId, awardedScore, feedback }) =>
      api.gradeAttemptAnswer(attemptId, attemptAnswerId, { awardedScore, feedback }),
    onSuccess: async (_, variables) => {
      setAnswerErrors((prev) => {
        const next = { ...prev }
        delete next[variables.attemptAnswerId]
        return next
      })
      toast.success('Đã lưu điểm và nhận xét')
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'grading', 'attempt', variables.attemptId] })
    },
    onError: (error, variables) => {
      const serverFields = error?.fieldErrors || error?.response?.data?.fieldErrors || {}
      const answerKey = variables?.attemptAnswerId
      if (answerKey) {
        setAnswerErrors((prev) => ({
          ...prev,
          [answerKey]: {
            awardedScore: serverFields.awardedScore || '',
            feedback: serverFields.feedback || '',
            root: !serverFields.awardedScore && !serverFields.feedback ? error.message || 'Không thể lưu điểm câu hỏi' : '',
          },
        }))
      }
      toast.error(error.message || 'Không thể lưu điểm câu hỏi')
    },
  })

  const completeMutation = useMutation({
    mutationFn: (attemptId) => api.completeGrading(attemptId, { status: 'COMPLETED' }),
    onSuccess: (result, attemptId) => {
      setConfirmCompleteId(null)
      setDirtyAnswers({})

      if (result) {
        queryClient.setQueryData(['teacher', 'grading', 'attempt', attemptId], (previous) => {
          if (!previous) return previous
          const resultByQId = new Map((result.answers || []).map((item) => [item.questionId, item]))
          return {
            ...previous,
            status: result.status || 'COMPLETED',
            score: result.score ?? previous.score,
            maxScore: result.maxScore ?? previous.maxScore,
            gradedAt: result.gradedAt ?? previous.gradedAt,
            answers: (previous.answers || []).map((ans) => {
              const matched = resultByQId.get(ans.questionId)
              if (!matched) return ans
              return {
                ...ans,
                awardedScore: matched.awardedScore ?? ans.awardedScore,
                feedback: matched.feedback ?? ans.feedback,
                isCorrect: matched.isCorrect ?? ans.isCorrect,
              }
            }),
          }
        })
      }

      const finalOnTen = result?.scoreOnTen ?? result?.score
      toast.success(
        finalOnTen != null
          ? `Đã hoàn tất chấm bài: ${finalOnTen}/10 điểm`
          : 'Đã hoàn tất chấm bài'
      )
      queryClient.invalidateQueries({ queryKey: ['teacher', 'grading', 'queue'] })
      queryClient.invalidateQueries({ queryKey: ['student', 'exams'] })
      queryClient.invalidateQueries({ queryKey: ['student', 'attempt', attemptId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
    },
    onError: (error) => toast.error(error.message || 'Không thể hoàn tất chấm bài'),
  })

  const answers = attemptQuery.data?.answers || []
  const essayAnswers = answers.filter((answer) => answer.type === 'ESSAY')
  const ungradedCount = essayAnswers.filter((answer) => answer.awardedScore == null).length
  const hasUnsavedChanges = Object.keys(dirtyAnswers).length > 0
  const canEditAttempt = ['WAITING_GRADING', 'SUBMITTED'].includes(attemptQuery.data?.status)
  const canComplete =
    Boolean(attemptQuery.data) &&
    canEditAttempt &&
    essayAnswers.length > 0 &&
    ungradedCount === 0 &&
    !hasUnsavedChanges &&
    !gradeAnswerMutation.isPending &&
    !completeMutation.isPending

  const reportDirty = useCallback((answerId, isDirty) => {
    if (!answerId) return
    setDirtyAnswers((current) => {
      if (Boolean(current[answerId]) === isDirty) return current
      const next = { ...current }
      if (isDirty) next[answerId] = true
      else delete next[answerId]
      return next
    })
  }, [])

  const selectAttempt = (nextId) => {
    if (gradeAnswerMutation.isPending || completeMutation.isPending) return
    if (nextId === activeAttemptId) return
    if (hasUnsavedChanges) {
      setConfirmDiscardTarget(nextId)
      return
    }
    setDirtyAnswers({})
    setActiveAttemptId(nextId)
  }

  const switchTab = (nextTab) => {
    if (hasUnsavedChanges) {
      toast.warning('Vui lòng lưu hoặc bỏ các thay đổi chưa lưu trước khi chuyển tab.')
      return
    }
    setStatusTab(nextTab)
    setPage(0)
    setActiveAttemptId(null)
    setDirtyAnswers({})
  }

  const queueList = queueQuery.data?.content || []
  const queueTotal = queueQuery.data?.totalElements ?? queueList.length

  return (
    <div className="space-y-5" data-role="teacher">
      <PageHeader
        accent="amber"
        eyebrow="BÀI LÀM CẦN ĐÁNH GIÁ"
        title="Chấm bài tự luận"
        description="Chọn bài thi ở danh sách bên trái, chấm điểm và nhận xét từng câu theo barem bên phải, rồi xác nhận hoàn tất."
        action={
          <Tabs value={statusTab} onValueChange={switchTab}>
            <TabsList>
              <TabsTrigger value="WAITING_GRADING">Chờ chấm</TabsTrigger>
              <TabsTrigger value="COMPLETED">Đã chấm</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600" aria-live="polite">
        <span className="tabular-nums">
          {queueTotal} lượt thi {statusTab === 'WAITING_GRADING' ? 'đang chờ chấm' : 'đã hoàn tất chấm'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

        <div className="space-y-3 lg:col-span-5 xl:col-span-4">
          {queueQuery.isLoading || (lastPage != null && page > lastPage) ? (
            <LoadingState label="Đang tải danh sách bài thi..." />
          ) : queueQuery.error ? (
            <ErrorState error={queueQuery.error} onRetry={queueQuery.refetch} />
          ) : queueList.length === 0 ? (
            <EmptyState
              title={statusTab === 'WAITING_GRADING' ? 'Không có bài thi chờ chấm' : 'Chưa có bài tự luận đã chấm'}
              description={
                statusTab === 'WAITING_GRADING'
                  ? 'Các bài tự luận mới sẽ xuất hiện tại đây sau khi học sinh nộp bài.'
                  : 'Các bài tự luận đã hoàn tất chấm sẽ hiển thị ở mục này.'
              }
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
                {queueList.map((item) => {
                  const isActive = activeAttemptId === item.attemptId
                  return (
                    <button
                      key={item.attemptId}
                      type="button"
                      onClick={() => selectAttempt(item.attemptId)}
                      className={cn(
                        'w-full text-left p-4 transition-colors cursor-pointer space-y-1.5',
                        isActive ? 'bg-amber-50/80 ring-1 ring-inset ring-amber-300' : 'hover:bg-slate-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm font-bold text-slate-900">{item.studentName || 'Học sinh'}</strong>
                        <Badge variant={item.status === 'COMPLETED' ? 'success' : 'warning'}>
                          {item.status === 'COMPLETED' ? 'Đã chấm' : 'Chờ chấm'}
                        </Badge>
                      </div>
                      <div className="text-xs font-medium text-slate-700 line-clamp-1">{item.paperTitle || '—'}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Clock className="h-3 w-3" />
                        <span>Nộp lúc: {formatDate(item.submittedAt)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <Pagination
                page={queueQuery.data?.page ?? page}
                totalPages={queueQuery.data?.totalPages ?? 0}
                onChange={setPage}
              />
            </>
          )}
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          {!activeAttemptId ? (
            <Card className="border-dashed border-slate-300 bg-white/80">
              <CardContent className="py-16 text-center space-y-2">
                <strong className="block text-base text-slate-900">Chọn một bài thi để bắt đầu</strong>
                <p className="text-sm text-slate-600">
                  Nhấn vào một lượt nộp bài ở danh sách bên trái để xem bài làm, đối chiếu đáp án tham khảo và chấm điểm.
                </p>
              </CardContent>
            </Card>
          ) : attemptQuery.isLoading ? (
            <LoadingState label="Đang tải nội dung bài làm..." />
          ) : attemptQuery.error ? (
            <ErrorState error={attemptQuery.error} onRetry={attemptQuery.refetch} />
          ) : (
            <div className="space-y-4">

              <Card className="border-amber-200 bg-white">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>{attemptQuery.data?.studentName}</CardTitle>
                    <CardDescription>
                      {attemptQuery.data?.paperTitle} · Nộp lúc {formatDate(attemptQuery.data?.submittedAt)}
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canEditAttempt ? (
                      <>
                        <Badge variant={ungradedCount === 0 && !hasUnsavedChanges ? 'success' : 'warning'}>
                          {ungradedCount > 0
                            ? `Còn ${ungradedCount} câu chưa lưu điểm`
                            : hasUnsavedChanges
                              ? 'Có thay đổi chưa lưu'
                              : 'Đã lưu đủ điểm'}
                        </Badge>
                        <Button
                          variant="amber"
                          disabled={!canComplete}
                          onClick={() => setConfirmCompleteId(activeAttemptId)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Hoàn tất chấm
                        </Button>
                      </>
                    ) : (
                      <Badge variant="success" className="text-sm px-3 py-1 tabular-nums">
                        Tổng điểm: {attemptQuery.data?.score ?? '—'} / {attemptQuery.data?.maxScore ?? '—'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {answers.map((answer, index) => (
                <GradingQuestionCard
                  key={`${activeAttemptId}-${answer.attemptAnswerId || answer.questionId}`}
                  index={answer.questionOrder || index + 1}
                  question={answer}
                  studentName={attemptQuery.data?.studentName}
                  saving={gradeAnswerMutation.isPending}
                  canEdit={canEditAttempt}
                  serverError={answerErrors[answer.attemptAnswerId]}
                  onClearServerError={() =>
                    setAnswerErrors((prev) => {
                      if (!prev[answer.attemptAnswerId]) return prev
                      const next = { ...prev }
                      delete next[answer.attemptAnswerId]
                      return next
                    })
                  }
                  onDirtyChange={reportDirty}
                  onSave={({ awardedScore, feedback }) =>
                    gradeAnswerMutation.mutate({
                      attemptId: activeAttemptId,
                      attemptAnswerId: answer.attemptAnswerId,
                      awardedScore,
                      feedback,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmCompleteId && (
        <ConfirmModal
          title="Hoàn tất chấm bài?"
          message="Sau khi xác nhận, hệ thống ghi nhận tổng điểm từ các điểm đã lưu và học sinh có thể xem kết quả."
          confirmLabel="Ghi nhận kết quả"
          variant="amber"
          busy={completeMutation.isPending}
          onConfirm={() => completeMutation.mutate(confirmCompleteId)}
          onClose={() => !completeMutation.isPending && setConfirmCompleteId(null)}
        />
      )}

      {confirmDiscardTarget && (
        <ConfirmModal
          title="Bỏ thay đổi chưa lưu?"
          message="Điểm hoặc nhận xét bạn vừa nhập chưa được lưu. Nếu chuyển sang bài khác, những thay đổi này sẽ bị mất."
          confirmLabel="Bỏ thay đổi"
          onConfirm={() => {
            const nextId = confirmDiscardTarget
            setConfirmDiscardTarget(null)
            setDirtyAnswers({})
            setActiveAttemptId(nextId)
          }}
          onClose={() => setConfirmDiscardTarget(null)}
        />
      )}
    </div>
  )
}

function GradingQuestionCard({ index, question, studentName, onSave, saving, canEdit, onDirtyChange, serverError, onClearServerError }) {
  const [score, setScore] = useState(question.awardedScore == null ? '' : String(question.awardedScore))
  const [feedback, setFeedback] = useState(question.feedback || '')
  const [errorMessage, setErrorMessage] = useState('')
  const baselineScore = question.awardedScore == null ? '' : String(question.awardedScore)
  const baselineFeedback = question.feedback || ''
  const isEssay = question.type === 'ESSAY'

  const scoresMatch =
    score.trim() === '' || baselineScore === ''
      ? score.trim() === baselineScore
      : Number(score) === Number(baselineScore)
  const isDirty = !scoresMatch || feedback.trim() !== baselineFeedback.trim()
  const answerId = question.attemptAnswerId

  useEffect(() => {
    setScore(baselineScore)
    setFeedback(baselineFeedback)
    setErrorMessage('')
  }, [baselineScore, baselineFeedback, answerId])

  useEffect(() => {
    onDirtyChange(answerId, canEdit && isEssay && isDirty)
  }, [answerId, canEdit, isDirty, isEssay, onDirtyChange])

  const submit = (event) => {
    event.preventDefault()
    setErrorMessage('')
    const trimmedScore = String(score).trim()
    if (trimmedScore === '') {
      setErrorMessage('Vui lòng nhập điểm (nhập 0 nếu câu trả lời không có điểm).')
      return
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(trimmedScore)) {
      setErrorMessage('Điểm phải là số không âm và tối đa hai chữ số thập phân (VD: 1.25).')
      return
    }
    const value = Number(trimmedScore)
    const maxPoints = Number(question.points)
    if (question.points == null || !Number.isFinite(value) || !Number.isFinite(maxPoints)) {
      setErrorMessage('Điểm tối đa của câu hỏi không hợp lệ.')
      return
    }
    if (value < 0 || value > maxPoints) {
      setErrorMessage(`Điểm phải từ 0 đến ${question.points}.`)
      return
    }
    if (!answerId) {
      setErrorMessage('Bài làm chưa có bản ghi câu trả lời để lưu điểm.')
      return
    }
    onSave({ awardedScore: Number(value.toFixed(2)), feedback: feedback.trim() })
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-3">
        <CardTitle className="text-base leading-snug">
          Câu {index}: <span className="font-semibold">{question.content || 'Nội dung câu hỏi không khả dụng'}</span>
        </CardTitle>
        <Badge variant="neutral" className="shrink-0 tabular-nums">
          Tối đa: {question.points ?? '—'} điểm
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isEssay ? (
          <Alert variant={question.isCorrect ? 'success' : 'default'}>
            <AlertDescription>
              {question.selectedAnswerIds?.length
                ? `Học sinh đã chọn ${question.selectedAnswerIds.length} phương án.`
                : 'Học sinh không chọn phương án nào.'}{' '}
              <strong>
                {question.isCorrect === true ? 'Đúng' : question.isCorrect === false ? 'Chưa đúng' : 'Chưa chấm máy'}
              </strong>
              {question.awardedScore != null && ` · Điểm: ${question.awardedScore}/${question.points}`}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                Đáp án tham khảo / Barem chấm
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 text-sm text-slate-800 whitespace-pre-line">
                {question.referenceAnswer || 'Chưa có hướng dẫn chấm.'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                {studentName ? `Bài làm của ${studentName}` : 'Bài làm của học sinh'}
              </div>
              {question.essayAnswer?.trim() && (
                <div className="rounded-lg border border-slate-200 bg-[#F8F7F4] p-3.5 text-sm leading-relaxed text-slate-900 whitespace-pre-line">
                  {question.essayAnswer.trim()}
                </div>
              )}
            </div>

            {canEdit ? (
              <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor={`score-${answerId}`}>Điểm chấm (0–{question.points ?? '—'})</Label>
                    <Input
                      id={`score-${answerId}`}
                      type="number"
                      step="0.01"
                      min={0}
                      max={question.points}
                      aria-invalid={Boolean(errorMessage || serverError?.awardedScore)}
                      value={score}
                      onChange={(e) => {
                        setScore(e.target.value)
                        if (errorMessage) setErrorMessage('')
                        onClearServerError?.()
                      }}
                      placeholder="VD: 0.75"
                      disabled={saving || !answerId}
                      className="font-bold tabular-nums"
                      required
                    />
                    <FieldError>{errorMessage || serverError?.awardedScore}</FieldError>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`fb-${answerId}`}>Nhận xét cho học sinh</Label>
                    <Textarea
                      id={`fb-${answerId}`}
                      rows={2}
                      aria-invalid={Boolean(serverError?.feedback)}
                      value={feedback}
                      onChange={(e) => {
                        setFeedback(e.target.value)
                        onClearServerError?.()
                      }}
                      placeholder="Nêu điểm đạt được và nội dung cần bổ sung..."
                      disabled={saving || !answerId}
                    />
                    <FieldError>{serverError?.feedback}</FieldError>
                  </div>
                </div>
                {serverError?.root && <FieldError>{serverError.root}</FieldError>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {isDirty ? 'Có thay đổi chưa lưu lên máy chủ.' : question.awardedScore != null ? 'Điểm câu này đã được lưu.' : ''}
                  </span>
                  <Button type="submit" variant="amber" size="sm" disabled={saving || !answerId || !isDirty}>
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Đang lưu...' : 'Lưu điểm & nhận xét'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm space-y-1">
                <div className="font-bold text-slate-900 tabular-nums">
                  Điểm đã chấm: {question.awardedScore ?? '—'} / {question.points ?? '—'}
                </div>
                {question.feedback && (
                  <div className="text-slate-700">
                    <strong>Nhận xét:</strong> {question.feedback}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
