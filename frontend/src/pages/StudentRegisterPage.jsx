import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, GraduationCap } from 'lucide-react'
import { api } from '@/api/service'
import { validateBcryptPasswordLength } from '@/utils/passwordValidation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/common/StateFeedback'

export default function StudentRegisterPage() {
  const navigate = useNavigate()
  const [successData, setSuccessData] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { username: '', email: '', password: '', fullName: '' },
  })

  useEffect(() => {
    document.title = 'Đăng ký học sinh | Exam Matrix'
  }, [])

  const onSubmit = async (values) => {
    try {
      const response = await api.registerStudent({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
        fullName: values.fullName.trim(),
      })
      setSuccessData(response?.user || response)
    } catch (error) {
      if (error.fieldErrors && Object.keys(error.fieldErrors).length) {
        Object.entries(error.fieldErrors).forEach(([field, msg]) => {
          setError(field, { message: msg })
        })
      } else {
        setError('root', {
          message: error.message || 'Đăng ký không thành công. Vui lòng kiểm tra lại.',
        })
      }
    }
  }

  return (
    <main className="grid min-h-screen bg-[#F8F7F4] lg:grid-cols-12">
      <aside className="hidden flex-col justify-between bg-[#162032] p-10 text-slate-100 lg:col-span-5 lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 grid-cols-2 gap-1 rounded-lg bg-teal-600 p-2">
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-teal-200" />
            <span className="rounded-[2px] bg-indigo-300" />
            <span className="rounded-[2px] bg-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-wide text-white">EXAM MATRIX</div>
            <div className="text-xs text-slate-400">Cổng luyện thi học sinh</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-200">
            <GraduationCap className="h-3.5 w-3.5" />
            Tài khoản học sinh
          </div>
          <h2 className="text-3xl font-extrabold leading-tight text-white">
            Tham gia lớp học, luyện đề trực tuyến và theo dõi kết quả chi tiết.
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Sau khi đăng ký, bạn có thể làm ngay các bài thi công khai hoặc nhập mã lớp từ giáo viên để mở khóa đề thi dành riêng cho lớp.
          </p>
        </div>

        <div className="text-xs text-slate-400">
          Vai trò học sinh được gán tự động theo chính sách hệ thống.
        </div>
      </aside>

      <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-8 lg:col-span-7">
        <div className="w-full max-w-md">
          <Card className="border-slate-200/90 shadow-sm">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div className="space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-widest text-teal-700">
                  Học sinh mới
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900">Đăng ký tài khoản</h1>
                <p className="text-sm text-slate-600">
                  Tạo tài khoản học sinh để bắt đầu làm bài kiểm tra trực tuyến.
                </p>
              </div>

              {successData ? (
                <div className="space-y-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-emerald-950">Đăng ký thành công</h2>
                      <p className="text-xs text-emerald-800">Tài khoản học sinh đã sẵn sàng sử dụng.</p>
                    </div>
                  </div>

                  <dl className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Tên đăng nhập</dt>
                      <dd className="font-semibold text-slate-900">{successData.username}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Họ và tên</dt>
                      <dd className="font-semibold text-slate-900">{successData.fullName}</dd>
                    </div>
                    {successData.email && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Email</dt>
                        <dd className="font-semibold text-slate-900">{successData.email}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Vai trò</dt>
                      <dd className="font-semibold text-teal-700">Học sinh</dd>
                    </div>
                  </dl>

                  <Button className="w-full" size="lg" onClick={() => navigate('/dang-nhap?registered=1')}>
                    Chuyển đến Đăng nhập
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  {errors.root && (
                    <Alert variant="destructive">
                      <AlertDescription>{errors.root.message}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                    <div>
                      <Label htmlFor="reg-username">Tên đăng nhập</Label>
                      <Input
                        id="reg-username"
                        autoFocus
                        autoComplete="username"
                        placeholder="Ví dụ: student01"
                        {...register('username', {
                          required: 'Vui lòng nhập tên đăng nhập',
                          minLength: { value: 3, message: 'Tối thiểu 3 ký tự' },
                          maxLength: { value: 50, message: 'Tối đa 50 ký tự' },
                          pattern: {
                            value: /^[a-zA-Z0-9_.-]+$/,
                            message: 'Chỉ chấp nhận chữ cái, số, dấu gạch dưới, gạch ngang, chấm',
                          },
                        })}
                      />
                      <FieldError>{errors.username?.message}</FieldError>
                    </div>

                    <div>
                      <Label htmlFor="reg-fullname">Họ và tên</Label>
                      <Input
                        id="reg-fullname"
                        autoComplete="name"
                        placeholder="Ví dụ: Nguyễn Văn An"
                        {...register('fullName', {
                          required: 'Vui lòng nhập họ và tên',
                          maxLength: { value: 100, message: 'Tối đa 100 ký tự' },
                        })}
                      />
                      <FieldError>{errors.fullName?.message}</FieldError>
                    </div>

                    <div>
                      <Label htmlFor="reg-email">Email</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        placeholder="student01@example.com"
                        {...register('email', {
                          required: 'Vui lòng nhập email',
                          pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                            message: 'Địa chỉ email không đúng định dạng',
                          },
                          maxLength: { value: 100, message: 'Tối đa 100 ký tự' },
                        })}
                      />
                      <FieldError>{errors.email?.message}</FieldError>
                    </div>

                    <div>
                      <Label htmlFor="reg-password">Mật khẩu</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Tối thiểu 6 ký tự"
                        {...register('password', {
                          required: 'Vui lòng nhập mật khẩu',
                          minLength: { value: 6, message: 'Mật khẩu cần ít nhất 6 ký tự' },
                          validate: (value) => validateBcryptPasswordLength(value),
                        })}
                      />
                      <FieldError>{errors.password?.message}</FieldError>
                      <p className="mt-1 text-[11px] text-slate-500">Tối đa 72 byte UTF-8 (tiếng Việt có dấu tốn 2–3 byte/ký tự).</p>
                    </div>

                    <Button type="submit" variant="teal" size="lg" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
                    </Button>
                  </form>

                  <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Đã có tài khoản?{' '}
                      <Link to="/dang-nhap" className="font-semibold text-indigo-700 hover:underline">
                        Đăng nhập
                      </Link>
                    </span>
                    <Link to="/landing" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Trang giới thiệu
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
