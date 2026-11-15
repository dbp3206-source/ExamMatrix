import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../api/service'
import { ConfirmModal, ErrorState, LoadingState, Badge } from '../components/UI'
import { examTypeLabel, typeLabel } from '../constants'
import { useToast } from '../components/ToastProvider'

export default function StudentExamTakingPage() {
  const { paperId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()

  const [attemptId, setAttemptId] = useState(location.state?.attemptId || null)
  const [answers, setAnswers] = useState({}) // { [qId]: { selectedAnswerIds: [], essayAnswer: '' } }
  const [savingStatus, setSavingStatus] = useState('idle') // 'saving' | 'saved' | 'idle'
  const [timeLeft, setTimeLeft] = useState(null) // seconds
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const saveTimeoutRef = useRef({})

  // Fetch paper details with questions (NO correct answers / reference answer)
  const {
    data: examPaper,
    isLoading: isPaperLoading,
    error: paperError,
  } = useQuery({
    queryKey: ['student', 'exam-paper', paperId],
    queryFn: () => api.getStudentExam(paperId),
    enabled: Boolean(paperId),
  })

  // Ensure attempt exists and sync remaining time from server
  useEffect(() => {
    if (!paperId) return

    let isMounted = true
    api.startExamAttempt(paperId)
      .then((res) => {
        if (isMounted && res?.attemptId) {
          setAttemptId(res.attemptId)
          if (res.remainingSeconds !== undefined && res.remainingSeconds !== null) {
            setTimeLeft(res.remainingSeconds)
          }
        }
      })
      .catch((err) => {
        console.warn('Attempt start or resume:', err)
        if (err.response?.data?.attemptId) {
          setAttemptId(err.response.data.attemptId)
        } else {
          showToast(err.message || 'Không thể khởi tạo bài thi', 'error')
        }
      })

    return () => {
      isMounted = false
    }
  }, [paperId, showToast])

  // Initialize timer once duration is loaded
  useEffect(() => {
    if (examPaper?.duration && timeLeft === null) {
      setTimeLeft(examPaper.duration * 60)
    }
  }, [examPaper?.duration, timeLeft])

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  // Auto-submit when time expires
  useEffect(() => {
    if (timeLeft === 0 && attemptId) {
      showToast('Đã hết thời gian làm bài! Hệ thống đang tự động nộp bài...', 'warning')
      submitMutation.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, attemptId])

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => api.submitExamAttempt(attemptId),
    onSuccess: (res) => {
      showToast('Nộp bài thi thành công!')
      navigate(`/hoc-sinh/ket-qua/${res.attemptId || attemptId}`, { replace: true })
    },
    onError: (err) => {
      showToast(err.message || 'Không thể nộp bài thi', 'error')
    },
  })

  // Save answer to backend (PATCH)
  const saveAnswerToBackend = useCallback(
    async (qId, answerData) => {
      if (!attemptId) return
      setSavingStatus('saving')
      try {
        await api.saveAttemptAnswer(attemptId, {
          questionId: qId,
          selectedAnswerIds: answerData.selectedAnswerIds || [],
          essayAnswer: answerData.essayAnswer || null,
        })
        setSavingStatus('saved')
      } catch (err) {
        console.error('Lỗi lưu câu trả lời:', err)
        setSavingStatus('idle')
      }
    },
    [attemptId]
  )

  // Handle single choice selection
  const handleSingleChoice = (qId, answerId) => {
    const updated = {
      ...answers,
      [qId]: { selectedAnswerIds: [answerId], essayAnswer: null },
    }
    setAnswers(updated)
    saveAnswerToBackend(qId, updated[qId])
  }

  // Handle multiple choice selection
  const handleMultipleChoice = (qId, answerId, checked) => {
    const current = answers[qId]?.selectedAnswerIds || []
    const nextList = checked
      ? [...current, answerId]
      : current.filter((id) => id !== answerId)

    const updated = {
      ...answers,
      [qId]: { selectedAnswerIds: nextList, essayAnswer: null },
    }
    setAnswers(updated)
    saveAnswerToBackend(qId, updated[qId])
  }

  // Handle essay text change with debounce
  const handleEssayChange = (qId, text) => {
    const updated = {
      ...answers,
      [qId]: { selectedAnswerIds: [], essayAnswer: text },
    }
    setAnswers(updated)

    // Debounce 600ms
    if (saveTimeoutRef.current[qId]) {
      clearTimeout(saveTimeoutRef.current[qId])
    }
    setSavingStatus('saving')
    saveTimeoutRef.current[qId] = setTimeout(() => {
      saveAnswerToBackend(qId, updated[qId])
    }, 600)
  }

  // Calculate answered count
  const questions = examPaper?.questions || []
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id]
    if (!a) return false
    if (q.type === 'ESSAY') return Boolean(a.essayAnswer && a.essayAnswer.trim())
    return Boolean(a.selectedAnswerIds && a.selectedAnswerIds.length > 0)
  }).length

  const formatTimer = (seconds) => {
    if (seconds == null) return '--:--'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (isPaperLoading) {
    return <LoadingState label="Đang tải đề thi và câu hỏi..." />
  }

  if (paperError) {
    return <ErrorState error={paperError} onRetry={() => navigate('/hoc-sinh/de-thi')} />
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Header bar during exam */}
      <div
        className="panel"
        style={{
          position: 'sticky',
          top: '72px',
          zIndex: 15,
          boxShadow: '0 4px 16px rgba(18,52,91,0.08)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', margin: 0 }}>{examPaper?.title}</h1>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Loại đề: {examTypeLabel(examPaper?.examType)}
              </span>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Đã hoàn thành: <strong>{answeredCount}</strong>/{questions.length} câu
              </span>
              {savingStatus === 'saving' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Đang lưu câu trả lời...</span>
              )}
              {savingStatus === 'saved' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>✓ Đã lưu tự động</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                background: timeLeft && timeLeft < 300 ? '#fff2f1' : '#eef4fb',
                border: `1px solid ${timeLeft && timeLeft < 300 ? '#e6b8b3' : '#b8d2eb'}`,
                borderRadius: '6px',
                color: timeLeft && timeLeft < 300 ? 'var(--danger)' : 'var(--navy)',
                fontWeight: 700,
                fontSize: '1.15rem',
              }}
            >
              <span>⏱</span>
              <span>{formatTimer(timeLeft)}</span>
            </div>

            <button
              type="button"
              className="button danger"
              onClick={() => setShowSubmitModal(true)}
              disabled={submitMutation.isPending}
            >
              Nộp bài thi
            </button>
          </div>
        </div>

        {/* Quick jump navigation */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          {questions.map((q, idx) => {
            const a = answers[q.id]
            const isAnswered =
              q.type === 'ESSAY'
                ? Boolean(a?.essayAnswer?.trim())
                : Boolean(a?.selectedAnswerIds?.length > 0)
            return (
              <a
                key={q.id}
                href={`#question-${idx + 1}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontWeight: 650,
                  textDecoration: 'none',
                  background: isAnswered ? 'var(--navy)' : '#eef2f6',
                  color: isAnswered ? '#fff' : 'var(--navy-dark)',
                  border: '1px solid var(--border)',
                }}
              >
                {idx + 1}
              </a>
            )
          })}
        </div>
      </div>

      {/* Questions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {questions.map((q, idx) => {
          const qOrder = q.questionOrder || idx + 1
          const selectedChoices = answers[q.id]?.selectedAnswerIds || []
          const essayText = answers[q.id]?.essayAnswer || ''

          return (
            <section key={q.id} id={`question-${qOrder}`} className="panel" style={{ scrollMarginTop: '180px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '1.05rem', margin: 0 }}>
                  Câu {qOrder} <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.9rem' }}>({q.points || 1} điểm)</span>
                </h2>
                <Badge tone="neutral">{typeLabel(q.type)}</Badge>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  borderLeft: '4px solid var(--blue)',
                  padding: '14px 16px',
                  borderRadius: '4px',
                  lineHeight: '1.6',
                  marginBottom: '16px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {q.content}
              </div>

              {/* SINGLE CHOICE & TRUE FALSE */}
              {(q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {q.answers?.map((ans) => {
                    const isChecked = selectedChoices.includes(ans.id)
                    return (
                      <label
                        key={ans.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          margin: 0,
                          padding: '12px 14px',
                          border: `1px solid ${isChecked ? 'var(--blue)' : 'var(--border)'}`,
                          background: isChecked ? '#f0f6ff' : '#fff',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: isChecked ? 650 : 400,
                        }}
                      >
                        <input
                          type="radio"
                          name={`question-${q.id}`}
                          value={ans.id}
                          checked={isChecked}
                          onChange={() => handleSingleChoice(q.id, ans.id)}
                          style={{ width: 'auto', minHeight: 'auto', margin: 0 }}
                        />
                        <span style={{ flex: 1 }}>{ans.content}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* MULTIPLE CHOICE */}
              {q.type === 'MULTIPLE_CHOICE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span className="form-help" style={{ marginBottom: '4px' }}>
                    (Câu hỏi có thể có nhiều đáp án đúng, chọn tất cả đáp án phù hợp)
                  </span>
                  {q.answers?.map((ans) => {
                    const isChecked = selectedChoices.includes(ans.id)
                    return (
                      <label
                        key={ans.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          margin: 0,
                          padding: '12px 14px',
                          border: `1px solid ${isChecked ? 'var(--blue)' : 'var(--border)'}`,
                          background: isChecked ? '#f0f6ff' : '#fff',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: isChecked ? 650 : 400,
                        }}
                      >
                        <input
                          type="checkbox"
                          name={`question-${q.id}`}
                          value={ans.id}
                          checked={isChecked}
                          onChange={(e) => handleMultipleChoice(q.id, ans.id, e.target.checked)}
                          style={{ width: 'auto', minHeight: 'auto', margin: 0 }}
                        />
                        <span style={{ flex: 1 }}>{ans.content}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* ESSAY */}
              {q.type === 'ESSAY' && (
                <div>
                  <label style={{ margin: '0 0 8px 0', fontSize: '0.85rem' }}>
                    Nội dung bài làm tự luận:
                  </label>
                  <textarea
                    rows={8}
                    value={essayText}
                    placeholder="Nhập câu trả lời của bạn tại đây..."
                    onChange={(e) => handleEssayChange(q.id, e.target.value)}
                    style={{
                      width: '100%',
                      fontFamily: 'inherit',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                    }}
                  />
                  <span className="subtext">
                    Hệ thống tự động lưu bài làm sau khi bạn ngừng gõ.
                  </span>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* Bottom submit button */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="button danger"
          style={{ minWidth: '180px' }}
          onClick={() => setShowSubmitModal(true)}
          disabled={submitMutation.isPending}
        >
          Hoàn thành & Nộp bài
        </button>
      </div>

      {/* Confirmation Modal */}
      {showSubmitModal && (
        <ConfirmModal
          title="Xác nhận nộp bài thi"
          message={`Bạn đã hoàn thành ${answeredCount}/${questions.length} câu hỏi. ${
            answeredCount < questions.length
              ? `Vẫn còn ${questions.length - answeredCount} câu chưa làm.`
              : 'Bạn đã hoàn tất tất cả câu hỏi.'
          } Sau khi nộp bài, bạn sẽ không thể chỉnh sửa câu trả lời. Bạn có chắc chắn muốn nộp bài?`}
          confirmLabel="Nộp bài ngay"
          busy={submitMutation.isPending}
          onConfirm={() => submitMutation.mutate()}
          onClose={() => setShowSubmitModal(false)}
        />
      )}
    </div>
  )
}
