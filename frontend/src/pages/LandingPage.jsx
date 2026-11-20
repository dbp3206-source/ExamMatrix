import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CheckCircle2, FileSpreadsheet, Grid3X3, ShieldCheck, UserCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { roleLabel } from '@/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BlurText } from '@/components/react-bits/BlurText'

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  const workspacePath = user?.role === 'STUDENT' ? '/hoc-sinh/de-thi' : '/'

  useEffect(() => {
    document.title = 'Exam Matrix · Ngân hàng câu hỏi & Ma trận đề thi'
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-slate-900">

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link className="flex items-center gap-2.5 font-extrabold tracking-tight text-slate-900" to="/landing">
            <div className="grid h-8 w-8 grid-cols-2 gap-1 rounded-lg bg-[#162032] p-1.5">
              <span className="rounded-[2px] bg-white" />
              <span className="rounded-[2px] bg-indigo-300" />
              <span className="rounded-[2px] bg-teal-300" />
              <span className="rounded-[2px] bg-white" />
            </div>
            <span className="text-base">Exam Matrix</span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-5" aria-label="Điều hướng trang giới thiệu">
            <a href="#quy-trinh" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline">
              Quy trình
            </a>
            <a href="#vai-tro" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline">
              Vai trò
            </a>
            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link to={workspacePath}>Vào không gian · {roleLabel(user?.role)}</Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/dang-nhap">Đăng nhập</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:items-center lg:py-16">
        <div className="space-y-5 lg:col-span-6">
          <div className="font-handwriting text-3xl font-bold text-indigo-700 sm:text-4xl">
            Học sâu, thi vững.
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12]">
            <BlurText text="Từ câu hỏi chuẩn hóa đến mã đề sẵn sàng sử dụng" />
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-slate-600">
            Soạn ngân hàng câu hỏi, phân bổ ma trận, tổ chức thi trực tuyến và chấm điểm thang 10 trong một quy trình khép kín.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {isAuthenticated ? (
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to={workspacePath}>
                  Tiếp tục với vai trò {roleLabel(user?.role)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link to="/dang-nhap">
                    Đăng nhập hệ thống
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link to="/dang-ky-hoc-sinh">Đăng ký học sinh</Link>
                </Button>
              </>
            )}
          </div>

          <div className="grid max-w-md grid-cols-3 gap-4 border-t border-slate-200 pt-6">
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">04</div>
              <div className="text-xs font-medium text-slate-600">Kiểu câu hỏi</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">03</div>
              <div className="text-xs font-medium text-slate-600">Mức độ khó</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">1–20</div>
              <div className="text-xs font-medium text-slate-600">Mã đề mỗi lượt</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#162032] shadow-md">
            <img
              src="/images/auth-hero-desk.jpg"
              alt="Bàn học biên soạn đề thi và ma trận kiểm tra"
              className="auth-hero-motion aspect-[16/10] w-full object-cover object-center"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-5 text-white">
              <div className="text-xs font-semibold text-amber-200">Không gian khảo thí thống nhất</div>
              <div className="mt-1 text-sm text-slate-100">
                Ngân hàng câu hỏi · Ma trận 3 mức độ · In A4 tách đáp án · Chấm thang 10
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="quy-trinh" className="border-t border-slate-200/80 bg-white py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 max-w-2xl space-y-2">
            <div className="text-xs font-semibold text-indigo-700">Quy trình nghiệp vụ</div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Mỗi bước tạo dữ liệu chuẩn cho bước tiếp theo</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: BookOpen,
                tone: 'bg-teal-50 text-teal-800 border-teal-200',
                title: 'Tổ chức học liệu',
                desc: 'Quản lý môn, chương và 4 kiểu câu hỏi (1 đáp án, nhiều đáp án, đúng/sai, tự luận) theo 3 mức độ.',
              },
              {
                icon: Grid3X3,
                tone: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                title: 'Cấu hình ma trận',
                desc: 'Chọn môn học, loại đề trắc nghiệm hoặc tự luận, thời lượng và số lượng câu theo từng chương.',
              },
              {
                icon: FileSpreadsheet,
                tone: 'bg-amber-50 text-amber-900 border-amber-200',
                title: 'Sinh và phát hành đề',
                desc: 'Kiểm tra khả dụng trước khi sinh 1–20 mã đề, thiết lập công khai hoặc riêng tư và in chuẩn A4.',
              },
              {
                icon: CheckCircle2,
                tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                title: 'Làm bài & Đánh giá',
                desc: 'Học sinh làm 1 lượt mỗi đề với tự động lưu; giáo viên chấm tự luận theo barem và nhận xét.',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} className="border-slate-200">
                  <CardContent className="space-y-3 p-5">
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${item.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">{item.desc}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section id="vai-tro" className="border-t border-slate-200/80 bg-[#F8F7F4] py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 max-w-2xl space-y-2">
            <div className="text-xs font-bold uppercase tracking-widest text-teal-700">Ba vai trò · Một hệ thống</div>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Phân quyền rõ ràng theo trách nhiệm.</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Card className="border-slate-200">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#162032] text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Quản trị viên</h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Quản trị tài khoản và trạng thái truy cập; quản lý danh mục môn học, chương bài và giám sát dữ liệu ngân hàng.
                  </p>
                </div>
                <Link to={isAuthenticated ? workspacePath : '/dang-nhap'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline">
                  {isAuthenticated ? 'Mở không gian làm việc' : 'Đăng nhập'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-700 text-white">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Giáo viên</h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Soạn hoặc nhập câu hỏi, thiết lập ma trận, sinh và in mã đề, quản lý lớp học và chấm bài tự luận.
                  </p>
                </div>
                <Link to={isAuthenticated ? workspacePath : '/dang-nhap'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline">
                  {isAuthenticated ? 'Mở không gian làm việc' : 'Đăng nhập'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-700 text-white">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Học sinh</h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Tham gia lớp bằng mã lớp, làm đề công khai hoặc đề lớp học, theo dõi tiến độ chấm và xem nhận xét.
                  </p>
                </div>
                <Link to={isAuthenticated ? workspacePath : '/dang-ky-hoc-sinh'} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline">
                  {isAuthenticated ? 'Mở đề thi của tôi' : 'Đăng ký học sinh'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-slate-600 sm:px-6">
          <span className="font-semibold text-slate-900">Exam Matrix</span>
          <span>Hệ thống quản lý ngân hàng câu hỏi, ma trận đề thi và đánh giá trực tuyến.</span>
          {!isAuthenticated && (
            <Link to="/dang-nhap" className="font-semibold text-indigo-700 hover:underline">
              Đăng nhập
            </Link>
          )}
        </div>
      </footer>
    </div>
  )
}
