import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/service'
import { FieldError } from '../components/UI'

export default function StudentRegisterPage() {
  const navigate = useNavigate()
  const [successData, setSuccessData] = useState(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      fullName: '',
    },
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
      setSuccessData(response)
    } catch (error) {
      if (error.fieldErrors) {
        Object.entries(error.fieldErrors).forEach(([field, msg]) => {
          setError(field, { message: msg })
        })
      } else {
        setError('root', { message: error.message || 'Đăng ký không thành công. Vui lòng kiểm tra lại.' })
      }
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-heading">
          <span className="eyebrow">HỌC SINH MỚI</span>
          <h1>Đăng ký tài khoản</h1>
          <p>Tạo tài khoản học sinh để tham gia làm bài thi trực tuyến.</p>
        </div>

        {successData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="alert" style={{ background: '#e4f3e9', borderColor: '#b3dcc0', color: '#1b633d' }}>
              <strong>Đăng ký thành công!</strong>
              <p style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>
                Tài khoản <strong>{successData.username}</strong> ({successData.fullName}) đã được khởi tạo.
                Bạn có thể đăng nhập ngay bây giờ để chọn giáo viên hướng dẫn và làm bài thi.
              </p>
            </div>
            <button
              type="button"
              className="button full"
              onClick={() => navigate('/dang-nhap?registered=1')}
            >
              Chuyển đến màn hình Đăng nhập
            </button>
          </div>
        ) : (
          <>
            {errors.root && (
              <div className="alert error" role="alert">
                {errors.root.message}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <label>
                Tên đăng nhập
                <input
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
              </label>
              <FieldError>{errors.username?.message}</FieldError>

              <label>
                Họ và tên
                <input
                  autoComplete="name"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  {...register('fullName', {
                    required: 'Vui lòng nhập họ và tên',
                    maxLength: { value: 100, message: 'Tối đa 100 ký tự' },
                  })}
                />
              </label>
              <FieldError>{errors.fullName?.message}</FieldError>

              <label>
                Email
                <input
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
              </label>
              <FieldError>{errors.email?.message}</FieldError>

              <label>
                Mật khẩu
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Tối thiểu 6 ký tự"
                  {...register('password', {
                    required: 'Vui lòng nhập mật khẩu',
                    minLength: { value: 6, message: 'Mật khẩu cần ít nhất 6 ký tự' },
                  })}
                />
              </label>
              <FieldError>{errors.password?.message}</FieldError>

              <button className="button full" disabled={isSubmitting} style={{ marginTop: '12px' }}>
                {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
              </button>
            </form>

            <div style={{ marginTop: '18px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <span className="subtext" style={{ fontSize: '0.9rem' }}>
                Đã có tài khoản?{' '}
                <Link to="/dang-nhap" style={{ fontWeight: 650 }}>
                  Đăng nhập
                </Link>
              </span>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
