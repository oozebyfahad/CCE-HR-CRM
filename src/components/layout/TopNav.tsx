import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Search, ChevronDown, Check } from 'lucide-react'
import { useAppSelector } from '../../store'
import { mockNotifications } from '../../utils/mockData'
import { cn } from '../../utils/cn'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/employees':    'Employees',
  '/attendance':   'Attendance',
  '/leave':        'Leave Management',
  '/performance':  'Performance',
  '/training':     'Training & Development',
  '/payroll':      'Payroll',
  '/recruitment':  'Recruitment',
  '/disciplinary': 'Disciplinary & Grievance',
  '/reports':      'Reports & Analytics',
  '/settings':     'Settings',
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
}

export default function TopNav() {
  const location   = useAppSelector(s => s.ui.sidebarCollapsed)
  const notifCount = useAppSelector(s => s.ui.notificationCount)
  const user       = useAppSelector(s => s.auth.user)
  const { pathname } = useLocation()

  const [showNotifs, setShowNotifs] = useState(false)
  const [showUser,   setShowUser]   = useState(false)

  const title    = PAGE_TITLES[pathname] ?? 'HR Management'
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'HR'

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 gap-4 sticky top-0 z-20 shadow-sm">
      {/* Left */}
      <div>
        <h1 className="text-lg font-semibold text-secondary leading-tight">{title}</h1>
        <p className="text-xs text-gray-400">{formatDate()}</p>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search employees..."
            className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(v => !v); setShowUser(false) }}
            className="relative w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <Bell size={16} className="text-gray-500" />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-11 w-80 bg-white border border-gray-100 rounded-xl shadow-modal z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-secondary">Notifications</span>
                <button className="text-xs text-primary hover:underline">Mark all read</button>
              </div>
              <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {mockNotifications.map(n => (
                  <div key={n.id} className={cn('px-4 py-3 flex gap-3', !n.read && 'bg-blue-50/40')}>
                    <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                      n.type === 'error'   ? 'bg-red-500'   :
                      n.type === 'warning' ? 'bg-amber-500' :
                      n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                    )} />
                    <div>
                      <p className="text-xs font-semibold text-secondary">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    </div>
                    {n.read && <Check size={12} className="text-gray-300 shrink-0 ml-auto mt-1" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => { setShowUser(v => !v); setShowNotifs(false) }}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-secondary leading-tight">{user?.name ?? 'HR Manager'}</p>
              <p className="text-[10px] text-gray-400 leading-tight capitalize">{user?.role?.replace(/_/g, ' ') ?? 'Administrator'}</p>
            </div>
            <ChevronDown size={12} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {(showNotifs || showUser) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifs(false); setShowUser(false) }} />
      )}
    </header>
  )
}
