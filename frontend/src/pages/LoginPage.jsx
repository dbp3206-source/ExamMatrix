import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ErrorState, FieldError, LoadingState } from '../components/UI'
import { isMockMode } from '../api/service'

export default function LoginPage() {
  const { user, login, isAuthenticated, isChecking, authError, retrySession, logout } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const [searchParams] = useSearchParams()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ defaultValues: { username: '', password: '' } })
  useEffect(() => { document.title = 'Đăng nhập | Exam Matrix' }, [])
  if (isChecking) return <LoadingState label="Đang kiểm tra phiên đăng nhập..." />
  if (authError) return <><ErrorState error={authError} onRetry={retrySession} /><button className="button secondary" onClick={logout}>Về đăng nhập</button></>
  if (isAuthenticated) return <Navigate to={user?.role === 'STUDENT' ? '/hoc-sinh/de-thi' : '/'} replace />
  const submit = async (values) => {
    try {
      const loggedUser = await login(values)
      const target = location.state?.from?.pathname || (loggedUser?.role === 'STUDENT' ? '/hoc-sinh/de-thi' : '/')
      navigate(target, { replace: true })
    } catch (error) {
      setError('root', { message: error.message || 'Không thể đăng nhập' })
    }
  }
  return <main className="login-page"><section className="login-panel"><div className="login-heading"><span className="eyebrow">HỆ THỐNG QUẢN LÝ GIÁO DỤC</span><h1>Đăng nhập Exam Matrix</h1><p>Quản lý ngân hàng câu hỏi, cấu hình ma trận và sinh đề thi.</p></div>
    {searchParams.get('expired') && <div className="alert warning">Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.</div>}
    {searchParams.get('registered') && <div className="alert" style={{ background: '#e4f3e9', borderColor: '#b3dcc0', color: '#1b633d' }}>Đăng ký tài khoản thành công! Vui lòng đăng nhập để tiếp tục.</div>}
    {errors.root && <div className="alert error" role="alert">{errors.root.message}</div>}
    <form onSubmit={handleSubmit(submit)} noValidate>
      <label>Tên đăng nhập<input autoFocus autoComplete="username" {...register('username', { required: 'Vui lòng nhập tên đăng nhập' })} /></label><FieldError>{errors.username?.message}</FieldError>
      <label>Mật khẩu<input type="password" autoComplete="current-password" {...register('password', { required: 'Vui lòng nhập mật khẩu' })} /></label><FieldError>{errors.password?.message}</FieldError>
      <button className="button full" disabled={isSubmitting}>{isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
    </form>
    <div style={{ marginTop: '18px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
      <span className="subtext" style={{ fontSize: '0.9rem' }}>
        Bạn là học sinh? <Link to="/dang-ky-hoc-sinh" style={{ fontWeight: 650 }}>Đăng ký tài khoản mới</Link>
      </span>
    </div>
    {isMockMode && <div className="demo-accounts"><strong>Tài khoản dùng thử</strong><span>Quản trị: admin / admin123</span><span>Giáo viên: teacher / teacher123</span><span>Học sinh: student / student123</span></div>}
  </section></main>
}
