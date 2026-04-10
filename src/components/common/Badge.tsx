import { cn } from '../../utils/cn'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'purple' | 'orange'

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  size?: 'xs' | 'sm'
  className?: string
  dot?: boolean
}

const V: Record<Variant, string> = {
  success: 'bg-green-100  text-green-700',
  warning: 'bg-amber-100  text-amber-700',
  danger:  'bg-red-100    text-red-700',
  info:    'bg-blue-100   text-blue-700',
  neutral: 'bg-gray-100   text-gray-600',
  primary: 'bg-primary-50 text-primary-700',
  purple:  'bg-purple-100 text-purple-700',
  orange:  'bg-orange-100 text-orange-700',
}

const DOT: Record<Variant, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-gray-400',
  primary: 'bg-primary',
  purple:  'bg-purple-500',
  orange:  'bg-orange-500',
}

export function Badge({ children, variant = 'neutral', size = 'sm', className, dot }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 font-medium rounded-full',
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
      V[variant],
      className,
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', DOT[variant])} />}
      {children}
    </span>
  )
}

// Convenience helpers
export const statusVariant = (status: string): Variant => {
  const map: Record<string, Variant> = {
    active: 'success', on_leave: 'info', suspended: 'warning',
    resigned: 'neutral', terminated: 'danger',
    present: 'success', absent: 'danger', late: 'warning', early_departure: 'orange',
    pending: 'warning', approved: 'success', declined: 'danger', cancelled: 'neutral',
    completed: 'success', in_progress: 'info', overdue: 'danger', scheduled: 'primary',
    not_started: 'neutral', passed: 'success', in_probation: 'warning', extended: 'orange', failed: 'danger',
    open: 'success', closed: 'neutral', draft: 'neutral',
  }
  return map[status] ?? 'neutral'
}
