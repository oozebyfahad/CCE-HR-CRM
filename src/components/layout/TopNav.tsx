import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, ChevronDown, Check, Building2, LogOut } from 'lucide-react'
import { useAppSelector, useAppDispatch } from '../../store'
import { logout } from '../../store/slices/authSlice'
import { setCurrentOrg } from '../../store/slices/orgSlice'
import { useFirebaseOrgs } from '../../hooks/useFirebaseOrgs'
import NotificationBell from '../common/NotificationBell'
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
  const dispatch   = useAppDispatch()
  const user       = useAppSelector(s => s.auth.user)
  const currentOrg = useAppSelector(s => s.org.currentOrg)
  const { pathname } = useLocation()
  const { orgs }   = useFirebaseOrgs()

  const [showUser,    setShowUser]    = useState(false)
  const [showOrgList, setShowOrgList] = useState(false)

  const title    = PAGE_TITLES[pathname] ?? 'HR Management'
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'HR'

  const isAdmin = user?.role === 'admin'

  const handleSwitchOrg = (org: Parameters<typeof setCurrentOrg>[0]) => {
    dispatch(setCurrentOrg(org))
    setShowOrgList(false)
    setShowUser(false)
  }

  const handleLogout = () => {
    dispatch(logout())
    setShowUser(false)
  }

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
        <NotificationBell />

        {/* User */}
        <div className="relative">
          <button
            onClick={() => { setShowUser(v => !v); setShowOrgList(false) }}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-secondary leading-tight">{user?.name ?? 'HR Manager'}</p>
              <p className="text-[10px] text-gray-400 leading-tight capitalize">
                {currentOrg ? currentOrg.name : 'CabCall Experts'}
              </p>
            </div>
            <ChevronDown size={12} className="text-gray-400" />
          </button>

          {showUser && (
            <div className="absolute right-0 top-11 w-64 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
              {/* User header */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-secondary">{user?.name ?? 'HR Manager'}</p>
                <p className="text-[11px] text-gray-400 capitalize mt-0.5">
                  {user?.role?.replace(/_/g, ' ') ?? 'Administrator'}
                </p>
              </div>

              {/* Org switcher (admin only) */}
              {isAdmin && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Organization</p>

                  {/* Current org display */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 size={12} className="text-primary shrink-0" />
                      <span className="text-xs font-semibold text-secondary truncate">
                        {currentOrg?.name ?? 'CabCall Experts'}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowOrgList(v => !v)}
                      className="text-[10px] text-primary hover:underline font-semibold shrink-0"
                    >
                      {showOrgList ? 'Close' : 'Switch'}
                    </button>
                  </div>

                  {/* Org list */}
                  {showOrgList && (
                    <div className="mt-2 space-y-0.5">
                      <button
                        onClick={() => handleSwitchOrg(null)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left',
                          !currentOrg ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <Building2 size={11} className="shrink-0" />
                        <span className="flex-1 truncate">CabCall Experts</span>
                        {!currentOrg && <Check size={10} className="shrink-0" />}
                      </button>

                      {orgs.map(org => (
                        <button
                          key={org.id}
                          onClick={() => handleSwitchOrg(org)}
                          className={cn(
                            'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left',
                            currentOrg?.id === org.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
                          )}
                        >
                          <Building2 size={11} className="shrink-0" />
                          <span className="flex-1 truncate">{org.name}</span>
                          {currentOrg?.id === org.id && <Check size={10} className="shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sign out */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors font-semibold"
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {showUser && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowUser(false); setShowOrgList(false) }} />
      )}
    </header>
  )
}
