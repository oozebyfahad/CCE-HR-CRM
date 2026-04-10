import { cn } from '../../utils/cn'

interface KPICardProps {
  label: string
  value: string | number
  sub: string
  subColor?: string
  accentColor: string
  className?: string
  onClick?: () => void
}

export function KPICard({ label, value, sub, subColor = '#94A3B8', accentColor, className, onClick }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'card p-4 relative overflow-hidden transition-transform hover:scale-[1.02]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {/* top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: accentColor }} />

      <div className="mt-1">
        <p className="text-3xl font-bold text-secondary leading-none">{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-2 leading-snug">{label}</p>
        <p className="text-[11px] mt-1 font-medium" style={{ color: subColor }}>{sub}</p>
      </div>
    </div>
  )
}
