import { useRef, useState, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useCurrency, CURRENCIES, type CurrencyCode } from '../../context/CurrencyContext'
import { cn } from '../../utils/cn'

export function CurrencySelector({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 font-medium">
        <span className="text-primary font-bold">{currency.symbol}</span>
        {currency.code}
        <ChevronDown size={13} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[220px]">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Display Currency</p>
          {CURRENCIES.map(opt => (
            <button
              key={opt.code}
              onClick={() => { setCurrency(opt.code as CurrencyCode); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 transition text-gray-700">
              <div className="flex items-center gap-2.5">
                <span className="w-7 text-center font-bold text-primary text-sm">{opt.symbol}</span>
                <span>{opt.label}</span>
              </div>
              {currency.code === opt.code && <Check size={13} className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
