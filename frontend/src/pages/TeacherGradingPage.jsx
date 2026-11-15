import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import { Badge, ConfirmModal, EmptyState, ErrorState, LoadingState, Modal, PageHeader, Pagination } from '../components/UI'
import { useToast } from '../components/ToastProvider'

export default function TeacherGradingPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [page, setPage] = useState(0)
  const size = 10

  const [activeAttemptId, setActiveAttemptId] = useState(null)
  const [confirmCompleteId, setConfirmCompleteId] = useState(null)

  useEffect(() => {
    document.title = 'Chấm bài tự luận | Exam Matrix'
  }, [])

  // Fetch pending list
  const {
    data: pendingData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['teacher', 'grading', 'pending', page, size],
    queryFn: () => api.getPendingGrading({ page, size }),
  })

  // Fetch active attempt detail for grading
  const {
    data: gradingAttempt,
    isLoading: isAttemptLoading,
    error: attemptError,
    refetch: refetchAttempt,
  } = useQuery({
    queryKey: ['teacher', 'grading', 'attempt', activeAttemptId],
    queryFn: () => api.getGradingAttempt(activeAttemptId),
    enabled: Boolean(activeAttemptId),
  })

  // Mutation to save score & feedback for one answer
  const gradeAnswerMutation = useMutation({
    mutationFn: ({ attemptId, attemptAnswerId, awardedScore, feedback }) =>
      api.gradeAttemptAnswer(attemptId, attemptAnswerId, { awardedScore, feedback }),
    onSuccess: () => {
      showToast('Đã lưu điểm câu hỏi thành công')
      queryClient.invalidateQueries({ queryKey: ['teacher', 'grading', 'attempt', activeAttemptId] })
    },
    onError: (err) => {
      showToast(err.message || 'Không thể lưu điểm câu hỏi', 'error')
    },
  })

  // Mutation to complete grading
  const completeMutation = useMutation({
    mutationFn: (attemptId) => api.completeGrading(attemptId, { status: 'COMPLETED' }),
    onSuccess: () => {
      showToast('Hoàn tất chấm bài thi thành công!')
      setConfirmCompleteId(null)
      setActiveAttemptId(null)
      queryClient.invalidateQueries({ queryKey: ['teacher', 'grading'] })
    },
    onError: (err) => {
      showToast(err.message || 'Không thể hoàn tất chấm bài', 'error')
    },
  })

  return (
    <div>
      <PageHeader
        title="Chấm bài tự luận"
        description="Đọc bài làm tự luận của học sinh, so sánh với đáp án tham khảo, cho điểm và phản hồi."
      />

      {isLoading ? (
        <LoadingState label="Đang tải danh sách bài thi chờ chấm..." />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !pendingData?.content || pendingData.content.length === 0 ? (
        <EmptyState
          title="Không có bài thi nào chờ chấm"
          description="Tất cả các bài kiểm tra tự luận của học sinh đã được chấm hoàn tất."
        />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Tên đề thi</th>
                  <th>Thời gian nộp</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingData.content.map((item) => (
                  <tr key={item.attemptId}>
                    <td>
                      <strong>{item.studentName}</strong>
                    </td>
                    <td className="long-cell">
                      <strong>{item.paperTitle}</strong>
                    </td>
                    <td>
                      {item.submittedAt
                        ? new Date(item.submittedAt).toLocaleString('vi-VN')
                        : '—'}
                    </td>
                    <td>
                      <Badge tone="warning">Chờ chấm</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="button small"
                        onClick={() => setActiveAttemptId(item.attemptId)}
                      >
                        Chấm bài
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pendingData.page || page}
            totalPages={pendingData.totalPages || 0}
            onChange={(newPage) => setPage(newPage)}
          />
        </section>
      )}

      {/* Modal / Grading View */}
      {activeAttemptId && (
        <Modal
          title={`Chấm bài: ${gradingAttempt?.studentName || 'Học sinh'} - ${gradingAttempt?.paperTitle || ''}`}
          wide
          onClose={() => setActiveAttemptId(null)}
        >
          {isAttemptLoading ? (
            <LoadingState label="Đang tải nội dung bài làm..." />
          ) : attemptError ? (
            <ErrorState error={attemptError} onRetry={refetchAttempt} />
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '18px',
                }}
              >
                <div>
                  <strong>Học sinh: {gradingAttempt?.studentName}</strong>
                  <span className="subtext">Đề: {gradingAttempt?.paperTitle}</span>
                </div>
                <button
                  type="button"
                  className="button"
                  onClick={() => setConfirmCompleteId(activeAttemptId)}
                >
                  Hoàn tất chấm bài
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {gradingAttempt?.questions?.map((q, idx) => (
                  <GradingQuestionCard
                    key={q.attemptAnswerId || q.questionId}
                    index={idx + 1}
                    question={q}
                    saving={gradeAnswerMutation.isPending}
                    onSave={({ awardedScore, feedback }) =>
                      gradeAnswerMutation.mutate({
                        attemptId: activeAttemptId,
                        attemptAnswerId: q.attemptAnswerId,
                        awardedScore,
                        feedback,
                      })
                    }
                  />
                ))}
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setActiveAttemptId(null)}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setConfirmCompleteId(activeAttemptId)}
                >
                  Hoàn tất chấm bài
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Confirmation Modal */}
      {confirmCompleteId && (
        <ConfirmModal
          title="Xác nhận hoàn tất chấm bài"
          message="Bạn có chắc chắn muốn lưu kết quả chấm và công bố điểm cho học sinh này? Sau khi hoàn tất, điểm sẽ được ghi nhận chính thức vào hệ thống."
          confirmLabel="Xác nhận hoàn tất"
          busy={completeMutation.isPending}
          onConfirm={() => completeMutation.mutate(confirmCompleteId)}
          onClose={() => setConfirmCompleteId(null)}
        />
      )}
    </div>
  )
}

function GradingQuestionCard({ index, question, onSave, saving }) {
  const [score, setScore] = useState(
    question.awardedScore != null ? question.awardedScore : ''
  )
  const [feedback, setFeedback] = useState(question.feedback || '')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSave = (e) => {
    e.preventDefault()
    setErrorMsg('')
    const num = parseFloat(score)
    if (isNaN(num)) {
      setErrorMsg('Vui lòng nhập điểm số hợp lệ')
      return
    }
    if (num < 0) {
      setErrorMsg('Điểm không được nhỏ hơn 0')
      return
    }
    if (num > (question.points || 10)) {
      setErrorMsg(`Điểm không được vượt quá ${question.points} điểm`)
      return
    }

    onSave({ awardedScore: num, feedback: feedback.trim() })
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '18px',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--navy-dark)' }}>
          Câu {index}: {question.questionContent}
        </h3>
        <Badge tone="neutral">Tối đa: {question.points} điểm</Badge>
      </div>

      {/* Reference Answer */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)' }}>
          ĐÁP ÁN THAM KHẢO & THANG ĐIỂM:
        </span>
        <div
          style={{
            background: '#f2f7f4',
            borderLeft: '4px solid var(--success)',
            padding: '10px 14px',
            borderRadius: '4px',
            marginTop: '4px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            fontSize: '0.88rem',
          }}
        >
          {question.referenceAnswer || '—'}
        </div>
      </div>

      {/* Student Essay Answer */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--blue)' }}>
          BÀI LÀM CỦA HỌC SINH:
        </span>
        <div
          style={{
            background: '#f7f9fb',
            borderLeft: '4px solid var(--blue)',
            padding: '12px 14px',
            borderRadius: '4px',
            marginTop: '4px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            fontSize: '0.9rem',
          }}
        >
          {question.essayAnswer || '— (Trống)'}
        </div>
      </div>

      {/* Score and feedback inputs */}
      <form onSubmit={handleSave} style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
        <div className="form-grid two">
          <div>
            <label style={{ margin: '0 0 6px 0' }}>
              Điểm chấm (Tối đa {question.points} điểm)
              <input
                type="number"
                step="0.25"
                min="0"
                max={question.points}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="Ví dụ: 1.5"
                required
              />
            </label>
            {errorMsg && <span className="field-error">{errorMsg}</span>}
          </div>

          <div>
            <label style={{ margin: '0 0 6px 0' }}>
              Nhận xét / Phản hồi cho học sinh
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Gợi ý sửa sai hoặc nhận xét bài làm..."
              />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button type="submit" className="button small" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu điểm câu này'}
          </button>
        </div>
      </form>
    </div>
  )
}
