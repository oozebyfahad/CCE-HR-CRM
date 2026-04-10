import { cn } from '../../utils/cn'

interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  src?: string
  className?: string
}

const SIZES = { xs: 'w-6 h-6 text-[9px]', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' }

const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500',  'bg-cyan-500',   'bg-indigo-500', 'bg-pink-500',
]

function colorFor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash << 5) - hash + c.charCodeAt(0)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export function Avatar({ name, size = 'md', src, className }: AvatarProps) {
  return (
    <div className={cn('rounded-full flex items-center justify-center shrink-0 font-semibold text-white overflow-hidden', SIZES[size], !src && colorFor(name), className)}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : initials(name)}
    </div>
  )
}
