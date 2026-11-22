import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import {
  ContentAdminRoute,
  ProtectedRoute,
  StudentRoute,
  TeacherOnlyRoute,
  TeacherOrAdminRoute,
  UserManagerRoute,
} from '@/routes/Guards'
import { useAuth } from '@/auth/AuthContext'
import { LoadingState } from '@/components/common/StateFeedback'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const StudentRegisterPage = lazy(() => import('@/pages/StudentRegisterPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const StudentDashboardPage = lazy(() => import('@/pages/StudentDashboardPage'))
const SubjectsPage = lazy(() => import('@/pages/SubjectsPage'))
const ChaptersPage = lazy(() => import('@/pages/ChaptersPage'))
const QuestionsPage = lazy(() => import('@/pages/QuestionsPage'))
const MatricesPage = lazy(() => import('@/pages/MatricesPage'))
const MatrixDetailPage = lazy(() => import('@/pages/MatricesPage').then((m) => ({ default: m.MatrixDetailPage })))
const PapersPage = lazy(() => import('@/pages/PapersPage'))
const PaperDetailPage = lazy(() => import('@/pages/PapersPage').then((m) => ({ default: m.PaperDetailPage })))
const TeacherStudentRequestsPage = lazy(() => import('@/pages/TeacherStudentRequestsPage'))
const TeacherGradingPage = lazy(() => import('@/pages/TeacherGradingPage'))
const TeacherResultsPage = lazy(() => import('@/pages/TeacherResultsPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))
const AdminResultsPage = lazy(() => import('@/pages/AdminResultsPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const StudentTeacherPage = lazy(() => import('@/pages/StudentTeacherPage'))
const StudentFeedbackPage = lazy(() => import('@/pages/StudentFeedbackPage'))
const StudentExamsPage = lazy(() => import('@/pages/StudentExamsPage'))
const StudentExamTakingPage = lazy(() => import('@/pages/StudentExamTakingPage'))
const StudentResultPage = lazy(() => import('@/pages/StudentResultPage'))
const ForbiddenPage = lazy(() => import('@/pages/StatusPages').then((m) => ({ default: m.ForbiddenPage })))
const NotFoundPage = lazy(() => import('@/pages/StatusPages').then((m) => ({ default: m.NotFoundPage })))

function HomeRoute() {
  const { user } = useAuth()
  if (user?.role === 'STUDENT') {
    return <Navigate to="/hoc-sinh/tong-quan" replace />
  }
  if (user?.role === 'USER_ADMIN') {
    return <Navigate to="/403" replace />
  }
  return <DashboardPage />
}

function PageFallback() {
  return (
    <div className="mx-auto max-w-2xl py-16 px-4">
      <LoadingState label="Đang tải trang..." />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>

        <Route path="/landing" element={<LandingPage />} />
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky-hoc-sinh" element={<StudentRegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<HomeRoute />} />

            <Route element={<TeacherOrAdminRoute />}>
              <Route path="mon-hoc" element={<SubjectsPage />} />
              <Route path="chuong" element={<ChaptersPage />} />
              <Route path="cau-hoi" element={<QuestionsPage />} />
              <Route path="ma-tran" element={<MatricesPage />} />
              <Route path="ma-tran/:id" element={<MatrixDetailPage />} />
              <Route path="de-thi" element={<PapersPage />} />
              <Route path="de-thi/:id" element={<PaperDetailPage />} />
              <Route path="giao-vien/phan-tich" element={<Navigate to="/" replace />} />
              <Route path="giao-vien/cham-thi" element={<TeacherGradingPage />} />
              <Route path="giao-vien/ket-qua" element={<TeacherResultsPage />} />
            </Route>

            <Route element={<TeacherOnlyRoute />}>
              <Route path="giao-vien/duyet-hoc-sinh" element={<TeacherStudentRequestsPage />} />
            </Route>

            <Route element={<ContentAdminRoute />}>
              <Route path="ket-qua" element={<AdminResultsPage />} />
            </Route>

            <Route element={<UserManagerRoute />}>
              <Route path="nguoi-dung" element={<UsersPage />} />
            </Route>

            <Route element={<StudentRoute />}>
              <Route path="hoc-sinh/tong-quan" element={<StudentDashboardPage />} />
              <Route path="hoc-sinh/giao-vien" element={<StudentTeacherPage />} />
              <Route path="hoc-sinh/gop-y" element={<StudentFeedbackPage />} />
              <Route path="hoc-sinh/de-thi" element={<StudentExamsPage />} />
              <Route path="hoc-sinh/lam-bai/:paperId" element={<StudentExamTakingPage />} />
              <Route path="hoc-sinh/ket-qua/:attemptId" element={<StudentResultPage />} />
            </Route>

            <Route path="ho-so" element={<ProfilePage />} />
          </Route>

          <Route path="403" element={<ForbiddenPage />} />
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  )
}
