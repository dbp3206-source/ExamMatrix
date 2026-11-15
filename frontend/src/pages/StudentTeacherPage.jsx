import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/service'
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/UI'
import { requestStatusMeta } from '../constants'
import { useToast } from '../components/ToastProvider'

export default function StudentTeacherPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    document.title = 'Giáo viên hướng dẫn | Exam Matrix'
  }, [])

  // Current request query
  const {
    data: currentRequest,
    isLoading: isReqLoading,
    error: reqError,
    refetch: refetchCurrentRequest,
  } = useQuery({
    queryKey: ['student', 'teacher-request', 'current'],
    queryFn: () => api.getCurrentTeacherRequest(),
  })

  // Active teachers query
  const {
    data: teachers = [],
    isLoading: isTeachersLoading,
    error: teachersError,
    refetch: refetchTeachers,
  } = useQuery({
    queryKey: ['student', 'teachers'],
    queryFn: () => api.getTeachers(),
  })

  // Mutation to send request
  const sendRequestMutation = useMutation({
    mutationFn: ({ teacherId, password }) => api.createTeacherRequest({ teacherId, password }),
    onSuccess: (data) => {
      showToast('Tham gia lớp của giáo viên thành công')
      setSelectedTeacherId('')
      setPassword('')
      queryClient.setQueryData(['student', 'teacher-request', 'current'], data)
      queryClient.invalidateQueries({ queryKey: ['student', 'teacher-request'] })
      queryClient.invalidateQueries({ queryKey: ['student', 'exams'] })
    },
    onError: (err) => {
      showToast(err.message || 'Không thể tham gia lớp học', 'error')
    },
  })

  const isPendingOrApproved =
    currentRequest && (currentRequest.status === 'PENDING' || currentRequest.status === 'APPROVED')

  const handleSend = (e) => {
    e.preventDefault()
    if (!selectedTeacherId || !password) return
    sendRequestMutation.mutate({ teacherId: selectedTeacherId, password })
  }

  if (isReqLoading || isTeachersLoading) {
    return <LoadingState label="Đang tải thông tin giáo viên..." />
  }

  if (reqError) {
    return <ErrorState error={reqError} onRetry={refetchCurrentRequest} />
  }

  const statusMeta = currentRequest ? requestStatusMeta(currentRequest.status) : null

  return (
    <div>
      <PageHeader
        title="Giáo viên hướng dẫn"
        description="Đăng ký và quản lý giáo viên hướng dẫn để được cấp quyền tham gia các kỳ thi."
      />

      {/* Trạng thái hiện tại */}
      <section className="panel">
        <div className="panel-heading">
          <h2>Yêu cầu hiện tại của bạn</h2>
          {currentRequest && (
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          )}
        </div>

        {currentRequest ? (
          <div className="detail-meta" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <span>
              Giáo viên
              <strong>{currentRequest.teacherName || '—'}</strong>
            </span>
            {currentRequest.className && (
              <span>
                Lớp học
                <strong>{currentRequest.className} ({currentRequest.classCode})</strong>
              </span>
            )}
            <span>
              Trạng thái
              <strong>{statusMeta.label}</strong>
            </span>
            <span>
              Thời gian gửi
              <strong>
                {currentRequest.requestedAt
                  ? new Date(currentRequest.requestedAt).toLocaleString('vi-VN')
                  : '—'}
              </strong>
            </span>
            {currentRequest.decisionNote && (
              <span style={{ gridColumn: '1 / -1' }}>
                Phản hồi từ giáo viên
                <strong>{currentRequest.decisionNote}</strong>
              </span>
            )}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Bạn chưa đăng ký giáo viên hướng dẫn nào. Vui lòng chọn một giáo viên bên dưới để gửi yêu cầu tham gia lớp học.
          </p>
        )}

        {currentRequest?.status === 'APPROVED' && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="alert" style={{ margin: 0, flex: 1, background: '#e4f3e9', borderColor: '#b3dcc0', color: '#1b633d' }}>
              Yêu cầu của bạn đã được chấp thuận. Bạn có thể vào phòng thi và làm các bài kiểm tra do giáo viên giao.
            </div>
            <Link to="/hoc-sinh/de-thi" className="button">
              Xem danh sách đề thi
            </Link>
          </div>
        )}

        {currentRequest?.status === 'PENDING' && (
          <div className="alert warning" style={{ marginTop: '16px', margin: 0 }}>
            Yêu cầu đang chờ giáo viên xác nhận. Vui lòng đợi giáo viên phê duyệt trước khi có thể làm bài thi. Trong thời gian này, bạn không thể gửi thêm yêu cầu khác.
          </div>
        )}

        {currentRequest?.status === 'REJECTED' && (
          <div className="alert error" style={{ marginTop: '16px', margin: 0 }}>
            Yêu cầu trước đó đã bị từ chối. Bạn có thể chọn giáo viên khác bên dưới và gửi yêu cầu mới.
          </div>
        )}
      </section>

      {/* Gửi yêu cầu mới */}
      <section className="panel">
        <h2>{isPendingOrApproved ? 'Đăng ký giáo viên mới' : 'Chọn giáo viên hướng dẫn'}</h2>

        {isPendingOrApproved ? (
          <p className="muted">
            Bạn hiện đã có một yêu cầu ở trạng thái <strong>{statusMeta.label}</strong>. Hệ thống không cho phép gửi thêm yêu cầu khi đang chờ duyệt hoặc đã được duyệt.
          </p>
        ) : (
          <div>
            {teachersError && <ErrorState error={teachersError} onRetry={refetchTeachers} />}

            {teachers.length === 0 ? (
              <EmptyState
                title="Chưa có giáo viên khả dụng"
                description="Hiện chưa có giáo viên nào hoạt động trong hệ thống. Vui lòng quay lại sau."
              />
            ) : (
              <form onSubmit={handleSend} style={{ maxWidth: '520px' }}>
                <label>
                  Danh sách giáo viên hoạt động
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn giáo viên --</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.fullName} ({teacher.email})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ marginTop: '16px' }}>
                  Mật khẩu tham gia lớp
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu do giáo viên cung cấp"
                    required
                  />
                </label>

                <div style={{ marginTop: '16px' }}>
                  <button
                    type="submit"
                    className="button"
                    disabled={!selectedTeacherId || !password.trim() || sendRequestMutation.isPending}
                  >
                    {sendRequestMutation.isPending ? 'Đang xác thực...' : 'Tham gia lớp học'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
