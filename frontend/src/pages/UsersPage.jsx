import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus, Search, Unlock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { useAuth } from '@/auth/AuthContext'
import { roleLabel } from '@/constants'
import { formatDate } from '@/utils'
import { validateBcryptPasswordLength } from '@/utils/passwordValidation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { EmptyState, ErrorState, FieldError, LoadingState, PageHeader, Pagination } from '@/components/common/StateFeedback'

function getInitials(fullName) {
  const trimmed = fullName?.trim()
  if (!trimmed) return 'U'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function UserFormDialog({ onClose }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: { username: '', fullName: '', email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Đã thêm tài khoản giáo viên mới thành công')
      onClose()
    },
    onError: (error) => {
      const fieldErrors = error.fieldErrors || error.response?.data?.fieldErrors || {}
      Object.entries(fieldErrors).forEach(([name, message]) => setError(name, { message }))
      if (!Object.keys(fieldErrors).length) {
        setError('root', { message: error.message || error.response?.data?.message || 'Không thể tạo tài khoản' })
      }
    },
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm tài khoản giáo viên bộ môn</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-4">
          {errors.root && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="u-username">Tên đăng nhập</Label>
              <Input
                id="u-username"
                autoComplete="off"
                maxLength={50}
                placeholder="VD: nguyen.van.a"
                {...register('username', {
                  required: 'Tên đăng nhập là bắt buộc',
                  pattern: {
                    value: /^[a-zA-Z0-9._-]+$/,
                    message: 'Chỉ dùng chữ cái, chữ số, dấu chấm, gạch ngang',
                  },
                })}
              />
              <FieldError>{errors.username?.message}</FieldError>
            </div>

            <div>
              <Label htmlFor="u-fullname">Họ và tên</Label>
              <Input
                id="u-fullname"
                maxLength={100}
                placeholder="VD: Nguyễn Văn A"
                {...register('fullName', { required: 'Họ tên là bắt buộc' })}
              />
              <FieldError>{errors.fullName?.message}</FieldError>
            </div>

            <div>
              <Label htmlFor="u-email">Địa chỉ Email</Label>
              <Input
                id="u-email"
                type="email"
                placeholder="VD: a.nguyen@truong.edu.vn"
                {...register('email', {
                  required: 'Email là bắt buộc',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Địa chỉ email không hợp lệ' },
                })}
              />
              <FieldError>{errors.email?.message}</FieldError>
            </div>

            <div>
              <Label htmlFor="u-password">Mật khẩu khởi tạo</Label>
              <Input
                id="u-password"
                type="password"
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                {...register('password', {
                  required: 'Mật khẩu là bắt buộc',
                  minLength: { value: 8, message: 'Mật khẩu cần ít nhất 8 ký tự' },
                  validate: (value) => validateBcryptPasswordLength(value),
                })}
              />
              <FieldError>{errors.password?.message}</FieldError>
              <p className="mt-1 text-[11px] text-slate-500">Tối đa 72 byte UTF-8.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function UsersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState({ search: '', role: '', status: '', page: 0, size: 10 })

  useEffect(() => {
    document.title = 'Quản lý người dùng | Exam Matrix'
  }, [])

  const users = useQuery({
    queryKey: ['users', filters],
    queryFn: () => api.getUsers(filters),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.updateUserStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(variables.status === 'LOCKED' ? 'Đã khóa quyền truy cập tài khoản' : 'Đã mở khóa tài khoản thành công')
    },
    onError: (error) => toast.error(error.message || 'Không thể cập nhật trạng thái'),
  })

  const setFilter = (name, value) =>
    setFilters((prev) => ({ ...prev, [name]: value, page: name === 'page' ? value : 0 }))

  const columns = useMemo(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Người dùng',
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white">
                {getInitials(item.fullName)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900">{item.fullName}</div>
                <div className="text-xs text-slate-500">{item.email}</div>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'username',
        header: 'Tên đăng nhập',
        cell: ({ row }) => <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">{row.original.username}</code>,
      },
      {
        accessorKey: 'role',
        header: 'Vai trò',
        cell: ({ row }) => {
          const r = row.original.role
          return (
            <Badge variant={r === 'ADMIN' ? 'amber' : r === 'TEACHER' ? 'indigo' : 'teal'}>
              {roleLabel(r)}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'ACTIVE' ? 'success' : 'danger'}>
            {row.original.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Ngày tạo',
        cell: ({ row }) => <span className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { headClassName: 'text-right', cellClassName: 'text-right' },
        cell: ({ row }) => {
          const item = row.original
          if (item.id === user?.id) {
            return <span className="text-xs font-medium text-slate-400">Tài khoản hiện tại</span>
          }
          return item.status === 'ACTIVE' ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: item.id, status: 'LOCKED' })}
            >
              <Lock className="h-3.5 w-3.5" />
              Khóa tài khoản
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: item.id, status: 'ACTIVE' })}
            >
              <Unlock className="h-3.5 w-3.5" />
              Mở khóa
            </Button>
          )
        },
      },
    ],
    [statusMutation, user?.id]
  )

  return (
    <div className="space-y-5">
      <PageHeader
        accent="indigo"
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Quản lý người dùng"
        description="Tạo tài khoản giáo viên mới và kiểm soát trạng thái truy cập hệ thống."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Thêm giáo viên
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs sm:grid-cols-3">
        <div>
          <Label htmlFor="u-search">Tìm kiếm</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="u-search"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="Tìm họ tên, tài khoản hoặc email..."
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="u-role">Vai trò</Label>
          <Select id="u-role" value={filters.role} onChange={(e) => setFilter('role', e.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value="ADMIN">Quản trị viên</option>
            <option value="TEACHER">Giáo viên bộ môn</option>
            <option value="STUDENT">Học sinh</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="u-status">Trạng thái</Label>
          <Select id="u-status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </Select>
        </div>
      </div>

      {users.isSuccess && (
        <div className="text-xs font-semibold text-slate-600 tabular-nums">
          {users.data.totalElements} tài khoản phù hợp
        </div>
      )}

      {users.isLoading ? (
        <LoadingState label="Đang tải danh sách người dùng..." />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={users.refetch} />
      ) : !users.data.content.length ? (
        <EmptyState title="Không tìm thấy người dùng phù hợp" description="Thử thay đổi từ khóa hoặc bộ lọc." />
      ) : (
        <>
          <DataTable columns={columns} data={users.data.content} getRowId={(r) => String(r.id)} />
          <Pagination page={users.data.page} totalPages={users.data.totalPages} onChange={(page) => setFilter('page', page)} />
        </>
      )}

      {open && <UserFormDialog onClose={() => setOpen(false)} />}
    </div>
  )
}
