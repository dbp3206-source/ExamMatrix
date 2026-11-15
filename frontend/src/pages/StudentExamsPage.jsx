import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/service'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../components/UI'
import { attemptStatusMeta, examTypeLabel } from '../constants'
import { useToast } from '../components/ToastProvider'

export default function StudentExamsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [page, setPage] = useState(0)
  const size = 10

  useEffect(() => {
    document.title = 'Đề thi của tôi | Exam Matrix'
  }, [])

  // Check teacher assignment first
  const {
    data: currentRequest,
    isLoading: isReqLoading,
    error: reqError,
  } = useQuery({
    queryKey: ['student', 'teacher-request', 'current'],
    queryFn: () => api.getCurrentTeacherRequest(),
  })

  const isApproved = currentRequest?.status === 'APPROVED'

  // Query exams
  const {
    data: examData,
    isLoading: isExamsLoading,
    error: examsError,
    refetch: refetchExams,
  } = useQuery({
    queryKey: ['student', 'exams', page, size],
    queryFn: () => api.getStudentExams({ page, size }),
  })

  // Mutation to start attempt
  const startAttemptMutation = useMutation({
    mutationFn: (paperId) => api.startExamAttempt(paperId),
    onSuccess: (data, paperId) => {
      navigate(`/hoc-sinh/lam-bai/${paperId}`, { state: { attemptId: data?.attemptId } })
    },
    onError: (err, paperId) => {
      // If attempt is already in progress, navigate to taking page
      if (err.message?.includes('đang làm') || err.status === 409) {
        navigate(`/hoc-sinh/lam-bai/${paperId}`)
      } else {
        showToast(err.message || 'Không thể bắt đầu bài thi', 'error')
      }
    },
  })

  if (isReqLoading) {
    return <LoadingState label="Đang kiểm tra quyền truy cập..." />
  }

  if (reqError) {
    return <ErrorState error={reqError} />
  }

  return (
    <div>
      <PageHeader
        title="Đề thi của tôi"
        description={
          isApproved
            ? `Danh sách đề thi công khai và từ lớp học của giáo viên: ${currentRequest?.teacherName || ''}`
            : 'Danh sách đề thi công khai và các đề thi bạn được cấp quyền làm.'
        }
      />

      {!isApproved && (
        <div className="alert info" style={{ marginBottom: '16px' }}>
          {currentRequest?.status === 'PENDING'
            ? 'Yêu cầu tham gia lớp của bạn đang chờ giáo viên xác nhận. Bạn vẫn có thể làm các đề thi Công khai bên dưới.'
            : 'Bạn chưa tham gia lớp của giáo viên nào. Bạn có thể làm các đề thi Công khai, hoặc tham gia lớp để mở khóa các đề thi Lớp học.'}{' '}
          <Link to="/hoc-sinh/giao-vien" style={{ fontWeight: 650, textDecoration: 'underline' }}>
            Tham gia lớp giáo viên
          </Link>
        </div>
      )}

      {isExamsLoading ? (
        <LoadingState label="Đang tải danh sách đề thi..." />
      ) : examsError ? (
        <ErrorState error={examsError} onRetry={refetchExams} />
      ) : !examData?.content || examData.content.length === 0 ? (
        <EmptyState
          title="Chưa có đề thi nào"
          description="Giáo viên của bạn hiện chưa phát hành đề thi nào cho lớp."
        />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã đề</th>
                  <th>Tên đề thi</th>
                  <th>Môn học</th>
                  <th>Phạm vi</th>
                  <th>Loại đề</th>
                  <th>Thời gian</th>
                  <th>Số câu</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {examData.content.map((exam) => {
                  const status = exam.attemptStatus || 'AVAILABLE'
                  const meta = attemptStatusMeta(status)
                  return (
                    <tr key={exam.paperId}>
                      <td>
                        <strong>{exam.examCode || '—'}</strong>
                      </td>
                      <td className="long-cell">
                        <strong>{exam.title}</strong>
                        {exam.teacherName && (
                          <span className="subtext">GV: {exam.teacherName}</span>
                        )}
                      </td>
                      <td>{exam.subjectName || '—'}</td>
                      <td>
                        <Badge tone={exam.accessType === 'PRIVATE' ? 'warning' : 'neutral'}>
                          {exam.accessType === 'PRIVATE' ? 'Lớp học' : 'Công khai'}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={exam.examType === 'ESSAY' ? 'warning' : 'neutral'}>
                          {examTypeLabel(exam.examType)}
                        </Badge>
                      </td>
                      <td>{exam.duration} phút</td>
                      <td>{exam.totalQuestions} câu</td>
                      <td>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {status === 'AVAILABLE' && (
                          <button
                            type="button"
                            className="button small"
                            disabled={startAttemptMutation.isPending}
                            onClick={() => startAttemptMutation.mutate(exam.paperId)}
                          >
                            Bắt đầu làm bài
                          </button>
                        )}
                        {status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            className="button small"
                            onClick={() => navigate(`/hoc-sinh/lam-bai/${exam.paperId}`)}
                          >
                            Tiếp tục làm bài
                          </button>
                        )}
                        {(status === 'COMPLETED' || status === 'WAITING_GRADING' || status === 'SUBMITTED') && (
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() =>
                              navigate(
                                exam.attemptId
                                  ? `/hoc-sinh/ket-qua/${exam.attemptId}`
                                  : `/hoc-sinh/de-thi`
                              )
                            }
                          >
                            Xem kết quả
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={examData.page || page}
            totalPages={examData.totalPages || 0}
            onChange={(newPage) => setPage(newPage)}
          />
        </section>
      )}
    </div>
  )
}
