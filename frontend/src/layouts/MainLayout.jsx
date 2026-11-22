import { Fragment, lazy, Suspense, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ClipboardCheck,
  Database,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Grid3X3,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquarePlus,
  UserCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { roleLabel } from '@/constants'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

const AssistantWidget = lazy(() => import('@/components/common/AssistantWidget'))

function buildBreadcrumbs(pathname, role) {
  const homePath = role === 'STUDENT' ? '/hoc-sinh/tong-quan' : '/'
  const homeLabel = 'Tổng quan'

  if (pathname === '/' || pathname === '/hoc-sinh/tong-quan') {
    return [{ label: homeLabel }]
  }

  const staticMap = {
    '/mon-hoc': 'Môn học',
    '/chuong': 'Chương bài',
    '/cau-hoi': 'Ngân hàng câu hỏi',
    '/ma-tran': 'Ma trận đề',
    '/de-thi': 'Đề thi & In ấn',
    '/giao-vien/duyet-hoc-sinh': 'Duyệt học sinh',
    '/giao-vien/cham-thi': 'Chấm tự luận',
    '/giao-vien/ket-qua': 'Theo dõi Kết quả',
    '/nguoi-dung': 'Người dùng',
    '/ket-qua': 'Kết quả',
    '/ho-so': 'Hồ sơ cá nhân',
    '/hoc-sinh/giao-vien': 'Lớp học & Giáo viên',
    '/hoc-sinh/gop-y': 'Góp ý & Đề xuất',
  }

  if (staticMap[pathname]) {
    return [{ label: homeLabel, to: homePath }, { label: staticMap[pathname] }]
  }

  if (pathname.startsWith('/ma-tran/')) {
    return [
      { label: homeLabel, to: homePath },
      { label: 'Ma trận đề', to: '/ma-tran' },
      { label: 'Chi tiết ma trận' },
    ]
  }
  if (pathname.startsWith('/de-thi/')) {
    return [
      { label: homeLabel, to: homePath },
      { label: 'Đề thi & In ấn', to: '/de-thi' },
      { label: 'Xem & In A4' },
    ]
  }
  if (pathname.startsWith('/hoc-sinh/lam-bai/')) {
    return [
      { label: homeLabel, to: homePath },
      { label: 'Phòng thi trực tuyến' },
    ]
  }
  if (pathname.startsWith('/hoc-sinh/ket-qua/')) {
    return [
      { label: homeLabel, to: homePath },
      { label: 'Kết quả bài thi' },
    ]
  }
  return [{ label: homeLabel, to: homePath }, { label: 'Bảng làm việc' }]
}

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const signOut = async () => {
    await logout()
    navigate('/dang-nhap', { replace: true })
  }

  const role = user?.role || 'TEACHER'

  const navItems = useMemo(() => {
    if (role === 'STUDENT') {
      return [
        { to: '/hoc-sinh/tong-quan', label: 'Tổng quan', icon: LayoutDashboard },
        { to: '/hoc-sinh/de-thi', label: 'Đề thi & Luyện tập', icon: FileText },
        { to: '/hoc-sinh/giao-vien', label: 'Lớp học & Giáo viên', icon: GraduationCap },
        { to: '/hoc-sinh/gop-y', label: 'Góp ý & Đề xuất', icon: MessageSquarePlus },
        { to: '/ho-so', label: 'Hồ sơ cá nhân', icon: UserCircle },
      ]
    }
    const items = [
      { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
      { to: '/mon-hoc', label: 'Môn học', icon: BookOpen },
      { to: '/chuong', label: 'Chương bài', icon: Layers },
      { to: '/cau-hoi', label: 'Ngân hàng câu hỏi', icon: Database },
      { to: '/ma-tran', label: 'Ma trận đề', icon: Grid3X3 },
      { to: '/de-thi', label: 'Đề thi & In ấn', icon: FileSpreadsheet },
    ]
    if (role === 'TEACHER') {
      items.push({ to: '/giao-vien/duyet-hoc-sinh', label: 'Duyệt học sinh', icon: UserCheck })
    }
    items.push({ to: '/giao-vien/cham-thi', label: 'Chấm tự luận', icon: ClipboardCheck })
    if (role === 'TEACHER') {
      items.push({ to: '/giao-vien/ket-qua', label: 'Theo dõi Kết quả', icon: FileBarChart2 })
    }
    if (role === 'ADMIN') {
      items.push({ to: '/ket-qua', label: 'Kết quả', icon: FileBarChart2 })
      items.push({ to: '/nguoi-dung', label: 'Người dùng', icon: Users })
    }
    items.push({ to: '/ho-so', label: 'Hồ sơ cá nhân', icon: UserCircle })
    return items
  }, [role])

  const breadcrumbs = useMemo(() => buildBreadcrumbs(location.pathname, role), [location.pathname, role])

  const initials = (user?.fullName || 'EM')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div className="app-shell flex min-h-screen bg-[#F8F7F4] text-slate-900" data-role={role.toLowerCase()}>

      <aside
        className={cn(
          'app-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#162032] text-slate-100 border-r border-slate-800 transition-transform duration-200 lg:static lg:translate-x-0 shrink-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
          <Link to={role === 'STUDENT' ? '/hoc-sinh/tong-quan' : '/'} className="flex items-center gap-3 min-w-0">
            <div className="grid h-9 w-9 shrink-0 grid-cols-2 gap-1 rounded-lg bg-indigo-600 p-2 shadow-xs">
              <span className="rounded-[2px] bg-white" />
              <span className="rounded-[2px] bg-indigo-200" />
              <span className="rounded-[2px] bg-teal-300" />
              <span className="rounded-[2px] bg-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-wide text-white">EXAM MATRIX</div>
              <div className="truncate text-[11px] font-medium text-slate-400">
                {role === 'STUDENT'
                  ? 'Cổng Luyện Thi'
                  : role === 'ADMIN'
                    ? 'Quản Trị Hệ Thống'
                    : 'Không Gian Giảng Dạy'}
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng thanh điều hướng"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#1E293B] text-white font-semibold ring-1 ring-indigo-500/40 shadow-xs'
                      : 'text-slate-300 hover:bg-[#1E293B]/60 hover:text-white'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0 text-indigo-300" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-800/80 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-[#1E293B]/80 p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600/90 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user?.fullName || 'Người dùng'}</div>
              <div className="truncate text-xs text-slate-400">{roleLabel(role)}</div>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          aria-label="Đóng menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="main-column flex min-w-0 flex-1 flex-col">
        <header className="app-topbar sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-xs sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Mở menu điều hướng"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden sm:inline-flex">
                  <BreadcrumbLink to="/landing">Giới thiệu</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:inline-flex" />
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1
                  return (
                    <Fragment key={`${crumb.label}-${idx}`}>
                      <BreadcrumbItem>
                        {isLast || !crumb.to ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink to={crumb.to}>{crumb.label}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-slate-900 leading-tight">{user?.fullName}</div>
              <div className="text-xs text-slate-500">{roleLabel(role)}</div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
              <span>Đăng xuất</span>
            </Button>
          </div>
        </header>

        <main className="main-content mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8" key={location.pathname}>
          <Outlet />
        </main>
      </div>
      <Suspense fallback={null}>
        <AssistantWidget />
      </Suspense>
    </div>
  )
}
