import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import { AdminRoute, ProtectedRoute, StudentRoute, TeacherOrAdminRoute } from './routes/Guards'
import { useAuth } from './auth/AuthContext'
import LoginPage from './pages/LoginPage'
import StudentRegisterPage from './pages/StudentRegisterPage'
import DashboardPage from './pages/DashboardPage'
import SubjectsPage from './pages/SubjectsPage'
import ChaptersPage from './pages/ChaptersPage'
import QuestionsPage from './pages/QuestionsPage'
import MatricesPage, { MatrixDetailPage } from './pages/MatricesPage'
import PapersPage, { PaperDetailPage } from './pages/PapersPage'
import UsersPage from './pages/UsersPage'
import ProfilePage from './pages/ProfilePage'
import StudentTeacherPage from './pages/StudentTeacherPage'
import StudentExamsPage from './pages/StudentExamsPage'
import StudentExamTakingPage from './pages/StudentExamTakingPage'
import StudentResultPage from './pages/StudentResultPage'
import TeacherGradingPage from './pages/TeacherGradingPage'
import TeacherStudentRequestsPage from './pages/TeacherStudentRequestsPage'
import { ForbiddenPage, NotFoundPage } from './pages/StatusPages'

function HomeRoute() {
  const { user } = useAuth()
  if (user?.role === 'STUDENT') {
    return <Navigate to="/hoc-sinh/de-thi" replace />
  }
  return <DashboardPage />
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route path="/dang-ky-hoc-sinh" element={<StudentRegisterPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<HomeRoute />} />

          {/* Teacher and Admin routes */}
          <Route element={<TeacherOrAdminRoute />}>
            <Route path="mon-hoc" element={<SubjectsPage />} />
            <Route path="chuong" element={<ChaptersPage />} />
            <Route path="cau-hoi" element={<QuestionsPage />} />
            <Route path="ma-tran" element={<MatricesPage />} />
            <Route path="ma-tran/:id" element={<MatrixDetailPage />} />
            <Route path="de-thi" element={<PapersPage />} />
            <Route path="de-thi/:id" element={<PaperDetailPage />} />
            <Route path="giao-vien/duyet-hoc-sinh" element={<TeacherStudentRequestsPage />} />
            <Route path="giao-vien/cham-thi" element={<TeacherGradingPage />} />
          </Route>

          {/* Admin only route */}
          <Route element={<AdminRoute />}>
            <Route path="nguoi-dung" element={<UsersPage />} />
          </Route>

          {/* Student only routes */}
          <Route element={<StudentRoute />}>
            <Route path="hoc-sinh/giao-vien" element={<StudentTeacherPage />} />
            <Route path="hoc-sinh/de-thi" element={<StudentExamsPage />} />
            <Route path="hoc-sinh/lam-bai/:paperId" element={<StudentExamTakingPage />} />
            <Route path="hoc-sinh/ket-qua/:attemptId" element={<StudentResultPage />} />
          </Route>

          {/* Common routes */}
          <Route path="ho-so" element={<ProfilePage />} />
        </Route>

        <Route path="403" element={<ForbiddenPage />} />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  )
}
