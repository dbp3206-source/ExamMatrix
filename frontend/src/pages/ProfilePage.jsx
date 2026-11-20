import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/service'
import { useAuth } from '@/auth/AuthContext'
import { roleLabel } from '@/constants'
import { validateBcryptPasswordLength } from '@/utils/passwordValidation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, PageHeader } from '@/components/common/StateFeedback'

function getInitials(fullName) {
  const trimmed = fullName?.trim()
  if (!trimmed) return 'U'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ProfilePage() {
  const { user, updateLocalUser, clearSessionOnly } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Hồ sơ cá nhân | Exam Matrix'
  }, [])

  const profile = useForm({
    defaultValues: {
      fullName: user?.fullName || '',
      email: user?.email || '',
    },
  })

  const password = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const update = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (next) => {
      updateLocalUser(next)
      profile.reset({ fullName: next.fullName, email: next.email })
      toast.success('Đã cập nhật hồ sơ')
    },
    onError: (error) => {
      Object.entries(error.fieldErrors || {}).forEach(([name, message]) => profile.setError(name, { message }))
      if (!error.fieldErrors || !Object.keys(error.fieldErrors).length) {
        profile.setError('root', { message: error.message || 'Không thể cập nhật hồ sơ' })
      }
    },
  })

  const change = useMutation({
    mutationFn: api.changePassword,
    onSuccess: async () => {
      password.reset()
      toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.')
      await clearSessionOnly()
      navigate('/dang-nhap?passwordChanged=1', { replace: true })
    },
    onError: (error) => {
      if (error.status === 409) {
        password.setError('root', {
          message: error.message || 'Tài khoản này đăng nhập bằng Google và không có mật khẩu Exam Matrix để đổi.',
        })
        return
      }
      Object.entries(error.fieldErrors || {}).forEach(([name, message]) => password.setError(name, { message }))
      if (!error.fieldErrors || !Object.keys(error.fieldErrors).length) {
        password.setError('root', { message: error.message || 'Không thể đổi mật khẩu' })
      }
    },
  })

  const changePassword = (values) => {
    if (values.newPassword !== values.confirmPassword) {
      return password.setError('confirmPassword', { message: 'Mật khẩu xác nhận không khớp' })
    }
    change.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
  }

  const roleVariant = user?.role === 'ADMIN' ? 'amber' : user?.role === 'STUDENT' ? 'teal' : 'indigo'

  return (
    <div className="space-y-6">
      <PageHeader
        accent="indigo"
        eyebrow="TÀI KHOẢN & BẢO MẬT"
        title="Hồ sơ cá nhân"
        description="Cập nhật thông tin liên hệ và mật khẩu đăng nhập của bạn."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Thông tin tài khoản</CardTitle>
              <CardDescription>Quản lý họ tên hiển thị và email liên hệ.</CardDescription>
            </div>
            <Badge variant={roleVariant}>{roleLabel(user?.role)}</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#162032] text-sm font-extrabold text-white">
                {getInitials(user?.fullName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-slate-900">{user?.fullName || user?.username}</div>
                <div className="text-xs text-slate-500">
                  @{user?.username} · {roleLabel(user?.role)}
                </div>
              </div>
            </div>

            <form onSubmit={profile.handleSubmit((values) => update.mutate(values))} noValidate className="space-y-4">
              {profile.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertDescription>{profile.formState.errors.root.message}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="prof-username">Tên đăng nhập</Label>
                <Input id="prof-username" value={user?.username || ''} disabled readOnly />
              </div>

              <div>
                <Label htmlFor="prof-fullname">Họ và tên</Label>
                <Input
                  id="prof-fullname"
                  maxLength={100}
                  {...profile.register('fullName', { required: 'Họ tên là bắt buộc' })}
                />
                <FieldError>{profile.formState.errors.fullName?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="prof-email">Email</Label>
                <Input
                  id="prof-email"
                  type="email"
                  {...profile.register('email', {
                    required: 'Email là bắt buộc',
                    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email không hợp lệ' },
                  })}
                />
                <FieldError>{profile.formState.errors.email?.message}</FieldError>
              </div>

              <Button type="submit" disabled={update.isPending}>
                <Save className="h-4 w-4" />
                {update.isPending ? 'Đang lưu...' : 'Cập nhật hồ sơ'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Đổi mật khẩu</CardTitle>
            <CardDescription>Mật khẩu mới cần tối thiểu 8 ký tự.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={password.handleSubmit(changePassword)} noValidate className="space-y-4">
              {password.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertDescription>{password.formState.errors.root.message}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="pw-current">Mật khẩu hiện tại</Label>
                <Input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  {...password.register('currentPassword', { required: 'Vui lòng nhập mật khẩu hiện tại' })}
                />
                <FieldError>{password.formState.errors.currentPassword?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="pw-new">Mật khẩu mới</Label>
                <Input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  {...password.register('newPassword', {
                    required: 'Vui lòng nhập mật khẩu mới',
                    minLength: { value: 8, message: 'Mật khẩu cần ít nhất 8 ký tự' },
                    validate: (value) => validateBcryptPasswordLength(value),
                  })}
                />
                <FieldError>{password.formState.errors.newPassword?.message}</FieldError>
                <p className="mt-1 text-[11px] text-slate-500">Tối đa 72 byte UTF-8 (tiếng Việt có dấu tốn 2–3 byte/ký tự).</p>
              </div>

              <div>
                <Label htmlFor="pw-confirm">Xác nhận mật khẩu mới</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  {...password.register('confirmPassword', { required: 'Vui lòng xác nhận mật khẩu' })}
                />
                <FieldError>{password.formState.errors.confirmPassword?.message}</FieldError>
              </div>

              <Button type="submit" variant="outline" disabled={change.isPending}>
                <KeyRound className="h-4 w-4" />
                {change.isPending ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
