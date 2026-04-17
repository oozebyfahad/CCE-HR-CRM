import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import TimesheetTab from '../employees/components/TimesheetTab'
import { Clock } from 'lucide-react'

export default function MyTime() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees, loading } = useFirebaseEmployees()

  const myEmployee = employees.find(e => e.email === currentUser?.email)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
        Loading your timesheet…
      </div>
    )
  }

  if (!myEmployee) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Clock size={24} className="text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium">Employee record not found</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Your account is not linked to an employee profile yet. Contact your HR manager.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-header">My Time</h2>
          <p className="page-sub">Track your hours and view your timesheet</p>
        </div>
      </div>
      <TimesheetTab emp={myEmployee} />
    </div>
  )
}
