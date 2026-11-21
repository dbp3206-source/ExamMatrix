import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Lock, Settings2, ShieldBan, UserCheck, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { requestStatusMeta } from '@/constants'
import { formatDate } from '@/utils'
import { validateBcryptPasswordLength } from '@/utils/passwordValidation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, ErrorState, FieldError, LoadingState, PageHeader, Pagination } from '@/components/common/StateFeedback'

export default function TeacherStudentRequestsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const size = 10

  const [statusFilter, setStatusFilter] = useState('')

  const [reviewTarget, setReviewTarget] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')

  const [isEditClassOpen, setIsEditClassOpen] = useState(false)
  const [classNameInput, setClassNameInput] = useState('')
  const [classCodeInput, setClassCodeInput] = useState('')
  const [classPasswordInput, setClassPasswordInput] = useState('')
  const [classFormError, setClassFormError] = useState('')
  const [classFieldErrors, setClassFieldErrors] = useState({})
  const classPasswordRef = useRef(null)

  useEffect(() => {
    document.title = 'Duyệt học sinh & Lớp học | Exam Matrix'
  }, [])

  const {
    data: classData,
    isLoading: isClassLoading,
    error: classError,
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

  const openClassModal = (focusPassword = false) => {
    setClassFormError('')
    setClassFieldErrors({})
    setIsEditClassOpen(true)
    if (focusPassword) {
      window.setTimeout(() => classPasswordRef.current?.focus(), 60)
    }
  }

  const updateClassMutation = useMutation({
    mutationFn: (body) => api.updateTeacherClass(body),
    onSuccess: (updated) => {
      toast.success(
        updated?.hasPassword
          ? 'Đã lưu thông tin và bật mật khẩu tham gia lớp'
          : 'Đã cập nhật thông tin lớp học (lớp chưa có mật khẩu tham gia)'
      )
      setIsEditClassOpen(false)
      setClassPasswordInput('')
      setClassFormError('')
      setClassFieldErrors({})
      queryClient.setQueryData(['teacher', 'class'], updated)
      refetchClass()
    },
    onError: (err) => {
      const serverFieldErrors = err?.fieldErrors || err?.response?.data?.fieldErrors || {}
      const normalized = {
        ...(serverFieldErrors.name ? { name: serverFieldErrors.name } : {}),
        ...(serverFieldErrors.classCode ? { classCode: serverFieldErrors.classCode } : {}),
        ...(serverFieldErrors.password || serverFieldErrors.joinPassword
          ? { joinPassword: serverFieldErrors.password || serverFieldErrors.joinPassword }
          : {}),
      }
      if (Object.keys(normalized).length > 0) {
        setClassFieldErrors(normalized)
        setClassFormError('')
        toast.error('Vui lòng kiểm tra lại các trường bị lỗi trong biểu mẫu lớp học.')
      } else {
        const message = err.message || 'Không thể cập nhật thông tin lớp học'
        setClassFieldErrors({})
        setClassFormError(message)
        toast.error(message)
      }
    },
  })

  const {
    data: requestsData,
    isLoading,
    isFetching,
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

  const lastRequestPage = requestsData == null ? null : Math.max(0, requestsData.totalPages - 1)
  useEffect(() => {
    if (lastRequestPage != null && !isFetching && page > lastRequestPage) {
      setPage(lastRequestPage)
    }
  }, [isFetching, lastRequestPage, page])

  const reviewMutation = useMutation({
    mutationFn: ({ requestId, status, note }) =>
      api.reviewStudentRequest(requestId, {
        status,
        decisionNote: note || null,
      }),
    onSuccess: (_, vars) => {
      if (vars.status === 'APPROVED') toast.success('Đã cấp quyền học sinh thành công')
      else if (vars.status === 'REVOKED') toast.success('Đã thu hồi quyền học sinh')
      else toast.success('Đã từ chối yêu cầu của học sinh')
      setReviewTarget(null)
      setDecisionNote('')
      queryClient.invalidateQueries({ queryKey: ['teacher', 'student-requests'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'summary'] })
      refetchClass()
    },
    onError: (err) => toast.error(err.message || 'Không thể xử lý yêu cầu'),
  })

  const openReview = (item, action) => {
    setReviewTarget({ id: item.id, studentName: item.studentName, action })
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

  const columns = useMemo(
    () => [
      {
        accessorKey: 'studentName',
        header: 'Học sinh',
        cell: ({ row }) => (
          <div>
            <div className="font-bold text-slate-900">{row.original.studentName}</div>
            <div className="text-xs text-slate-500">{row.original.studentEmail}</div>
          </div>
        ),
      },
      {
        accessorKey: 'requestedAt',
        header: 'Thời gian gửi',
        cell: ({ row }) => <span className="text-xs text-slate-600">{formatDate(row.original.requestedAt)}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => {
          const meta = requestStatusMeta(row.original.status)
          return <Badge variant={meta.tone}>{meta.label}</Badge>
        },
      },
      {
        accessorKey: 'decisionNote',
        header: 'Ghi chú',
        cell: ({ row }) => <span className="text-xs text-slate-600">{row.original.decisionNote || '—'}</span>,
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { headClassName: 'text-right', cellClassName: 'text-right' },
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="inline-flex items-center justify-end gap-1.5">
              {item.status === 'PENDING' && (
                <>
                  <Button size="sm" variant="teal" onClick={() => openReview(item, 'APPROVED')}>
                    <Check className="h-3.5 w-3.5" />
                    Phê duyệt
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => openReview(item, 'REJECTED')}>
                    <X className="h-3.5 w-3.5" />
                    Từ chối
                  </Button>
                </>
              )}
              {item.status === 'APPROVED' && (
                <Button size="sm" variant="destructive" onClick={() => openReview(item, 'REVOKED')}>
                  <ShieldBan className="h-3.5 w-3.5" />
                  Thu hồi quyền
                </Button>
              )}
              {(item.status === 'REJECTED' || item.status === 'REVOKED') && (
                <Button size="sm" variant="outline" onClick={() => openReview(item, 'APPROVED')}>
                  <UserCheck className="h-3.5 w-3.5" />
                  Cấp lại quyền
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    []
  )

  const requestsList = requestsData?.content || []

  return (
    <div className="space-y-5" data-role="teacher">
      <PageHeader
        accent="amber"
        eyebrow="QUẢN LÝ LỚP HỌC & DUYỆT HỌC SINH"
        title="Lớp học & Duyệt học sinh"
        description="Quản lý mã lớp, mật khẩu tham gia và theo dõi danh sách học sinh được cấp quyền làm đề riêng của lớp."
      />

      <Card className="border-amber-200 bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{classData?.name ? `Lớp: ${classData.name}` : 'Thông tin lớp học'}</CardTitle>
            <CardDescription>Mỗi tài khoản giáo viên quản lý một lớp học với mã định danh và mật khẩu riêng.</CardDescription>
          </div>
          <Button
            variant={classData && !classData.hasPassword ? 'amber' : 'outline'}
            disabled={!classData || Boolean(classError)}
            onClick={() => openClassModal(!classData?.hasPassword)}
          >
            <Settings2 className="h-4 w-4" />
            {classData && !classData.hasPassword ? 'Đặt mật khẩu lớp ngay' : 'Thiết lập lớp & mật khẩu'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {classData && !classData.hasPassword && (
            <Alert variant="warning" className="items-center justify-between gap-3">
              <AlertDescription className="space-y-1">
                <strong className="block text-sm text-amber-950">
                  Cần đặt mật khẩu lớp trước khi chia sẻ mã cho học sinh
                </strong>
                <span className="block text-xs text-amber-900">
                  Lớp học mới tạo hoặc chưa đổi mật khẩu mặc định có trạng thái chưa mở (<code>hasPassword: false</code>). Học sinh sẽ nhận lỗi &ldquo;lớp chưa mở&rdquo; cho đến khi bạn đặt mật khẩu riêng (khác <code>123456</code>).
                </span>
              </AlertDescription>
              <Button variant="amber" size="sm" className="shrink-0" onClick={() => openClassModal(true)}>
                Đặt mật khẩu lớp
              </Button>
            </Alert>
          )}
          {isClassLoading ? (
            <div className="text-sm text-slate-500">Đang tải thông tin lớp học...</div>
          ) : classError ? (
            <ErrorState error={classError} onRetry={refetchClass} />
          ) : classData ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Tên lớp</div>
                <div className="mt-1 font-bold text-slate-900">{classData.name || '—'}</div>
              </div>

              <div className="rounded-lg bg-amber-50/70 p-3">
                <div className="text-[11px] font-semibold uppercase text-amber-800">Mã tham gia lớp</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-white px-2 py-0.5 text-sm font-extrabold text-amber-900 border border-amber-200">
                    {classData.classCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Sao chép mã lớp"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(classData.classCode)
                        if (classData.hasPassword) {
                          toast.success('Đã sao chép mã lớp')
                        } else {
                          toast.warning('Đã sao chép mã lớp. Lưu ý: bạn cần đặt mật khẩu lớp trước khi học sinh có thể tham gia.')
                        }
                      } catch {
                        toast.error('Không sao chép được. Hãy chọn mã lớp đang hiển thị.')
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {!classData.hasPassword && (
                  <p className="mt-1 text-[11px] font-medium text-amber-900">
                    Đặt mật khẩu trước khi chia sẻ mã này.
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Học sinh đã duyệt</div>
                <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-900 tabular-nums">
                  <Users className="h-4 w-4 text-teal-700" />
                  {classData.studentCount ?? 0} học sinh
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Bảo vệ mật khẩu</div>
                <div className="mt-1">
                  <Badge variant={classData.hasPassword ? 'success' : 'warning'}>
                    <Lock className="h-3 w-3" />
                    {classData.hasPassword ? 'Đang bật' : 'Chưa đặt mật khẩu'}
                  </Badge>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs
        value={statusFilter || 'ALL'}
        onValueChange={(val) => {
          setStatusFilter(val === 'ALL' ? '' : val)
          setPage(0)
        }}
      >
        <TabsList>
          <TabsTrigger value="ALL">Tất cả</TabsTrigger>
          <TabsTrigger value="APPROVED">Đã duyệt</TabsTrigger>
          <TabsTrigger value="PENDING">Chờ duyệt</TabsTrigger>
          <TabsTrigger value="REJECTED">Đã từ chối</TabsTrigger>
          <TabsTrigger value="REVOKED">Đã thu hồi</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading || (lastRequestPage != null && page > lastRequestPage) ? (
        <LoadingState label="Đang tải danh sách học sinh..." />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : requestsList.length === 0 ? (
        <EmptyState
          title="Không có học sinh nào"
          description="Hiện tại không có bản ghi phù hợp với bộ lọc trạng thái đã chọn."
        />
      ) : (
        <>
          <DataTable columns={columns} data={requestsList} getRowId={(r) => String(r.id)} />
          <Pagination
            page={requestsData.page ?? page}
            totalPages={requestsData.totalPages || 0}
            onChange={setPage}
          />
        </>
      )}

      {reviewTarget && (
        <Dialog open onOpenChange={(open) => { if (!open && !reviewMutation.isPending) setReviewTarget(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewTarget.action === 'APPROVED'
                  ? `Cấp quyền học sinh: ${reviewTarget.studentName}`
                  : reviewTarget.action === 'REVOKED'
                    ? `Thu hồi quyền: ${reviewTarget.studentName}`
                    : `Từ chối yêu cầu: ${reviewTarget.studentName}`}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleConfirmReview} className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                {reviewTarget.action === 'APPROVED'
                  ? `Sau khi duyệt, học sinh ${reviewTarget.studentName} có thể xem và làm các đề riêng đã phát hành cho lớp.`
                  : reviewTarget.action === 'REVOKED'
                    ? `Sau khi thu hồi, học sinh ${reviewTarget.studentName} mất quyền truy cập đề riêng của lớp (vẫn làm được đề công khai).`
                    : `Học sinh ${reviewTarget.studentName} chưa được tham gia lớp.`}
              </p>

              <div>
                <Label htmlFor="rev-note">Ghi chú phản hồi (tùy chọn)</Label>
                <Textarea
                  id="rev-note"
                  rows={3}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Nhập lý do hoặc ghi chú cho học sinh..."
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={reviewMutation.isPending}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant={reviewTarget.action === 'APPROVED' ? 'teal' : 'destructive'}
                  disabled={reviewMutation.isPending}
                >
                  {reviewMutation.isPending
                    ? 'Đang xử lý...'
                    : reviewTarget.action === 'APPROVED'
                      ? 'Xác nhận duyệt'
                      : reviewTarget.action === 'REVOKED'
                        ? 'Xác nhận thu hồi'
                        : 'Xác nhận từ chối'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isEditClassOpen && (
        <Dialog open onOpenChange={(open) => { if (!open && !updateClassMutation.isPending) setIsEditClassOpen(false) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thiết lập lớp học & Mật khẩu tham gia</DialogTitle>
            </DialogHeader>
            <form
              noValidate
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                setClassFormError('')
                const nextFieldErrors = {}
                const trimmedName = classNameInput.trim()
                const trimmedCode = classCodeInput.trim().toUpperCase()
                const trimmedPass = classPasswordInput.trim()

                if (!trimmedName) {
                  nextFieldErrors.name = 'Tên lớp không được để trống'
                } else if (trimmedName.length > 100) {
                  nextFieldErrors.name = 'Tên lớp không được vượt quá 100 ký tự'
                }

                if (!trimmedCode) {
                  nextFieldErrors.classCode = 'Mã lớp không được để trống'
                } else if (trimmedCode.length > 50) {
                  nextFieldErrors.classCode = 'Mã lớp không được vượt quá 50 ký tự'
                }

                if (!classData?.hasPassword && !trimmedPass) {
                  nextFieldErrors.joinPassword = 'Vui lòng nhập mật khẩu lớp mới để mở lớp cho học sinh tham gia.'
                } else if (trimmedPass === '123456') {
                  nextFieldErrors.joinPassword = 'Hãy đặt mật khẩu lớp khác mật khẩu mặc định cũ (123456).'
                } else if (trimmedPass) {
                  const bcryptCheck = validateBcryptPasswordLength(trimmedPass, { trim: true })
                  if (bcryptCheck !== true) {
                    nextFieldErrors.joinPassword = bcryptCheck
                  }
                }

                if (Object.keys(nextFieldErrors).length > 0) {
                  setClassFieldErrors(nextFieldErrors)
                  return
                }

                setClassFieldErrors({})
                updateClassMutation.mutate({
                  name: trimmedName,
                  classCode: trimmedCode,
                  password: trimmedPass || undefined,
                })
              }}
            >
              {classFormError && (
                <Alert variant="destructive">
                  <AlertDescription>{classFormError}</AlertDescription>
                </Alert>
              )}

              {!classData?.hasPassword && (
                <Alert variant="warning">
                  <AlertDescription className="text-xs">
                    Lớp học chưa mở tham gia. Hãy đặt mật khẩu lớp trước khi chia sẻ mã lớp cho học sinh.
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="cls-name">Tên lớp học</Label>
                <Input
                  id="cls-name"
                  required
                  aria-invalid={Boolean(classFieldErrors.name)}
                  value={classNameInput}
                  onChange={(e) => {
                    setClassNameInput(e.target.value)
                    if (classFieldErrors.name) setClassFieldErrors((prev) => ({ ...prev, name: undefined }))
                  }}
                  placeholder="VD: Lớp Toán 12A1"
                />
                <FieldError>{classFieldErrors.name}</FieldError>
              </div>

              <div>
                <Label htmlFor="cls-code">Mã tham gia lớp</Label>
                <Input
                  id="cls-code"
                  required
                  aria-invalid={Boolean(classFieldErrors.classCode)}
                  value={classCodeInput}
                  onChange={(e) => {
                    setClassCodeInput(e.target.value.toUpperCase())
                    if (classFieldErrors.classCode) setClassFieldErrors((prev) => ({ ...prev, classCode: undefined }))
                  }}
                  placeholder="VD: TOAN12A1"
                />
                <FieldError>{classFieldErrors.classCode}</FieldError>
              </div>

              <div>
                <Label htmlFor="cls-pass">
                  {classData?.hasPassword
                    ? 'Mật khẩu mới (để trống nếu giữ nguyên)'
                    : 'Mật khẩu lớp học (bắt buộc để mở lớp)'}
                </Label>
                <Input
                  ref={classPasswordRef}
                  id="cls-pass"
                  type="password"
                  required={!classData?.hasPassword}
                  aria-invalid={Boolean(classFieldErrors.joinPassword)}
                  value={classPasswordInput}
                  onChange={(e) => {
                    setClassPasswordInput(e.target.value)
                    if (classFieldErrors.joinPassword) setClassFieldErrors((prev) => ({ ...prev, joinPassword: undefined }))
                  }}
                  placeholder={classData?.hasPassword ? 'Nhập mật khẩu mới nếu muốn đổi' : 'Nhập mật khẩu lớp mới (khác 123456)'}
                />
                <FieldError>{classFieldErrors.joinPassword}</FieldError>
                <p className="mt-1 text-[11px] text-slate-500">Tối đa 72 byte UTF-8 (lưu ý tiếng Việt có dấu tốn 2–3 byte/ký tự).</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditClassOpen(false)} disabled={updateClassMutation.isPending}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={updateClassMutation.isPending}
                >
                  {updateClassMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
