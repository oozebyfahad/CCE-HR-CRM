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

export const DEPARTMENT_COLORS: Record<string, string> = {
  Operations:      '#2E86C1',
  'Customer Service': '#10B981',
  Dispatch:        '#F59E0B',
  Admin:           '#8B5CF6',
  Management:      '#F97316',
  IT:              '#14B8A6',
}

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:        'Annual',
  sick:          'Sick',
  unpaid:        'Unpaid',
  maternity:     'Maternity',
  paternity:     'Paternity',
  compassionate: 'Compassionate',
  toil:          'TOIL',
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  contract:  'Contract',
  agency:    'Agency',
}

export const STATUS_LABELS: Record<string, string> = {
  active:      'Active',
  on_leave:    'On Leave',
  suspended:   'Suspended',
  resigned:    'Resigned',
  terminated:  'Terminated',
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
