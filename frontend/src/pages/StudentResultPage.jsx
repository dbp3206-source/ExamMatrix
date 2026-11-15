import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/service'
import { Badge, ErrorState, LoadingState, PageHeader } from '../components/UI'
import { attemptStatusMeta, examTypeLabel, typeLabel } from '../constants'

export default function StudentResultPage() {
  const { attemptId } = useParams()

  useEffect(() => {
    document.title = 'Kết quả bài thi | Exam Matrix'
  }, [])

  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['student', 'attempt', attemptId],
    queryFn: () => api.getAttemptResult(attemptId),
    enabled: Boolean(attemptId),
  })

  if (isLoading) {
    return <LoadingState label="Đang tải kết quả bài thi..." />
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  if (!result) {
    return (
      <div className="panel">
        <h2>Không tìm thấy bài thi</h2>
        <p className="muted">Không có thông tin lượt thi với mã này.</p>
        <Link to="/hoc-sinh/de-thi" className="button">
          Về danh sách đề thi
        </Link>
      </div>
    )
  }

  const isCompleted = result.status === 'COMPLETED'
  const isWaitingGrading = result.status === 'WAITING_GRADING' || result.status === 'SUBMITTED'
  const meta = attemptStatusMeta(result.status)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <PageHeader
        title="Kết quả bài thi"
        description={`Chi tiết kết quả lượt thi: ${result.paperTitle || 'Bài kiểm tra'}`}
        action={
          <Link to="/hoc-sinh/de-thi" className="button secondary">
            ← Quay lại danh sách đề thi
          </Link>
        }
      />

      {/* Summary Score Card */}
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{result.paperTitle}</h2>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <Badge tone="neutral">{examTypeLabel(result.examType)}</Badge>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            {isCompleted ? (
              <div>
                <span className="muted" style={{ fontSize: '0.85rem' }}>Điểm đạt được</span>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                  {result.score != null ? result.score : '—'}
                  <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--muted)' }}>
                    {' '}/ {result.maxScore != null ? result.maxScore : 10}
                  </span>
                </div>
              </div>
            ) : isWaitingGrading ? (
              <div
                style={{
                  padding: '12px 18px',
                  background: '#fff8e8',
                  border: '1px solid #e9cd8c',
                  borderRadius: '6px',
                  color: '#76510e',
                  fontWeight: 650,
                  fontSize: '0.95rem',
                }}
              >
                Đang chờ giáo viên chấm bài
              </div>
            ) : null}
          </div>
        </div>

        <div className="detail-meta" style={{ marginTop: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <span>
            Thời gian bắt đầu
            <strong>
              {result.startedAt ? new Date(result.startedAt).toLocaleString('vi-VN') : '—'}
            </strong>
          </span>
          <span>
            Thời gian nộp bài
            <strong>
              {result.submittedAt ? new Date(result.submittedAt).toLocaleString('vi-VN') : '—'}
            </strong>
          </span>
          {result.gradedAt && (
            <span>
              Thời gian chấm điểm
              <strong>{new Date(result.gradedAt).toLocaleString('vi-VN')}</strong>
            </span>
          )}
          <span>
            Trạng thái xử lý
            <strong>{meta.label}</strong>
          </span>
        </div>

        {isWaitingGrading && (
          <div className="alert warning" style={{ margin: '18px 0 0' }}>
            Bài thi tự luận của bạn đã được gửi thành công. Giáo viên sẽ đọc và cho điểm từng câu hỏi kèm nhận xét. Điểm số chính thức sẽ hiển thị tại đây khi quá trình chấm hoàn tất.
          </div>
        )}

        {isCompleted && result.examType === 'ESSAY' && (
          <div className="alert" style={{ margin: '18px 0 0', background: '#e4f3e9', borderColor: '#b3dcc0', color: '#1b633d' }}>
            Giáo viên đã hoàn thành chấm điểm bài thi của bạn. Xem chi tiết nhận xét từng câu bên dưới.
          </div>
        )}
      </section>

      {/* Questions & Feedback detail */}
      {result.answers && result.answers.length > 0 && (
        <section className="panel">
          <h2>Chi tiết bài làm {isCompleted && 'và nhận xét'}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '16px' }}>
            {result.answers.map((ans, idx) => {
              const qOrder = ans.questionOrder || idx + 1
              return (
                <div
                  key={ans.questionId || idx}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '18px',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>
                      Câu {qOrder}: {ans.questionContent}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Badge tone="neutral">{typeLabel(ans.type)}</Badge>
                      {ans.awardedScore != null && (
                        <span style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.9rem' }}>
                          {ans.awardedScore} / {ans.points || 1} điểm
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Objective response */}
                  {ans.type !== 'ESSAY' && (
                    <div style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                      {ans.selectedAnswerText ? (
                        <p style={{ margin: '4px 0' }}>
                          <strong>Câu trả lời của bạn:</strong> {ans.selectedAnswerText}
                        </p>
                      ) : (
                        <p style={{ margin: '4px 0', color: 'var(--muted)' }}>
                          <em>(Không chọn câu trả lời nào)</em>
                        </p>
                      )}
                      {isCompleted && ans.isCorrect != null && (
                        <span
                          className={`badge ${ans.isCorrect ? 'badge-success' : 'badge-danger'}`}
                          style={{ marginTop: '6px' }}
                        >
                          {ans.isCorrect ? '✓ Trả lời đúng' : '✗ Trả lời sai'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Essay response */}
                  {ans.type === 'ESSAY' && (
                    <div style={{ marginTop: '10px' }}>
                      <div
                        style={{
                          background: '#f8fafc',
                          padding: '12px 14px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.55',
                          fontSize: '0.9rem',
                        }}
                      >
                        <strong>Bài làm:</strong>
                        <p style={{ margin: '6px 0 0' }}>{ans.essayAnswer || '— (Trống)'}</p>
                      </div>

                      {/* Teacher Feedback */}
                      {isCompleted && ans.feedback && (
                        <div
                          style={{
                            marginTop: '12px',
                            background: '#f2f7f4',
                            borderLeft: '4px solid var(--success)',
                            padding: '12px 14px',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                          }}
                        >
                          <strong style={{ color: 'var(--success)' }}>Nhận xét của giáo viên:</strong>
                          <p style={{ margin: '4px 0 0', lineHeight: '1.5' }}>{ans.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
