import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Link2, CheckCircle2 } from 'lucide-react'
import { Avatar } from '../../components/common/Avatar'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useAllTimesheets, weekMonday, toYMD, fmtHours } from '../../hooks/useFirebaseTimesheets'
import { cn } from '../../utils/cn'

// ── Pay period helpers ─────────────────────────────────────────────────
function getBiweeklyPeriods() {
  const today  = new Date()
  const monday = weekMonday(today)
  const periods = []
  for (let i = 0; i < 6; i++) {
    const start = new Date(monday)
    start.setDate(start.getDate() - i * 14)
    const end = new Date(start)
    end.setDate(end.getDate() + 13)
    periods.push({
      label: `${start.toLocaleDateString('en-GB', { day:'numeric', month:'short' })} – ${end.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`,
      from:  toYMD(start),
      to:    toYMD(end),
    })
  }
  return periods
}

export default function Payroll() {
  const navigate   = useNavigate()
  const { employees } = useFirebaseEmployees()
  const [periodIdx,  setPeriodIdx]  = useState(0)
  const [activeTab,  setActiveTab]  = useState<'summary' | 'hours'>('hours')

  const periods  = getBiweeklyPeriods()
  const period   = periods[periodIdx]

  const { entries, approvals, loading } = useAllTimesheets(period.from, period.to)

  // Aggregate hours per employee
  const hoursByEmp = employees.map(emp => {
    const empEntries  = entries.filter(e => e.employeeId === emp.id)
    const regular     = empEntries.filter(e => e.type === 'regular').reduce((s, e) => s + e.hours, 0)
    const overtime    = empEntries.filter(e => e.type === 'overtime').reduce((s, e) => s + e.hours, 0)
    const holiday     = empEntries.filter(e => e.type === 'holiday').reduce((s, e) => s + e.hours, 0)
    const pto         = empEntries.filter(e => e.type === 'pto').reduce((s, e) => s + e.hours, 0)
    const total       = regular + overtime + holiday + pto
    const approved    = approvals.some(a => a.employeeId === emp.id && a.status === 'approved')
    return { emp, regular, overtime, holiday, pto, total, approved }
  }).filter(r => r.total > 0 || true) // show all employees

  // Summary stats
  const totalRegular  = hoursByEmp.reduce((s, r) => s + r.regular, 0)
  const totalOvertime = hoursByEmp.reduce((s, r) => s + r.overtime, 0)
  const totalHours    = hoursByEmp.reduce((s, r) => s + r.total, 0)
  const approvedCount = hoursByEmp.filter(r => r.approved && r.total > 0).length
  const withHours     = hoursByEmp.filter(r => r.total > 0).length

  // Salary summary (from Firebase employees)
  const activeSalaries = employees.filter(e => e.status === 'active' && e.salary)
  const monthlyPayroll = activeSalaries.reduce((s, e) => s + (e.salary! / 12), 0)

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Payroll</h2>
          <p className="page-sub">Timesheet hours and salary overview</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline text-sm gap-2"><Link2 size={14} /> Sync</button>
          <button className="btn-outline text-sm gap-2"><Download size={14} /> Export</button>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex border-b border-gray-200 gap-0">
        {(['hours', 'summary'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              activeTab === t ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
            )}>
            {t === 'hours' ? 'Payroll Hours' : 'Salary Summary'}
          </button>
        ))}
      </div>

      {/* ══════════ PAYROLL HOURS TAB ══════════ */}
      {activeTab === 'hours' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Pay Schedule</label>
              <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option>Every other week</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Period</label>
              <select
                value={periodIdx}
                onChange={e => setPeriodIdx(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20">
                {periods.map((p, i) => <option key={p.from} value={i}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Hours',    value: fmtHours(totalHours),    color: '#2E86C1' },
              { label: 'Regular Hours',  value: fmtHours(totalRegular),  color: '#10B981' },
              { label: 'Overtime Hours', value: fmtHours(totalOvertime), color: '#F59E0B' },
              { label: 'Approved',       value: `${approvedCount} / ${withHours}`, color: '#8B5CF6' },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Hours table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {['Name ↑', 'Manager', 'Regular', 'Overtime', 'Holiday', 'PTO', 'Total', 'Approved?'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-gray-400">Loading…</td></tr>
                  ) : hoursByEmp.sort((a, b) => a.emp.name.localeCompare(b.emp.name)).map(r => (
                    <tr key={r.emp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/employees/${r.emp.id}?tab=Timesheet`)}
                          className="flex items-center gap-2 group">
                          <Avatar name={r.emp.name} size="xs" />
                          <span className="text-sm font-medium text-primary hover:underline">
                            {r.emp.name.split(' ').reverse().join(', ')}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.emp.manager || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.regular > 0 ? r.regular.toFixed(2) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.overtime > 0 ? r.overtime.toFixed(2) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.holiday > 0 ? r.holiday.toFixed(2) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.pto > 0 ? r.pto.toFixed(2) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-sm font-bold', r.total > 0 ? 'text-primary' : 'text-gray-300')}>
                          {r.total > 0 ? r.total.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.total > 0 && (
                          r.approved
                            ? <CheckCircle2 size={18} className="text-green-500" />
                            : <span className="w-4 h-4 rounded-full border-2 border-gray-200 inline-block" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════ SALARY SUMMARY TAB ══════════ */}
      {activeTab === 'summary' && (
        <>
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Link2 size={15} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              Salary overview based on annual bands. Full payroll processing via your integrated provider (Sage / Xero / QuickBooks).
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Monthly Payroll', value: `£${Math.round(monthlyPayroll).toLocaleString()}`,      color: '#2E86C1' },
              { label: 'Annual Payroll',  value: `£${Math.round(monthlyPayroll * 12).toLocaleString()}`, color: '#10B981' },
              { label: 'Avg Salary',      value: activeSalaries.length > 0 ? `£${Math.round(activeSalaries.reduce((s,e)=>s+(e.salary!),0)/activeSalaries.length).toLocaleString()}` : '—', color: '#F59E0B' },
              { label: 'On Payroll',      value: employees.filter(e => e.status === 'active').length,    color: '#8B5CF6' },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-secondary">Salary Overview</p>
              <p className="text-xs text-gray-400">Annual salary bands · Not individual payslips</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {['Employee','Department','Job Title','Annual Salary','Monthly Est.'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.filter(e => e.status === 'active' && e.salary).map(e => (
                    <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={e.name} size="xs" />
                          <span className="text-sm font-medium text-secondary">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{e.department}</td>
                      <td className="px-5 py-3 text-xs text-gray-600">{e.jobTitle}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-secondary">£{e.salary!.toLocaleString()}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">£{Math.round(e.salary! / 12).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
