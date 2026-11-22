import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { isContentAdminRole, isUserManagerRole } from '@/constants'
import { ErrorState, LoadingState } from '@/components/common/StateFeedback'
import { Button } from '@/components/ui/button'

export function ProtectedRoute() {
  const { isAuthenticated, isChecking, authError, retrySession, logout } = useAuth()
  const location = useLocation()

  if (isChecking) {
    return (
      <div className="mx-auto max-w-md py-20 px-4">
        <LoadingState label="Đang kiểm tra phiên đăng nhập..." />
      </div>
    )
  }

  if (authError) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 px-4 text-center">
        <ErrorState error={authError} onRetry={retrySession} />
        <Button variant="outline" onClick={logout}>
          Về đăng nhập
        </Button>
      </div>
    )
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/dang-nhap" replace state={{ from: location }} />
}

export function AdminRoute() {
  const { user } = useAuth()
  return user?.role === 'ADMIN' ? <Outlet /> : <Navigate to="/403" replace />
}

export function ContentAdminRoute() {
  const { user } = useAuth()
  return isContentAdminRole(user?.role) ? <Outlet /> : <Navigate to="/403" replace />
}

export function UserManagerRoute() {
  const { user } = useAuth()
  return isUserManagerRole(user?.role) ? <Outlet /> : <Navigate to="/403" replace />
}

export function TeacherOnlyRoute() {
  const { user } = useAuth()
  return user?.role === 'TEACHER' ? <Outlet /> : <Navigate to="/403" replace />
}

export function TeacherOrAdminRoute() {
  const { user } = useAuth()
  return user?.role === 'TEACHER' || isContentAdminRole(user?.role)
    ? <Outlet />
    : <Navigate to="/403" replace />
}

export function StudentRoute() {
  const { user } = useAuth()
  return user?.role === 'STUDENT' ? <Outlet /> : <Navigate to="/403" replace />
}
