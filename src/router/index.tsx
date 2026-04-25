import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from '../store'
import Layout      from '../components/layout/Layout'
import Login       from '../pages/auth/Login'
import ApplyForm   from '../pages/apply/ApplyForm'
import HRDashboard from '../pages/dashboard/HRDashboard'
import EmployeeList    from '../pages/employees/EmployeeList'
import EmployeeProfile from '../pages/employees/EmployeeProfile'
import Attendance      from '../pages/attendance/Attendance'
import LeaveManagement from '../pages/leave/LeaveManagement'
import Performance     from '../pages/performance/Performance'
import Recruitment     from '../pages/recruitment/Recruitment'
import Training        from '../pages/training/Training'
import Disciplinary    from '../pages/disciplinary/Disciplinary'
import Payroll         from '../pages/payroll/Payroll'
import Reports         from '../pages/reports/Reports'
import Settings        from '../pages/settings/Settings'
import MyTime          from '../pages/my-time/MyTime'
import Shifts          from '../pages/shifts/Shifts'
import Advances        from '../pages/advances/Advances'
import Compliance      from '../pages/compliance/Compliance'
import MyLeave         from '../pages/portal/MyLeave'
import MyAttendance    from '../pages/portal/MyAttendance'
import MyProfile       from '../pages/portal/MyProfile'
import MyPayslips      from '../pages/portal/MyPayslips'
import MyRequests      from '../pages/portal/MyRequests'
import MyAdvance       from '../pages/portal/MyAdvance'
import MyDocuments     from '../pages/portal/MyDocuments'
import MyTraining      from '../pages/portal/MyTraining'
import Noticeboard     from '../pages/portal/Noticeboard'
import Grievance       from '../pages/portal/Grievance'
import RequestLetter   from '../pages/portal/RequestLetter'
import MyOvertime      from '../pages/portal/MyOvertime'
import MyDisciplinary  from '../pages/portal/MyDisciplinary'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppSelector(s => s.auth)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function EmployeeRoute({ children }: { children: React.ReactNode }) {
  const user = useAppSelector(s => s.auth.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'employee') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/apply" element={<ApplyForm />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"      element={<HRDashboard />} />
        <Route path="employees"      element={<EmployeeList />} />
        <Route path="employees/:id"  element={<EmployeeProfile />} />
        <Route path="my-time"        element={<MyTime />} />

        {/* ── Employee portal routes ── */}
        <Route path="my-leave"       element={<EmployeeRoute><MyLeave /></EmployeeRoute>} />
        <Route path="my-attendance"  element={<EmployeeRoute><MyAttendance /></EmployeeRoute>} />
        <Route path="my-profile"     element={<EmployeeRoute><MyProfile /></EmployeeRoute>} />
        <Route path="my-payslips"    element={<EmployeeRoute><MyPayslips /></EmployeeRoute>} />
        <Route path="my-requests"    element={<EmployeeRoute><MyRequests /></EmployeeRoute>} />
        <Route path="my-advance"     element={<EmployeeRoute><MyAdvance /></EmployeeRoute>} />
        <Route path="my-documents"   element={<EmployeeRoute><MyDocuments /></EmployeeRoute>} />
        <Route path="my-training"    element={<EmployeeRoute><MyTraining /></EmployeeRoute>} />
        <Route path="noticeboard"    element={<EmployeeRoute><Noticeboard /></EmployeeRoute>} />
        <Route path="grievance"      element={<EmployeeRoute><Grievance /></EmployeeRoute>} />
        <Route path="request-letter" element={<EmployeeRoute><RequestLetter /></EmployeeRoute>} />
        <Route path="my-overtime"      element={<EmployeeRoute><MyOvertime /></EmployeeRoute>} />
        <Route path="my-disciplinary" element={<EmployeeRoute><MyDisciplinary /></EmployeeRoute>} />

        {/* ── HR / Admin routes ── */}
        <Route path="attendance"   element={<Attendance />} />
        <Route path="leave"        element={<LeaveManagement />} />
        <Route path="performance"  element={<Performance />} />
        <Route path="recruitment"  element={<Recruitment />} />
        <Route path="training"     element={<Training />} />
        <Route path="disciplinary" element={<Disciplinary />} />
        <Route path="payroll"      element={<Payroll />} />
        <Route path="shifts"       element={<Shifts />} />
        <Route path="advances"     element={<Advances />} />
        <Route path="compliance"   element={<Compliance />} />
        <Route path="reports"      element={<Reports />} />
        <Route path="settings"     element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
