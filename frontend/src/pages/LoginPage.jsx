import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { api, isMockMode } from '@/api/service'
import { resolvePostLoginTarget } from '@/utils/authHelpers'
import { loadGoogleIdentityScript } from '@/utils/googleIdentity'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorState, FieldError, LoadingState } from '@/components/common/StateFeedback'
import { cn } from '@/lib/utils'

function getHostnameMismatchWarning() {
  if (typeof window === 'undefined') return ''
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
  if (!apiBase || !/^https?:\/\//i.test(apiBase)) return ''
  try {
    const apiHost = new URL(apiBase).hostname
    const pageHost = window.location.hostname
    const localHosts = new Set(['localhost', '127.0.0.1'])
    if (localHosts.has(apiHost) && localHosts.has(pageHost) && apiHost !== pageHost) {
      return `Trang đang mở tại ${pageHost} nhưng API cấu hình ở ${apiHost}. Hãy mở cùng hostname (ví dụ đều dùng localhost) để cookie xác thực Google hoạt động.`
    }
  } catch {
    return ''
  }
  return ''
}

export default function LoginPage() {
  const { user, login, loginWithGoogle, isAuthenticated, isChecking, authError, retrySession, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const fromPath = location.state?.from?.pathname

  const [roleChoice, setRoleChoice] = useState(() =>
    fromPath && !fromPath.startsWith('/hoc-sinh/') && fromPath !== '/dang-nhap' && fromPath !== '/ho-so'
      ? 'staff'
      : 'student'
  )

  const [googleState, setGoogleState] = useState({
    phase: 'idle',
    error: null,
    status: null,
  })
  const [legacyHighlight, setLegacyHighlight] = useState(false)
  const [challengeSeed, setChallengeSeed] = useState(0)

  const googleButtonRef = useRef(null)
  const googleVerifyingRef = useRef(false)
  const challengeSeqRef = useRef(0)
  const challengeQueueRef = useRef(Promise.resolve())
  const googleCallbackRef = useRef(null)
  const usernameInputRef = useRef(null)
  const [heroImgFailed, setHeroImgFailed] = useState(false)
  const hostnameWarning = getHostnameMismatchWarning()

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { username: '', password: '' },
  })
  const usernameRegister = register('username', { required: 'Vui lòng nhập tên đăng nhập' })

  useEffect(() => {
    document.title = 'Đăng nhập | Exam Matrix'
  }, [])

  const finishLoginRedirect = useCallback(
    (loggedUser) => {
      const target = resolvePostLoginTarget(loggedUser?.role, fromPath)
      navigate(target, { replace: true })
    },
    [fromPath, navigate]
  )

  const refreshGoogleChallenge = useCallback(() => {
    setChallengeSeed((current) => current + 1)
  }, [])

  useEffect(() => {
    googleCallbackRef.current = async (credentialResponse) => {
      const credential = credentialResponse?.credential
      if (!credential) {
        setGoogleState({
          phase: 'error',
          status: null,
          error: 'Chưa nhận được thông tin xác thực từ Google. Vui lòng thử lại.',
        })
        return
      }
      if (googleVerifyingRef.current) return
      googleVerifyingRef.current = true
      setGoogleState({ phase: 'verifying', status: null, error: null })
      try {
        const loggedUser = await loginWithGoogle(credential)
        finishLoginRedirect(loggedUser)
      } catch (error) {
        const status = error?.status ?? error?.response?.status ?? null
        if (status === 503) {
          setGoogleState({
            phase: 'unconfigured',
            status: 503,
            error: error?.message || 'Đăng nhập Google chưa được cấu hình. Vui lòng dùng tài khoản Exam Matrix bên dưới.',
          })
        } else {
          setGoogleState({
            phase: 'error',
            status,
            error: error?.message || 'Không thể đăng nhập bằng Google. Vui lòng thử lại.',
          })
          if (status === 401 || status === 409) {
            refreshGoogleChallenge()
          }
        }
      } finally {
        googleVerifyingRef.current = false
      }
    }
  }, [finishLoginRedirect, loginWithGoogle, refreshGoogleChallenge])

  useEffect(() => {
    if (roleChoice !== 'student' || isAuthenticated || isChecking) {
      return undefined
    }
    if (isMockMode) {
      setGoogleState({
        phase: 'unconfigured',
        status: 503,
        error: 'Chế độ mô phỏng không hỗ trợ Google Sign-In. Vui lòng dùng tài khoản mẫu hoặc đăng nhập tên đăng nhập/mật khẩu.',
      })
      return undefined
    }

    let cancelled = false
    const currentSeq = ++challengeSeqRef.current
    const container = googleButtonRef.current
    if (container) container.innerHTML = ''

    setGoogleState((prev) => ({
      phase: 'loading',
      status: prev.status === 401 || prev.status === 409 || prev.status === 423 ? prev.status : null,
      error: prev.status === 401 || prev.status === 409 || prev.status === 423 ? prev.error : null,
    }))

    let expiryTimer = null

    async function initGoogleButton() {
      try {

        const pendingChallenge = challengeQueueRef.current.then(() => {
          if (cancelled || currentSeq !== challengeSeqRef.current) return null
          return api.googleStudentChallenge()
        })
        challengeQueueRef.current = pendingChallenge.catch(() => {})
        const challenge = await pendingChallenge

        if (cancelled || currentSeq !== challengeSeqRef.current) return
        if (!challenge?.clientId || !challenge?.nonce) {
          throw new Error('Máy chủ không trả đầy đủ dữ liệu thử thách Google.')
        }
        const gisId = await loadGoogleIdentityScript()
        if (cancelled || currentSeq !== challengeSeqRef.current) return

        gisId.initialize({
          client_id: challenge.clientId,
          nonce: challenge.nonce,
          auto_select: false,
          callback: (response) => {
            if (!cancelled && currentSeq === challengeSeqRef.current) {
              googleCallbackRef.current?.(response)
            }
          },
        })

        const targetEl = googleButtonRef.current
        if (!targetEl) return
        targetEl.innerHTML = ''
        const measuredWidth = targetEl.parentElement?.clientWidth || window.innerWidth - 64
        const containerWidth = Math.max(200, Math.min(340, Math.floor(measuredWidth - 8)))
        gisId.renderButton(targetEl, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          locale: 'vi',
          width: containerWidth,
        })

        setGoogleState((prev) => ({
          phase: 'ready',
          status: prev.status === 401 || prev.status === 409 || prev.status === 423 ? prev.status : null,
          error: prev.status === 401 || prev.status === 409 || prev.status === 423 ? prev.error : null,
        }))

        expiryTimer = window.setTimeout(() => {
          if (!cancelled && !googleVerifyingRef.current) {
            refreshGoogleChallenge()
          }
        }, 4 * 60 * 1000 + 30 * 1000)
      } catch (error) {
        if (cancelled || currentSeq !== challengeSeqRef.current) return
        const status = error?.status ?? error?.response?.status ?? null
        if (status === 503) {
          setGoogleState({
            phase: 'unconfigured',
            status: 503,
            error: error?.message || 'Đăng nhập Google chưa được cấu hình.',
          })
          return
        }
        setGoogleState({
          phase: 'error',
          status,
          error: status === 401
            ? 'Máy chủ từ chối khởi tạo đăng nhập Google. Vui lòng liên hệ quản trị viên hoặc dùng tài khoản Exam Matrix.'
            : error?.message || 'Không thể khởi tạo đăng nhập Google. Vui lòng thử lại.',
        })
      }
    }

    initGoogleButton()

    return () => {
      cancelled = true
      if (expiryTimer) window.clearTimeout(expiryTimer)
      if (container) container.innerHTML = ''
    }
  }, [roleChoice, challengeSeed, isAuthenticated, isChecking, refreshGoogleChallenge])

  const switchRoleChoice = (nextRole) => {
    setRoleChoice(nextRole)
    clearErrors('root')
    setLegacyHighlight(false)
    if (nextRole === 'staff') {
      setGoogleState({ phase: 'idle', status: null, error: null })
    }
  }

  const focusLegacyLoginForm = () => {
    setLegacyHighlight(true)
    usernameInputRef.current?.focus()
    usernameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (isChecking) {
    return (
      <div className="mx-auto max-w-md py-20 px-4">
        <LoadingState label="Đang kiểm tra phiên đăng nhập..." />
      </div>
    )
  }

  if (authError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7F4] p-4">
        <div className="w-full max-w-md space-y-4">
          <ErrorState error={authError} onRetry={retrySession} />
          <div className="text-center">
            <Button variant="outline" onClick={logout}>
              Quay lại màn hình đăng nhập
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'STUDENT' ? '/hoc-sinh/tong-quan' : '/'} replace />
  }

  const submit = async (values) => {
    try {
      const loggedUser = await login(values)
      finishLoginRedirect(loggedUser)
    } catch (error) {
      setError('root', { message: error.message || 'Không thể đăng nhập' })
    }
  }

  const isStudentMode = roleChoice === 'student'

  return (
    <main className="grid min-h-screen bg-[#F8F7F4] lg:grid-cols-12">

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#162032] p-10 text-slate-100 lg:col-span-5 lg:flex">
        {!heroImgFailed && (
          <img
            src="/images/auth-hero-desk.jpg"
            alt="Bàn học biên soạn đề thi và tài liệu học tập"
            onError={() => setHeroImgFailed(true)}
            className="auth-hero-motion pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-70"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-slate-950/45"
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-9 w-9 grid-cols-2 gap-1 rounded-lg bg-indigo-600 p-2 shadow-sm">
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-indigo-200" />
            <span className="rounded-[2px] bg-teal-300" />
            <span className="rounded-[2px] bg-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-wide text-white">EXAM MATRIX</div>
            <div className="text-xs text-slate-300">Khảo thí &amp; ma trận đề thi</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-3">
          <div className="font-handwriting text-4xl font-bold leading-snug text-amber-200 drop-shadow-xs">
            Học sâu, thi vững.
          </div>
          <h2 className="text-2xl font-bold leading-snug text-white">
            Hệ thống hỗ trợ tổng hợp ngân hàng câu hỏi, sinh ma trận đề và tổ chức thi, khảo thí
          </h2>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-slate-300">
          <ShieldCheck className="h-4 w-4 text-teal-300 shrink-0" />
          <span>Phân quyền riêng biệt cho Quản trị viên, Giáo viên và Học sinh</span>
        </div>
      </aside>

      <section className="flex min-w-0 flex-col items-center justify-center overflow-x-hidden px-4 py-6 sm:px-8 sm:py-10 lg:col-span-7">
        <div className="w-full max-w-md min-w-0 space-y-5">

          <div className="relative overflow-hidden rounded-2xl bg-[#162032] p-4 text-white lg:hidden">
            {!heroImgFailed && (
              <img
                src="/images/auth-hero-desk.jpg"
                alt="Bàn học biên soạn đề thi"
                onError={() => setHeroImgFailed(true)}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-55"
              />
            )}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/45" />
            <div className="relative z-10 flex items-center justify-between gap-2">
              <Link to="/landing" className="flex items-center gap-2 font-bold text-white">
                <div className="grid h-8 w-8 shrink-0 grid-cols-2 gap-1 rounded-lg bg-indigo-600 p-1.5">
                  <span className="rounded-[2px] bg-white" />
                  <span className="rounded-[2px] bg-indigo-200" />
                  <span className="rounded-[2px] bg-teal-300" />
                  <span className="rounded-[2px] bg-white" />
                </div>
                <span className="text-sm font-extrabold tracking-wide">EXAM MATRIX</span>
              </Link>
              <Link to="/landing" className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-200 hover:text-white">
                Trang giới thiệu
              </Link>
            </div>
            <div className="relative z-10 mt-3">
              <div className="font-handwriting text-2xl font-bold text-amber-200">Học sâu, thi vững.</div>
              <p className="mt-0.5 text-xs text-slate-200">
                Hệ thống hỗ trợ tổng hợp ngân hàng câu hỏi, sinh ma trận đề và tổ chức thi, khảo thí
              </p>
            </div>
          </div>

          <div className="auth-card-border-shell rounded-2xl p-[1.5px] shadow-md">
            <Card className="min-w-0 max-w-full overflow-hidden rounded-[14.5px] border-0 bg-white shadow-none">
              <CardContent className="min-w-0 space-y-5 p-5 sm:p-8">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Đăng nhập hệ thống</h1>
                </div>

              <div
                role="group"
                aria-label="Chọn đối tượng đăng nhập"
                className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1"
              >
                <button
                  type="button"
                  aria-pressed={isStudentMode}
                  onClick={() => switchRoleChoice('student')}
                  className={cn(
                    'flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer',
                    isStudentMode
                      ? 'bg-white text-teal-800 shadow-xs ring-1 ring-teal-600/30'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <GraduationCap className="h-4 w-4 shrink-0" />
                  <span>Học sinh</span>
                </button>
                <button
                  type="button"
                  aria-pressed={!isStudentMode}
                  onClick={() => switchRoleChoice('staff')}
                  className={cn(
                    'flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer',
                    !isStudentMode
                      ? 'bg-white text-indigo-800 shadow-xs ring-1 ring-indigo-600/30'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Giáo viên / QT</span>
                </button>
              </div>

              {searchParams.get('expired') && (
                <Alert variant="warning">
                  <AlertDescription>Phiên làm việc đã hết hạn hoặc cần xác thực lại. Vui lòng đăng nhập lại.</AlertDescription>
                </Alert>
              )}

              {searchParams.get('passwordChanged') && (
                <Alert variant="success">
                  <AlertDescription>Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.</AlertDescription>
                </Alert>
              )}

              {searchParams.get('registered') && (
                <Alert variant="success">
                  <AlertDescription>Đăng ký tài khoản thành công. Vui lòng đăng nhập để tiếp tục.</AlertDescription>
                </Alert>
              )}

              {isStudentMode && (
                <section aria-label="Đăng nhập học sinh bằng Google" className="min-w-0 max-w-full overflow-hidden space-y-3 rounded-xl border border-teal-200/80 bg-teal-50/40 p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Đăng nhập nhanh cho học sinh</h2>
                      <p className="text-xs text-slate-600">
                        Học sinh dùng Google lần đầu sẽ được tạo tài khoản học sinh tự động.
                      </p>
                    </div>
                    {googleState.phase === 'ready' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-slate-600"
                        onClick={() => {
                          setGoogleState({ phase: 'loading', status: null, error: null })
                          refreshGoogleChallenge()
                        }}
                        title="Làm mới phiên xác thực Google"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Làm mới
                      </Button>
                    )}
                  </div>

                  {hostnameWarning && (
                    <Alert variant="warning">
                      <AlertDescription className="text-xs">{hostnameWarning}</AlertDescription>
                    </Alert>
                  )}

                  {googleState.phase === 'unconfigured' && (
                    <Alert variant="info">
                      <AlertDescription className="text-xs">
                        {googleState.error || 'Đăng nhập Google chưa được cấu hình.'} Hãy sử dụng tài khoản Exam Matrix bên dưới.
                      </AlertDescription>
                    </Alert>
                  )}

                  {googleState.error && googleState.phase !== 'unconfigured' && (
                    <Alert variant="destructive">
                      <AlertDescription className="space-y-2 text-xs">
                        <p>{googleState.error}</p>
                        <div className="flex flex-wrap gap-2">
                          {googleState.status === 409 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 bg-white text-xs"
                              onClick={focusLegacyLoginForm}
                            >
                              Đăng nhập bằng tài khoản hiện có
                            </Button>
                          )}
                          {(googleState.phase === 'error' || googleState.status === 401) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 bg-white text-xs"
                              onClick={() => {
                                setGoogleState({ phase: 'loading', status: null, error: null })
                                refreshGoogleChallenge()
                              }}
                            >
                              <RefreshCw className="h-3 w-3" />
                              Thử lại bằng challenge mới
                            </Button>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {googleState.phase === 'verifying' && (
                    <div className="rounded-lg border border-teal-200 bg-white px-3 py-2.5 text-center text-xs font-semibold text-teal-800" role="status">
                      Đang xác thực tài khoản Google với máy chủ...
                    </div>
                  )}

                  {googleState.phase === 'loading' && (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center text-xs text-slate-600" role="status">
                      Đang chuẩn bị nút đăng nhập Google...
                    </div>
                  )}

                  <div
                    className={cn(
                      'flex min-h-[44px] w-full min-w-0 max-w-full items-center justify-center overflow-hidden',
                      (googleState.phase === 'unconfigured' || googleState.phase === 'verifying') && 'hidden'
                    )}
                  >
                    <div ref={googleButtonRef} className="max-w-full overflow-hidden" />
                  </div>
                </section>
              )}

              {isStudentMode && (
                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="mx-3 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Hoặc tài khoản Exam Matrix
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>
              )}

              <div
                className={cn(
                  'space-y-4 rounded-xl transition-colors',
                  legacyHighlight && 'ring-2 ring-teal-500/70 bg-teal-50/30 p-3 -m-3'
                )}
              >
                {errors.root && (
                  <Alert variant="destructive">
                    <AlertDescription>{errors.root.message}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
                  <div>
                    <Label htmlFor="login-username">Tên đăng nhập</Label>
                    <Input
                      id="login-username"
                      autoFocus={!isStudentMode}
                      autoComplete="username"
                      placeholder={isStudentMode ? 'Nhập tên đăng nhập học sinh' : 'Nhập tên đăng nhập giáo viên / admin'}
                      {...usernameRegister}
                      ref={(el) => {
                        usernameRegister.ref(el)
                        usernameInputRef.current = el
                      }}
                    />
                    <FieldError>{errors.username?.message}</FieldError>
                  </div>

                  <div>
                    <Label htmlFor="login-password">Mật khẩu</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu"
                      {...register('password', { required: 'Vui lòng nhập mật khẩu' })}
                    />
                    <FieldError>{errors.password?.message}</FieldError>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    variant={isStudentMode ? 'teal' : 'default'}
                    className="w-full"
                    disabled={isSubmitting || googleState.phase === 'verifying'}
                  >
                    {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập bằng mật khẩu'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </div>

              {isMockMode && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Tài khoản giả lập (Chế độ Mock)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRoleChoice('staff')
                        setValue('username', 'admin', { shouldValidate: true })
                        setValue('password', 'admin123', { shouldValidate: true })
                      }}
                    >
                      Admin
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRoleChoice('staff')
                        setValue('username', 'teacher', { shouldValidate: true })
                        setValue('password', 'teacher123', { shouldValidate: true })
                      }}
                    >
                      Teacher
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRoleChoice('student')
                        setValue('username', 'student', { shouldValidate: true })
                        setValue('password', 'student123', { shouldValidate: true })
                      }}
                    >
                      Student
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                {isStudentMode ? (
                  <span className="leading-snug">
                    Chưa có tài khoản?{' '}
                    <Link to="/dang-ky-hoc-sinh" className="whitespace-nowrap font-semibold text-teal-700 hover:underline">
                      Đăng ký học sinh
                    </Link>
                  </span>
                ) : (
                  <span className="text-xs leading-snug text-slate-600">
                    Tài khoản giáo viên và quản trị viên do hệ thống cấp
                  </span>
                )}
                <Link to="/landing" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-slate-500 hover:text-slate-900">
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  <span>Trang giới thiệu</span>
                </Link>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
