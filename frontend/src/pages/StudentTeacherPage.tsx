import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  GraduationCap,
  KeyRound,
  Lock,
  Unlock,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { requestStatusMeta } from '@/constants'
import { formatDateTime } from '@/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common/StateFeedback'

interface DiscoverableClassItem {
  classId: string
  className: string
  classCode: string
  teacherId: string
  teacherName: string
  joinMode: 'CLOSED' | 'REQUEST_OPEN' | 'REQUEST_WITH_PASSWORD'
  requiresPassword: boolean
  studentCount: number
}

interface AssignmentItem {
  id: string
  teacherId: string
  teacherName: string
  teacherEmail?: string
  className?: string
  classCode?: string
  status: string
  requestedAt?: string
  reviewedAt?: string
  decisionNote?: string
}

interface DiscoveryResponse {
  activeAssignment: AssignmentItem | null
  pendingAssignment: AssignmentItem | null
  latestAssignment: AssignmentItem | null
  history: AssignmentItem[]
  availableClasses: DiscoverableClassItem[]
}

export default function StudentTeacherPage() {
  const queryClient = useQueryClient()
  const [manualCode, setManualCode] = useState('')
  const [manualPassword, setManualPassword] = useState('')
  const [selectedClass, setSelectedClass] = useState<DiscoverableClassItem | null>(null)
  const [modalPassword, setModalPassword] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    document.title = 'Lớp học & Giáo viên | Exam Matrix'
  }, [])

  const discoveryQuery = useQuery<DiscoveryResponse>({
    queryKey: ['student', 'class-discovery'],
    queryFn: () => api.getStudentClassDiscovery(),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })

  const joinMutation = useMutation({
    mutationFn: (payload: { classCode?: string; teacherId?: string; password?: string }) =>
      api.createTeacherRequest(payload),
    onSuccess: (res: AssignmentItem) => {
      toast.success(
        res?.status === 'APPROVED'
          ? 'Bạn đã ở trong lớp học này.'
          : 'Đã gửi yêu cầu tham gia lớp học (chờ giáo viên duyệt).'
      )
      setSelectedClass(null)
      setModalPassword('')
      setManualCode('')
      setManualPassword('')
      setFormError('')
      queryClient.invalidateQueries({ queryKey: ['student', 'class-discovery'] })
      queryClient.invalidateQueries({ queryKey: ['student', 'exams'] })
      queryClient.invalidateQueries({ queryKey: ['student', 'exam-subjects'] })
    },
    onError: (err: Error) => {
      const msg = err?.message || 'Không thể gửi yêu cầu tham gia lớp học'
      setFormError(msg)
      toast.error(msg)
    },
  })

  if (discoveryQuery.isPending) {
    return <LoadingState label="Đang tải thông tin lớp học..." />
  }
  if (discoveryQuery.isError) {
    return <ErrorState error={discoveryQuery.error} onRetry={discoveryQuery.refetch} />
  }

  const data = discoveryQuery.data
  const active = data?.activeAssignment || null
  const pending = data?.pendingAssignment || null
  const availableClasses = data?.availableClasses || []
  const history = data?.history || []

  const openJoinModal = (cls: DiscoverableClassItem) => {
    setFormError('')
    setModalPassword('')
    setSelectedClass(cls)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) {
      setFormError('Vui lòng nhập mã lớp.')
      return
    }
    setFormError('')
    joinMutation.mutate({
      classCode: manualCode.trim().toUpperCase(),
      password: manualPassword.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6 pb-20" data-role="student">
      <PageHeader
        accent="teal"
        title="Khám phá & Tham gia lớp học"
        description="Gửi yêu cầu tham gia hoặc chuyển lớp. Giáo viên duyệt xong bạn mới mở quyền làm đề thi lớp học."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/hoc-sinh/de-thi">
              Danh sách đề thi
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4 text-teal-700" />
              Lớp hiện tại của bạn
            </CardTitle>
          </CardHeader>
          <CardContent>
            {active ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-bold text-slate-900">{active.className || 'Lớp học'}</div>
                    <div className="text-xs text-slate-600">
                      Giáo viên: <strong>{active.teacherName}</strong> · Mã lớp: <code className="font-semibold">{active.classCode}</code>
                    </div>
                  </div>
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" />
                    Đã duyệt
                  </Badge>
                </div>
                {active.reviewedAt && (
                  <p className="text-xs text-slate-500">
                    Được duyệt lúc {formatDateTime(active.reviewedAt)}. Bạn có thể gửi yêu cầu chuyển lớp khác nếu cần; lớp hiện tại vẫn giữ hiệu lực cho tới khi lớp mới duyệt.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Bạn chưa tham gia lớp học nào. Chọn một lớp bên dưới hoặc nhập mã lớp để gửi yêu cầu.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={pending ? 'border-amber-300 bg-amber-50/40 shadow-xs' : 'border-slate-200 shadow-xs'}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-600" />
              Yêu cầu đang chờ duyệt
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {pending.className || 'Lớp học'} ({pending.classCode})
                    </div>
                    <div className="text-xs text-slate-600">Giáo viên: {pending.teacherName}</div>
                  </div>
                  <Badge variant="warning">Đang chờ duyệt</Badge>
                </div>
                <p className="text-xs text-amber-900">
                  {active
                    ? 'Đây là yêu cầu chuyển lớp. Quyền truy cập lớp cũ vẫn giữ nguyên cho đến khi giáo viên lớp mới phê duyệt.'
                    : 'Yêu cầu đã được gửi tới giáo viên. Sau khi được duyệt, các đề thi lớp học sẽ tự động mở.'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Không có yêu cầu nào đang chờ xử lý. Bạn có thể gửi tối đa 1 yêu cầu tham gia hoặc chuyển lớp tại một thời điểm.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Danh mục lớp đang mở nhận yêu cầu ({availableClasses.length})</h2>
        </div>

        {availableClasses.length === 0 ? (
          <EmptyState
            title="Chưa có lớp nào mở nhận yêu cầu"
            description="Khi giáo viên mở lớp (Lớp mở hoặc Lớp có mật khẩu), lớp sẽ hiển thị tại đây."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableClasses.map((cls) => {
              const isCurrentActive = active?.classCode === cls.classCode
              const isCurrentPending = pending?.classCode === cls.classCode
              const blockedByOtherPending = Boolean(pending && !isCurrentPending)
              return (
                <Card key={cls.classId} className="border-slate-200 shadow-xs flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base text-slate-900">{cls.className}</CardTitle>
                        <CardDescription className="mt-0.5 text-xs">
                          GV: {cls.teacherName}
                        </CardDescription>
                      </div>
                      {cls.requiresPassword ? (
                        <Badge variant="warning" className="shrink-0">
                          <Lock className="h-3 w-3" />
                          Có mật khẩu
                        </Badge>
                      ) : (
                        <Badge variant="success" className="shrink-0">
                          <Unlock className="h-3 w-3" />
                          Lớp mở
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Mã lớp: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800">{cls.classCode}</code></span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {cls.studentCount} HS
                      </span>
                    </div>

                    {isCurrentActive ? (
                      <Button size="sm" variant="outline" disabled className="w-full">
                        Đang học lớp này
                      </Button>
                    ) : isCurrentPending ? (
                      <Button size="sm" variant="outline" disabled className="w-full">
                        Đang chờ duyệt
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="teal"
                        className="w-full"
                        disabled={blockedByOtherPending || joinMutation.isPending}
                        onClick={() => openJoinModal(cls)}
                      >
                        {active ? 'Gửi yêu cầu chuyển lớp' : 'Gửi yêu cầu tham gia'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-indigo-600" />
            Tham gia nhanh bằng mã lớp
          </CardTitle>
          <CardDescription className="text-xs">
            Nhập mã lớp do giáo viên cung cấp (kèm mật khẩu nếu lớp yêu cầu). Yêu cầu sẽ chuyển sang trạng thái chờ giáo viên duyệt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <div>
              <Label htmlFor="manual-class-code">Mã lớp</Label>
              <Input
                id="manual-class-code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="VD: TOAN12A1"
                disabled={Boolean(pending) || joinMutation.isPending}
              />
            </div>
            <div>
              <Label htmlFor="manual-class-pw">Mật khẩu lớp (nếu có)</Label>
              <Input
                id="manual-class-pw"
                type="password"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="Để trống nếu là lớp mở"
                disabled={Boolean(pending) || joinMutation.isPending}
              />
            </div>
            <Button type="submit" variant="teal" disabled={Boolean(pending) || joinMutation.isPending}>
              {joinMutation.isPending ? 'Đang gửi...' : active ? 'Gửi yêu cầu chuyển lớp' : 'Gửi yêu cầu tham gia'}
            </Button>
          </form>
          {formError && !selectedClass && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription className="text-xs">{formError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lịch sử yêu cầu lớp học</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {history.map((item) => {
                const meta = requestStatusMeta(item.status)
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {item.className || 'Lớp học'} {item.classCode ? `(${item.classCode})` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        GV: {item.teacherName} · Gửi lúc {formatDateTime(item.requestedAt)}
                        {item.decisionNote ? ` · ${item.decisionNote}` : ''}
                      </div>
                    </div>
                    <Badge variant={meta.tone || 'neutral'}>{meta.label}</Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedClass && (
        <Dialog open onOpenChange={(open) => { if (!open && !joinMutation.isPending) setSelectedClass(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {active ? `Chuyển sang lớp ${selectedClass.className}` : `Tham gia lớp ${selectedClass.className}`}
              </DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (selectedClass.requiresPassword && !modalPassword.trim()) {
                  setFormError('Vui lòng nhập mật khẩu lớp học.')
                  return
                }
                setFormError('')
                joinMutation.mutate({
                  classCode: selectedClass.classCode,
                  teacherId: selectedClass.teacherId,
                  password: selectedClass.requiresPassword ? modalPassword.trim() : undefined,
                })
              }}
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                <div><strong>Giáo viên:</strong> {selectedClass.teacherName}</div>
                <div><strong>Mã lớp:</strong> <code>{selectedClass.classCode}</code></div>
                <div>
                  <strong>Chế độ:</strong>{' '}
                  {selectedClass.requiresPassword ? 'Yêu cầu mật khẩu & chờ giáo viên duyệt' : 'Lớp mở (chờ giáo viên duyệt)'}
                </div>
              </div>

              {selectedClass.requiresPassword && (
                <div>
                  <Label htmlFor="modal-join-password">Mật khẩu lớp học</Label>
                  <Input
                    id="modal-join-password"
                    type="password"
                    autoFocus
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    placeholder="Nhập mật khẩu do giáo viên cung cấp"
                  />
                </div>
              )}

              {formError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{formError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelectedClass(null)} disabled={joinMutation.isPending}>
                  Hủy
                </Button>
                <Button type="submit" variant="teal" disabled={joinMutation.isPending}>
                  {joinMutation.isPending ? 'Đang gửi...' : 'Xác nhận gửi yêu cầu'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
