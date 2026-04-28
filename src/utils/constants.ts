export const BRAND = {
  primary:   '#2E86C1',
  secondary: '#1A1A2E',
  white:     '#FFFFFF',
  bg:        '#F0F4F8',
}

export const CHART_COLORS = {
  primary:  '#2E86C1',
  green:    '#10B981',
  amber:    '#F59E0B',
  purple:   '#8B5CF6',
  red:      '#EF4444',
  orange:   '#F97316',
  pink:     '#EC4899',
  teal:     '#14B8A6',
}

export const DEPARTMENTS = [
  'Operations',
  'Dispatch',
  'Management',
  'QA',
  'Admin',
  'HR',
  'Finance',
  'IT',
  'Customer Service',
  'Marketing',
]

export const DEPARTMENT_COLORS: Record<string, string> = {
  Operations:         '#2E86C1',
  Dispatch:           '#F59E0B',
  Management:         '#F97316',
  QA:                 '#10B981',
  Admin:              '#8B5CF6',
  HR:                 '#EC4899',
  Finance:            '#14B8A6',
  IT:                 '#6366F1',
  'Customer Service': '#10B981',
  Marketing:          '#EF4444',
}

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:         'Annual Leave',
  public_holiday: 'Public Holidays',
  sick:           'Sick Leave',
  casual:         'Casual Leave',
  unpaid:         'Unpaid Leave',
  maternity:      'Maternity Leave',
  paternity:      'Paternity Leave',
  compassionate:  'Compassionate',
  toil:           'TOIL',
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  contract:  'Contract',
  agency:    'Agency',
}

export const STATUS_LABELS: Record<string, string> = {
  active:      'Active',
  probation:   'Probation',
  on_leave:    'On Leave',
  suspended:   'Suspended',
  resigned:    'Resigned',
  terminated:  'Terminated',
}

/**
 * Returns the effective display status for an employee.
 * - If startDate is within the last 3 months → 'probation' (auto)
 * - If stored as 'probation' but 3+ months have passed → 'active'
 * - Explicit statuses (resigned/suspended/on_leave/terminated) always win
 */
export function getEffectiveStatus(emp: { status: string; startDate?: string }): string {
  if (['resigned', 'suspended', 'terminated', 'on_leave'].includes(emp.status)) return emp.status
  if (emp.startDate) {
    const probationEnd = new Date(emp.startDate + 'T00:00:00')
    probationEnd.setMonth(probationEnd.getMonth() + 3)
    if (new Date() < probationEnd) return 'probation'
  }
  if (emp.status === 'probation') return 'active'
  return emp.status
}

export const NAV_ITEMS = [
  { path: '/dashboard',    label: 'Dashboard',       icon: 'LayoutDashboard' },
  { path: '/employees',    label: 'Employees',        icon: 'Users' },
  { path: '/attendance',   label: 'Attendance',       icon: 'Clock' },
  { path: '/leave',        label: 'Leave Management', icon: 'CalendarDays' },
  { path: '/performance',  label: 'Performance',      icon: 'TrendingUp' },
  { path: '/training',     label: 'Training & Dev',   icon: 'GraduationCap' },
  { path: '/payroll',      label: 'Payroll',          icon: 'Banknote' },
  { path: '/recruitment',  label: 'Recruitment',      icon: 'UserPlus' },
  { path: '/disciplinary', label: 'Disciplinary',     icon: 'AlertTriangle' },
  { path: '/reports',      label: 'Reports',          icon: 'BarChart3' },
  { path: '/settings',     label: 'Settings',         icon: 'Settings' },
]
