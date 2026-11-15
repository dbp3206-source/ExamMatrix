import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import { Badge, EmptyState, ErrorState, LoadingState, Modal, PageHeader, Pagination } from '../components/UI'
import { requestStatusMeta } from '../constants'
import { useToast } from '../components/ToastProvider'

export default function TeacherStudentRequestsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [page, setPage] = useState(0)
  const size = 10
  const [statusFilter, setStatusFilter] = useState('PENDING')

  // Review modal state: { id, studentName, action: 'APPROVED' | 'REJECTED' | 'REVOKED' }
  const [reviewTarget, setReviewTarget] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')

  // Class edit modal state
  const [isEditClassOpen, setIsEditClassOpen] = useState(false)
  const [classNameInput, setClassNameInput] = useState('')
  const [classCodeInput, setClassCodeInput] = useState('')
  const [classPasswordInput, setClassPasswordInput] = useState('')

  useEffect(() => {
    document.title = 'Duyệt học sinh | Exam Matrix'
  }, [])

  const {
    data: classData,
    isLoading: isClassLoading,
    refetch: refetchClass,
  } = useQuery({
    queryKey: ['teacher', 'class'],
    queryFn: () => api.getTeacherClass(),
  })

  useEffect(() => {
    if (classData) {
      setClassNameInput(classData.name || '')
      setClassCodeInput(classData.classCode || '')
    }
  }, [classData])

  const updateClassMutation = useMutation({
    mutationFn: (body) => api.updateTeacherClass(body),
    onSuccess: () => {
      showToast('Cập nhật thông tin lớp học thành công')
      setIsEditClassOpen(false)
      setClassPasswordInput('')
      refetchClass()
    },
    onError: (err) => {
      showToast(err.message || 'Không thể cập nhật thông tin lớp học', 'error')
    },
  })

  const {
    data: requestsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['teacher', 'student-requests', statusFilter, page, size],
    queryFn: () =>
      api.getTeacherStudentRequests({
        status: statusFilter || undefined,
        page,
        size,
      }),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ requestId, status, note }) =>
      api.reviewStudentRequest(requestId, {
        status,
        decisionNote: note || null,
      }),
    onSuccess: (data, vars) => {
      if (vars.status === 'APPROVED') {
        showToast('Đã cấp quyền học sinh thành công')
      } else if (vars.status === 'REVOKED') {
        showToast('Đã thu hồi quyền học sinh')
      } else {
        showToast('Đã từ chối yêu cầu của học sinh')
      }
      setReviewTarget(null)
      setDecisionNote('')
      queryClient.invalidateQueries({ queryKey: ['teacher', 'student-requests'] })
      refetchClass()
    },
    onError: (err) => {
      showToast(err.message || 'Không thể xử lý yêu cầu', 'error')
    },
  })

  const openReview = (item, action) => {
    setReviewTarget({
      id: item.id,
      studentName: item.studentName,
      action,
    })
    setDecisionNote('')
  }

  const handleConfirmReview = (e) => {
    e.preventDefault()
    if (!reviewTarget) return
    reviewMutation.mutate({
      requestId: reviewTarget.id,
      status: reviewTarget.action,
      note: decisionNote.trim(),
    })
  }

  return (
    <div>
      <PageHeader
        title="Duyệt yêu cầu học sinh"
        description="Quản lý và phê duyệt danh sách học sinh đăng ký tham gia lớp học và làm bài thi."
      />

      {/* Thông tin lớp học */}
      <section className="panel" style={{ marginBottom: '20px' }}>
        <div className="panel-heading">
          <h2>Thông tin lớp học & Phòng thi</h2>
          <button
            type="button"
            className="button secondary small"
            onClick={() => setIsEditClassOpen(true)}
          >
            Thiết lập mã / mật khẩu lớp
          </button>
        </div>
        {isClassLoading ? (
          <p className="muted">Đang tải thông tin lớp học...</p>
        ) : classData ? (
          <div className="detail-meta" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <span>
              Tên lớp học
              <strong>{classData.name}</strong>
            </span>
            <span>
              Mã tham gia lớp
              <strong>
                <code style={{ fontSize: '1rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                  {classData.classCode}
                </code>
              </strong>
            </span>
            <span>
              Số học sinh đã duyệt
              <strong>{classData.studentCount ?? 0} học sinh</strong>
            </span>
            <span>
              Bảo vệ bằng mật khẩu
              <Badge tone="success">Đang bật</Badge>
            </span>
          </div>
        ) : (
          <p className="muted">Chưa có thông tin lớp học</p>
        )}
      </section>

      {/* Filter Toolbar */}
      <div className="toolbar">
        <label>
          Trạng thái yêu cầu
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(0)
            }}
          >
            <option value="PENDING">Chờ duyệt (PENDING)</option>
            <option value="APPROVED">Đã duyệt (APPROVED)</option>
            <option value="REJECTED">Đã từ chối (REJECTED)</option>
            <option value="REVOKED">Đã thu hồi (REVOKED)</option>
            <option value="">Tất cả</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <LoadingState label="Đang tải danh sách yêu cầu..." />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !requestsData?.content || requestsData.content.length === 0 ? (
        <EmptyState
          title="Không có yêu cầu nào"
          description="Hiện tại không có yêu cầu nào phù hợp với bộ lọc đã chọn."
        />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Email</th>
                  <th>Thời gian gửi</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requestsData.content.map((item) => {
                  const meta = requestStatusMeta(item.status)
                  const isPending = item.status === 'PENDING'
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.studentName}</strong>
                      </td>
                      <td>{item.studentEmail}</td>
                      <td>
                        {item.requestedAt
                          ? new Date(item.requestedAt).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                      <td>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="button small"
                                onClick={() => openReview(item, 'APPROVED')}
                              >
                                Phê duyệt
                              </button>
                              <button
                                type="button"
                                className="button danger small"
                                onClick={() => openReview(item, 'REJECTED')}
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {item.status === 'APPROVED' && (
                            <button
                              type="button"
                              className="button danger small"
                              onClick={() => openReview(item, 'REVOKED')}
                            >
                              Thu hồi quyền
                            </button>
                          )}
                          {(item.status === 'REJECTED' || item.status === 'REVOKED') && (
                            <button
                              type="button"
                              className="button secondary small"
                              onClick={() => openReview(item, 'APPROVED')}
                            >
                              Cấp lại quyền
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={requestsData.page || page}
            totalPages={requestsData.totalPages || 0}
            onChange={(newPage) => setPage(newPage)}
          />
        </section>
      )}

      {/* Review Modal */}
      {reviewTarget && (
        <Modal
          title={
            reviewTarget.action === 'APPROVED'
              ? `Xác nhận phê duyệt: ${reviewTarget.studentName}`
              : reviewTarget.action === 'REVOKED'
              ? `Thu hồi quyền: ${reviewTarget.studentName}`
              : `Từ chối yêu cầu: ${reviewTarget.studentName}`
          }
          onClose={() => setReviewTarget(null)}
        >
          <form onSubmit={handleConfirmReview}>
            <p>
              {reviewTarget.action === 'APPROVED'
                ? `Sau khi duyệt, học sinh ${reviewTarget.studentName} sẽ được cấp quyền xem và làm tất cả các đề thi của bạn.`
                : reviewTarget.action === 'REVOKED'
                ? `Sau khi thu hồi quyền, học sinh ${reviewTarget.studentName} sẽ không thể xem hoặc làm các đề thi của bạn nữa.`
                : `Học sinh ${reviewTarget.studentName} sẽ không thể xem hoặc làm đề thi của bạn.`}
            </p>

            <label>
              Ghi chú phản hồi cho học sinh (tùy chọn)
              <textarea
                rows={3}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={
                  reviewTarget.action === 'APPROVED'
                    ? 'Ví dụ: Đã xác nhận học sinh lớp 12A1...'
                    : 'Ví dụ: Học sinh không thuộc danh sách lớp...'
                }
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setReviewTarget(null)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={`button ${reviewTarget.action === 'REJECTED' || reviewTarget.action === 'REVOKED' ? 'danger' : ''}`}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending
                  ? 'Đang xử lý...'
                  : reviewTarget.action === 'APPROVED'
                  ? 'Xác nhận duyệt'
                  : reviewTarget.action === 'REVOKED'
                  ? 'Xác nhận thu hồi'
                  : 'Xác nhận từ chối'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Class Modal */}
      {isEditClassOpen && (
        <Modal
          title="Thiết lập lớp học & Mật khẩu tham gia"
          onClose={() => setIsEditClassOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              updateClassMutation.mutate({
                name: classNameInput.trim(),
                classCode: classCodeInput.trim().toUpperCase(),
                password: classPasswordInput.trim() || undefined,
              })
            }}
          >
            <label>
              Tên lớp học
              <input
                type="text"
                required
                value={classNameInput}
                onChange={(e) => setClassNameInput(e.target.value)}
                placeholder="Ví dụ: Lớp Toán 12A1"
              />
            </label>

            <label style={{ marginTop: '12px' }}>
              Mã tham gia lớp (học sinh dùng để tìm lớp)
              <input
                type="text"
                required
                value={classCodeInput}
                onChange={(e) => setClassCodeInput(e.target.value.toUpperCase())}
                placeholder="Ví dụ: TOAN12A1"
              />
            </label>

            <label style={{ marginTop: '12px' }}>
              Mật khẩu tham gia mới (để trống nếu giữ nguyên mật khẩu cũ)
              <input
                type="password"
                value={classPasswordInput}
                onChange={(e) => setClassPasswordInput(e.target.value)}
                placeholder="Nhập mật khẩu mới để thay đổi"
              />
            </label>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setIsEditClassOpen(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="button"
                disabled={updateClassMutation.isPending || !classNameInput.trim() || !classCodeInput.trim()}
              >
                {updateClassMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
