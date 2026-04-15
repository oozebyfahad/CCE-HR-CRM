import { NavLink, useNavigate } from 'react-router-dom'
import cceLogo from '../../assets/CCE-Logo.png'
import {
  LayoutDashboard, Users, Clock, CalendarDays, TrendingUp,
  GraduationCap, Banknote, UserPlus, AlertTriangle, BarChart3,
  Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../store'
import { logout } from '../../store/slices/authSlice'
import { toggleSidebar } from '../../store/slices/uiSlice'
import { cn } from '../../utils/cn'
import type { UserRole } from '../../types'

const NAV: { path: string; label: string; Icon: React.ElementType; roles: UserRole[] }[] = [
  { path: '/dashboard',    label: 'Dashboard',       Icon: LayoutDashboard, roles: ['admin','hr','team_lead','employee'] },
  { path: '/employees',    label: 'Employees',        Icon: Users,           roles: ['admin','hr'] },
  { path: '/attendance',   label: 'Attendance',       Icon: Clock,           roles: ['admin','hr','team_lead','employee'] },
  { path: '/leave',        label: 'Leave Management', Icon: CalendarDays,    roles: ['admin','hr','team_lead','employee'] },
  { path: '/performance',  label: 'Performance',      Icon: TrendingUp,      roles: ['admin','hr','team_lead','employee'] },
  { path: '/training',     label: 'Training & Dev',   Icon: GraduationCap,   roles: ['admin','hr','team_lead'] },
  { path: '/payroll',      label: 'Payroll',          Icon: Banknote,        roles: ['admin','hr'] },
  { path: '/recruitment',  label: 'Recruitment',      Icon: UserPlus,        roles: ['admin','hr'] },
  { path: '/disciplinary', label: 'Disciplinary',     Icon: AlertTriangle,   roles: ['admin','hr'] },
  { path: '/reports',      label: 'Reports',          Icon: BarChart3,       roles: ['admin','hr'] },
  { path: '/settings',     label: 'Settings',         Icon: Settings,        roles: ['admin'] },
]

export default function Sidebar() {
  const dispatch   = useAppDispatch()
  const navigate   = useNavigate()
  const collapsed  = useAppSelector(s => s.ui.sidebarCollapsed)
  const user       = useAppSelector(s => s.auth.user)

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'HR'

  return (
    <aside
      className={cn(
        'flex flex-col bg-secondary h-screen fixed left-0 top-0 z-30 transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 bg-[#0F0F23] min-h-[64px] shrink-0">
        <img src={cceLogo} alt="CCE Logo" className="w-9 h-9 object-contain shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white text-sm font-semibold leading-tight whitespace-nowrap">CabCall Experts</p>
            <p className="text-gray-400 text-[10px] leading-tight whitespace-nowrap">HR Management</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV.filter(item => !user?.role || item.roles.includes(user.role as UserRole)).map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group',
                isActive
                  ? 'bg-primary text-white font-semibold'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={cn('shrink-0', isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300')} />
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-white/10 p-3 shrink-0 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-semibold truncate">{user?.name ?? 'HR Manager'}</p>
              <p className="text-gray-400 text-[10px] truncate capitalize">{user?.role?.replace('_', ' ') ?? 'Administrator'}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => { dispatch(logout()); navigate('/login') }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full transition-all"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => dispatch(toggleSidebar())}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
