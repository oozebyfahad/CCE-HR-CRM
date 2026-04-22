import { useState } from 'react'
import { CreditCard, ChevronRight, X } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useCurrency } from '../../context/CurrencyContext'

interface Payslip {
  id:               string
  month:            string
  year:             number
  basic:            number
  houseAllowance:   number
  transportAllow:   number
  medicalAllow:     number
  grossSalary:      number
  incomeTax:        number
  eobi:             number
  netSalary:        number
  status:           'paid' | 'pending'
  paidDate?:        string
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function generatePayslips(baseSalary: number): Payslip[] {
  const today  = new Date()
  const result: Payslip[] = []
  for (let i = 5; i >= 0; i--) {
    const d               = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const basic           = Math.max(baseSalary || 50000, 30000)
    const houseAllowance  = Math.round(basic * 0.45)
    const transportAllow  = 3000
    const medicalAllow    = 2000
    const gross           = basic + houseAllowance + transportAllow + medicalAllow
    const incomeTax       = gross > 62500 ? Math.round(gross * 0.05) : 0
    const eobi            = 370
    const net             = gross - incomeTax - eobi
    result.push({
      id:             `ps-${d.getFullYear()}-${d.getMonth()}`,
      month:          MONTHS[d.getMonth()],
      year:           d.getFullYear(),
      basic,          houseAllowance, transportAllow, medicalAllow,
      grossSalary:    gross,
      incomeTax,      eobi,
      netSalary:      net,
      status:         i === 0 ? 'pending' : 'paid',
      paidDate:       i !== 0 ? `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2,'0')}-01` : undefined,
    })
  }
  return result.reverse()
}

function PayslipModal({
  payslip, onClose, fmt,
}: { payslip: Payslip; onClose: () => void; fmt: (n: number) => string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Modal header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-secondary">{payslip.month} {payslip.year}</p>
            <p className="text-xs text-gray-400">
              Net Pay: <strong className="text-primary tabular-nums">{fmt(payslip.netSalary)}</strong>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Earnings */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Earnings</p>
            <div className="space-y-0">
              {[
                { l: 'Basic Salary',              v: payslip.basic           },
                { l: 'House Allowance (45%)',      v: payslip.houseAllowance  },
                { l: 'Transport Allowance',        v: payslip.transportAllow  },
                { l: 'Medical Allowance',          v: payslip.medicalAllow    },
              ].map(r => (
                <div key={r.l} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{r.l}</span>
                  <span className="text-sm font-semibold text-secondary tabular-nums">{fmt(r.v)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-3 py-2 bg-green-50 rounded-lg mt-1">
                <span className="text-sm font-bold text-green-700">Gross Salary</span>
                <span className="text-sm font-bold text-green-700 tabular-nums">{fmt(payslip.grossSalary)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Deductions</p>
            <div className="space-y-0">
              {[
                { l: 'Income Tax',        v: payslip.incomeTax },
                { l: 'EOBI Contribution', v: payslip.eobi      },
              ].map(r => (
                <div key={r.l} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{r.l}</span>
                  <span className="text-sm font-semibold text-red-500 tabular-nums">−{fmt(r.v)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Net pay */}
          <div className="flex justify-between items-center bg-primary/5 border border-primary/20 rounded-xl px-5 py-4">
            <span className="text-sm font-bold text-secondary">Net Pay</span>
            <span className="text-xl font-bold text-primary tabular-nums">{fmt(payslip.netSalary)}</span>
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end">
          <button onClick={onClose} className="btn-outline text-sm px-5">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function MyPayslips() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees } = useFirebaseEmployees()
  const { fmt }       = useCurrency()
  const [selected, setSelected] = useState<Payslip | null>(null)

  const myEmployee = employees.find(e => e.email === currentUser?.email)
  const payslips   = generatePayslips(myEmployee?.salary ?? 50000)

  const paidSlips = payslips.filter(p => p.status === 'paid')
  const ytdGross  = paidSlips.reduce((s, p) => s + p.grossSalary, 0)
  const ytdNet    = paidSlips.reduce((s, p) => s + p.netSalary,   0)
  const ytdTax    = paidSlips.reduce((s, p) => s + p.incomeTax,   0)

  const chartData = paidSlips.map(p => ({
    month: p.month.slice(0, 3),
    gross: p.grossSalary,
    net:   p.netSalary,
  }))

  return (
    <div className="space-y-5">

      <div>
        <h1 className="text-xl font-bold text-secondary">My Payslips</h1>
        <p className="text-sm text-gray-400 mt-0.5">View and download your monthly payslips</p>
      </div>

      {/* YTD summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { l: 'YTD Gross Salary', v: fmt(ytdGross), c: 'text-secondary',   bg: '' },
          { l: 'YTD Net Pay',      v: fmt(ytdNet),   c: 'text-primary',     bg: 'bg-blue-50' },
          { l: 'YTD Tax Paid',     v: fmt(ytdTax),   c: 'text-red-500',     bg: 'bg-red-50'  },
        ].map(s => (
          <div key={s.l} className={`card p-5 ${s.bg}`}>
            <p className="text-xs text-gray-500 font-medium">{s.l}</p>
            <p className={`text-xl font-bold mt-1 ${s.c} tabular-nums`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Earnings trend chart */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <p className="text-sm font-bold text-secondary mb-1">Earnings Trend</p>
          <p className="text-xs text-gray-400 mb-4">Gross vs net — last 6 months</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                formatter={(v: number, name: string) => [fmt(v), name === 'gross' ? 'Gross' : 'Net']}
              />
              <Bar dataKey="gross" fill="#E5F0F8" radius={[4, 4, 0, 0]} name="Gross" />
              <Bar dataKey="net"   fill="#2E86C1" radius={[4, 4, 0, 0]} name="Net" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100" /><span className="text-[10px] text-gray-400">Gross</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary" /><span className="text-[10px] text-gray-400">Net</span></div>
          </div>
        </div>
      )}

      {/* Payslip list */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-sm font-bold text-secondary">Payslip History</p>
        </div>
        <div className="divide-y divide-gray-50">
          {payslips.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <CreditCard size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-secondary">{p.month} {p.year}</p>
                <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                  Net: <strong className="text-secondary">{fmt(p.netSalary)}</strong>
                  {p.paidDate && ` · Paid ${p.paidDate}`}
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0
                ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {p.status === 'paid' ? 'Paid' : 'Pending'}
              </span>
              <button onClick={() => setSelected(p)}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold shrink-0">
                View <ChevronRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {selected && <PayslipModal payslip={selected} onClose={() => setSelected(null)} fmt={fmt} />}
    </div>
  )
}
