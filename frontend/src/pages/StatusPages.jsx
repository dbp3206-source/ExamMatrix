import { Link } from 'react-router-dom'
import { FileQuestion, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  const { user } = useAuth()
  const home = user?.role === 'STUDENT' ? '/hoc-sinh/de-thi' : '/'
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7F4] p-6">
      <div className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-rose-700">Lỗi 403</div>
        <h1 className="text-2xl font-extrabold text-slate-900">Không có quyền truy cập</h1>
        <p className="text-sm text-slate-600">Tài khoản của bạn không được phép mở trang này.</p>
        <Button asChild>
          <Link to={home}>Về trang chính</Link>
        </Button>
      </div>
    </main>
  )
}

export function NotFoundPage() {
  const { user } = useAuth()
  const home = user?.role === 'STUDENT' ? '/hoc-sinh/de-thi' : '/'
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7F4] p-6">
      <div className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <FileQuestion className="h-6 w-6" />
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Lỗi 404</div>
        <h1 className="text-2xl font-extrabold text-slate-900">Không tìm thấy trang</h1>
        <p className="text-sm text-slate-600">Địa chỉ bạn truy cập không tồn tại hoặc đã được thay đổi.</p>
        <Button asChild>
          <Link to={home}>Về trang chính</Link>
        </Button>
      </div>
    </main>
  )
}
