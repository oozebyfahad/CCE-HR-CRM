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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppSelector(s => s.auth)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
        <Route path="dashboard"    element={<HRDashboard />} />
        <Route path="employees"    element={<EmployeeList />} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="my-time"      element={<MyTime />} />
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
