import { useState } from 'react'
import {
  Plus, ChevronRight, Check, Clock, Banknote,
  Wallet, Users, AlertCircle, X, DollarSign,
} from 'lucide-react'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useFirebasePayroll, type PayrollRun, type PayrollEntry } from '../../hooks/useFirebasePayroll'
import { useFirebaseAdvances, useFirebaseLoans } from '../../hooks/useFirebaseAdvances'
import { useAppSelector } from '../../store'
import { fmtPKR, PAY_TYPE_LABELS } from '../../utils/payroll'
import PayslipModal from './components/PayslipModal'
import { cn } from '../../utils/cn'

type PageTab = 'Runs' | 'Advances' | 'Loans'

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  repaying: 'bg-violet-100 text-violet-700',
  settled:  'bg-gray-100 text-gray-500',
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-800 placeholder-gray-400'

// ── New Run Modal ─────────────────────────────────────────────────────
function NewRunModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { employees }  = useFirebaseEmployees()
  const { createRun }  = useFirebasePayroll()
  const { advances }   = useFirebaseAdvances()
  const { loans }      = useFirebaseLoans()

  const today = new Date()
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}`
  const [step,    setStep]    = useState<1 | 2>(1)
  const [month,   setMonth]   = useState(defaultMonth)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  // Per-employee hours map: employeeId → hoursWorked
  const active = employees.filter(e => e.status === 'active')
  const [hoursMap, setHoursMap] = useState<Record<string, string>>({})

  const hourly  = active.filter(e => e.payType === 'hourly')
  const fixed   = active.filter(e => e.payType !== 'hourly')

  function setHours(id: string, val: string) {
    setHoursMap(m => ({ ...m, [id]: val }))
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const advMap: Record<string, number> = {}
      const loanMap: Record<string, number> = {}
      advances.filter(a => a.status === 'repaying').forEach(a => {
        advMap[a.employeeId] = (advMap[a.employeeId] ?? 0) + a.monthlyDeduct
      })
      loans.filter(l => l.status === 'repaying').forEach(l => {
        loanMap[l.employeeId] = (loanMap[l.employeeId] ?? 0) + l.monthlyInstalment
      })
      // Convert string inputs to numbers
      const numericHours: Record<string, number> = {}
      Object.entries(hoursMap).forEach(([id, v]) => {
        const n = parseFloat(v)
        if (!isNaN(n) && n > 0) numericHours[id] = n
      })
      const id = await createRun(month, employees, numericHours, advMap, loanMap, {}, {}, {}, {}, {})
      onCreated(id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create run.')
    } finally {
      setSaving(false)
    }
  }

  const thCls = 'text-left px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap'
  const tdCls = 'px-3 py-2 text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-secondary">New Payroll Run</p>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 2 — {step === 1 ? 'Select month' : 'Enter hours worked'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Month ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Payroll Month</label>
                <input type="month" className={inp} value={month} onChange={e => setMonth(e.target.value)} />
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                <Users size={14} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p><strong>{active.length} active employees</strong> will be included.</p>
                  <p><span className="font-semibold">{hourly.length} hourly</span> — paid per hour worked (dispatchers, staff).</p>
                  <p><span className="font-semibold">{fixed.length} fixed monthly</span> — fixed salary + overtime if hours exceed threshold (managers).</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Hours per employee ── */}
          {step === 2 && (
            <div className="p-6 space-y-6">

              {/* Hourly employees */}
              {hourly.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} className="text-amber-500" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Hourly Employees — enter actual hours worked this month</p>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={thCls}>Employee</th>
                          <th className={thCls}>Job Title</th>
                          <th className={thCls}>Rate (PKR/hr)</th>
                          <th className={thCls}>Hours Worked</th>
                          <th className={thCls}>Est. Basic Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {hourly.map(emp => {
                          const hrs = parseFloat(hoursMap[emp.id] ?? '') || 0
                          const est = Math.round((emp.hourlyRate ?? 0) * hrs)
                          return (
                            <tr key={emp.id} className="hover:bg-gray-50/50">
                              <td className={tdCls}>
                                <p className="font-medium text-gray-900">{emp.name}</p>
                                <p className="text-xs text-gray-400">{emp.employeeId}</p>
                              </td>
                              <td className={`${tdCls} text-gray-500`}>{emp.jobTitle}</td>
                              <td className={`${tdCls} font-medium text-gray-700`}>
                                {emp.hourlyRate ? `PKR ${emp.hourlyRate.toLocaleString()}` : <span className="text-red-400 text-xs">Not set</span>}
                              </td>
                              <td className={tdCls}>
                                <input
                                  type="number" min={0} step={0.5}
                                  placeholder="0"
                                  value={hoursMap[emp.id] ?? ''}
                                  onChange={e => setHours(emp.id, e.target.value)}
                                  className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                              </td>
                              <td className={tdCls}>
                                <span className={hrs > 0 ? 'font-semibold text-green-600' : 'text-gray-300'}>
                                  {hrs > 0 ? `PKR ${est.toLocaleString()}` : '—'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Fixed monthly / managers */}
              {fixed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote size={14} className="text-primary" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fixed Monthly (Managers) — enter hours to calculate overtime</p>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={thCls}>Employee</th>
                          <th className={thCls}>Fixed Salary</th>
                          <th className={thCls}>Threshold</th>
                          <th className={thCls}>OT Rate (PKR/hr)</th>
                          <th className={thCls}>Hours Worked</th>
                          <th className={thCls}>OT Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {fixed.map(emp => {
                          const hrs       = parseFloat(hoursMap[emp.id] ?? '') || 0
                          const threshold = emp.monthlyHours ?? 160
                          const otHrs     = Math.max(0, hrs - threshold)
                          const otPay     = Math.round(otHrs * (emp.overtimeRate ?? 0))
                          return (
                            <tr key={emp.id} className="hover:bg-gray-50/50">
                              <td className={tdCls}>
                                <p className="font-medium text-gray-900">{emp.name}</p>
                                <p className="text-xs text-gray-400">{emp.jobTitle}</p>
                              </td>
                              <td className={`${tdCls} font-medium text-gray-700`}>
                                {emp.salary ? `PKR ${emp.salary.toLocaleString()}` : <span className="text-red-400 text-xs">Not set</span>}
                              </td>
                              <td className={`${tdCls} text-gray-500`}>{threshold} hrs</td>
                              <td className={`${tdCls} text-gray-700`}>
                                {emp.overtimeRate
                                  ? `PKR ${emp.overtimeRate.toLocaleString()}`
                                  : <span className="text-gray-300 text-xs">None</span>}
                              </td>
                              <td className={tdCls}>
                                <input
                                  type="number" min={0} step={0.5}
                                  placeholder={String(threshold)}
                                  value={hoursMap[emp.id] ?? ''}
                                  onChange={e => setHours(emp.id, e.target.value)}
                                  className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                              </td>
                              <td className={tdCls}>
                                {otHrs > 0 ? (
                                  <span className="text-purple-600 font-semibold">
                                    {otHrs}h → +PKR {otPay.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">No OT</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Overtime only applies when hours exceed the threshold. Each manager's OT rate is set individually on their employee profile.
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <button onClick={step === 1 ? onClose : () => setStep(1)} className="btn-outline text-sm px-4">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step === 1 ? (
            <button onClick={() => { if (month) setStep(2); else setError('Select a month first.') }}
              className="btn-primary text-sm px-6 flex items-center gap-2">
              Next: Enter Hours <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving}
              className="btn-primary text-sm px-6 disabled:opacity-50">
              {saving ? 'Creating…' : `Create Run for ${active.length} Employees`}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Run Detail ────────────────────────────────────────────────────────
function RunDetail({ run, onBack }: { run: PayrollRun; onBack: () => void }) {
  const { getEntries, approveRun, markPaid, deleteRun } = useFirebasePayroll()
  const currentUser = useAppSelector(s => s.auth.user)
  const [entries,  setEntries]  = useState<PayrollEntry[]>([])
  const [loaded,   setLoaded]   = useState(false)
  const [payslip,  setPayslip]  = useState<PayrollEntry | null>(null)
  const [working,  setWorking]  = useState(false)
  const [search,   setSearch]   = useState('')

  useState(() => {
    getEntries(run.id).then(e => { setEntries(e); setLoaded(true) })
  })

  const filtered = entries.filter(e =>
    e.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  )

  const handleApprove = async () => {
    setWorking(true)
    await approveRun(run.id, currentUser?.name ?? 'HR')
    setWorking(false)
  }
  const handlePaid = async () => {
    setWorking(true)
    await markPaid(run.id)
    setWorking(false)
  }
  const handleDelete = async () => {
    if (!confirm('Delete this draft run? This cannot be undone.')) return
    setWorking(true)
    await deleteRun(run.id)
    onBack()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="text-xs text-primary font-semibold hover:underline">← All Runs</button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-bold text-secondary">{run.label}</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[run.status]}`}>{run.status}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Headcount',   v: run.headcount,   fmt: String,  icon: Users,    c: '#2E86C1' },
          { l: 'Gross Payroll',v: run.totalGross,  fmt: fmtPKR,  icon: Banknote, c: '#10B981' },
          { l: 'Withholding Tax',v: run.totalTax,  fmt: fmtPKR,  icon: DollarSign, c: '#F59E0B' },
          { l: 'Net Payroll',  v: run.totalNet,    fmt: fmtPKR,  icon: Wallet,   c: '#8B5CF6' },
        ].map(k => (
          <div key={k.l} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${k.c}18` }}>
              <k.icon size={16} style={{ color: k.c }} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{k.l}</p>
              <p className="text-sm font-bold text-secondary">{k.fmt(k.v as number)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2">
          {run.status === 'draft' && (
            <>
              <button onClick={handleApprove} disabled={working}
                className="btn-primary text-xs px-4 flex items-center gap-1.5 disabled:opacity-50">
                <Check size={13} /> Approve Run
              </button>
              <button onClick={handleDelete} disabled={working}
                className="btn-outline text-xs px-4 text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1.5">
                <X size={13} /> Delete Draft
              </button>
            </>
          )}
          {run.status === 'approved' && (
            <button onClick={handlePaid} disabled={working}
              className="btn-primary text-xs px-4 flex items-center gap-1.5 disabled:opacity-50">
              <Banknote size={13} /> Mark as Paid
            </button>
          )}
        </div>
      </div>

      {/* Entries table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee','Department','Pay Type','Hours','Gross','Tax','EOBI','Deductions','Net Pay',''].map(c => (
                  <th key={c} className="px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide text-left whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={10} className="text-center py-8 text-sm text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-sm text-gray-400">No entries found.</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold text-secondary whitespace-nowrap">{e.employeeName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{e.department}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{PAY_TYPE_LABELS[e.payType as keyof typeof PAY_TYPE_LABELS] ?? e.payType}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{e.hoursWorked}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-emerald-600 tabular-nums">{fmtPKR(e.result.grossPay)}</td>
                  <td className="px-4 py-3 text-xs text-red-500 tabular-nums">{e.result.withholdingTax > 0 ? fmtPKR(e.result.withholdingTax) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{e.result.eobiEmployee > 0 ? fmtPKR(e.result.eobiEmployee) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                    {(e.result.advanceRepay + e.result.loanRepay + e.result.otherDeductions) > 0
                      ? fmtPKR(e.result.advanceRepay + e.result.loanRepay + e.result.otherDeductions) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-secondary tabular-nums">{fmtPKR(e.result.netPay)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setPayslip(e)} className="text-[11px] text-primary font-semibold hover:underline whitespace-nowrap">
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payslip && <PayslipModal entry={payslip} month={run.month} onClose={() => setPayslip(null)} />}
    </div>
  )
}

// ── Advances Tab ──────────────────────────────────────────────────────
function AdvancesTab() {
  const { employees } = useFirebaseEmployees()
  const { advances, loading, requestAdvance, approveAdvance, deleteAdvance } = useFirebaseAdvances()
  const currentUser = useAppSelector(s => s.auth.user)
  const [showForm, setShowForm] = useState(false)
  const [empId,    setEmpId]    = useState('')
  const [amount,   setAmount]   = useState('')
  const [deduct,   setDeduct]   = useState('')
  const [reason,   setReason]   = useState('')
  const [saving,   setSaving]   = useState(false)

  const handleSubmit = async () => {
    const emp = employees.find(e => e.id === empId)
    if (!emp || !amount || !deduct) return
    setSaving(true)
    await requestAdvance({
      employeeId: emp.id, employeeName: emp.name, department: emp.department ?? '',
      amount: Number(amount), monthlyDeduct: Number(deduct), reason,
    })
    setSaving(false)
    setShowForm(false)
    setEmpId(''); setAmount(''); setDeduct(''); setReason('')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-secondary">Salary Advances</p>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={13} /> New Advance
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4 border border-primary/20">
          <p className="text-sm font-semibold text-secondary">New Advance Request</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Employee</label>
              <select className={inp} value={empId} onChange={e => setEmpId(e.target.value)}>
                <option value="">Select employee…</option>
                {employees.filter(e => e.status === 'active').map(e => (
                  <option key={e.id} value={e.id}>{e.name} — {e.department}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Advance Amount (PKR)</label>
              <input className={inp} type="number" min={0} placeholder="e.g. 20000" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Monthly Deduction (PKR)</label>
              <input className={inp} type="number" min={0} placeholder="e.g. 5000" value={deduct} onChange={e => setDeduct(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Reason (optional)</label>
              <input className={inp} placeholder="Medical, personal…" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-outline text-sm px-4">Cancel</button>
            <button onClick={handleSubmit} disabled={saving || !empId || !amount || !deduct}
              className="btn-primary text-sm px-6 disabled:opacity-50">{saving ? 'Saving…' : 'Submit'}</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee','Department','Amount','Repaid','Monthly Deduct','Reason','Status',''].map(c => (
                  <th key={c} className="px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide text-left whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-sm text-gray-400">Loading…</td></tr>
              ) : advances.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-sm text-gray-400">No advances on record.</td></tr>
              ) : advances.map(a => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                  <td className="px-4 py-3 text-xs font-semibold text-secondary">{a.employeeName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.department}</td>
                  <td className="px-4 py-3 text-xs tabular-nums font-medium">{fmtPKR(a.amount)}</td>
                  <td className="px-4 py-3 text-xs tabular-nums text-gray-500">{fmtPKR(a.amountRepaid)}</td>
                  <td className="px-4 py-3 text-xs tabular-nums text-gray-500">{fmtPKR(a.monthlyDeduct)}/mo</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{a.reason || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {a.status === 'pending' && (
                      <button onClick={() => approveAdvance(a.id, currentUser?.name ?? 'HR')}
                        className="text-[11px] text-green-600 font-semibold hover:underline">Approve</button>
                    )}
                    {(a.status === 'pending') && (
                      <button onClick={() => deleteAdvance(a.id)} className="text-[11px] text-red-400 hover:text-red-600">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Loans Tab ─────────────────────────────────────────────────────────
function LoansTab() {
  const { employees } = useFirebaseEmployees()
  const { loans, loading, requestLoan, approveLoan, deleteLoan } = useFirebaseLoans()
  const currentUser = useAppSelector(s => s.auth.user)
  const [showForm,   setShowForm]   = useState(false)
  const [empId,      setEmpId]      = useState('')
  const [amount,     setAmount]     = useState('')
  const [instalments,setInstalments]= useState('')
  const [purpose,    setPurpose]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const instalment = amount && instalments
    ? Math.ceil(Number(amount) / Number(instalments)) : 0

  const handleSubmit = async () => {
    const emp = employees.find(e => e.id === empId)
    if (!emp || !amount || !instalments) return
    setSaving(true)
    await requestLoan({
      employeeId: emp.id, employeeName: emp.name, department: emp.department ?? '',
      amount: Number(amount), totalInstalments: Number(instalments),
      monthlyInstalment: instalment, purpose,
    })
    setSaving(false)
    setShowForm(false)
    setEmpId(''); setAmount(''); setInstalments(''); setPurpose('')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-secondary">Employee Loans</p>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={13} /> New Loan
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4 border border-primary/20">
          <p className="text-sm font-semibold text-secondary">New Loan</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Employee</label>
              <select className={inp} value={empId} onChange={e => setEmpId(e.target.value)}>
                <option value="">Select employee…</option>
                {employees.filter(e => e.status === 'active').map(e => (
                  <option key={e.id} value={e.id}>{e.name} — {e.department}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Loan Amount (PKR)</label>
              <input className={inp} type="number" min={0} placeholder="e.g. 100000" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Number of Instalments (months)</label>
              <input className={inp} type="number" min={1} placeholder="e.g. 12" value={instalments} onChange={e => setInstalments(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Purpose (optional)</label>
              <input className={inp} placeholder="Medical, education…" value={purpose} onChange={e => setPurpose(e.target.value)} />
            </div>
          </div>
          {instalment > 0 && (
            <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-xs text-blue-700">
              Monthly instalment: <strong>{fmtPKR(instalment)}</strong> × {instalments} months
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-outline text-sm px-4">Cancel</button>
            <button onClick={handleSubmit} disabled={saving || !empId || !amount || !instalments}
              className="btn-primary text-sm px-6 disabled:opacity-50">{saving ? 'Saving…' : 'Submit'}</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee','Department','Principal','Repaid','Instalment','Progress','Purpose','Status',''].map(c => (
                  <th key={c} className="px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide text-left whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-sm text-gray-400">Loading…</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-sm text-gray-400">No loans on record.</td></tr>
              ) : loans.map(l => {
                const pct = Math.min(100, Math.round((l.paidInstalments / l.totalInstalments) * 100))
                return (
                  <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                    <td className="px-4 py-3 text-xs font-semibold text-secondary">{l.employeeName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{l.department}</td>
                    <td className="px-4 py-3 text-xs tabular-nums font-medium">{fmtPKR(l.amount)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-gray-500">{fmtPKR(l.amountRepaid)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-gray-500">{fmtPKR(l.monthlyInstalment)}/mo</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-20">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 tabular-nums">{l.paidInstalments}/{l.totalInstalments}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">{l.purpose || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {l.status === 'pending' && (
                        <button onClick={() => approveLoan(l.id, currentUser?.name ?? 'HR')}
                          className="text-[11px] text-green-600 font-semibold hover:underline">Approve</button>
                      )}
                      {l.status === 'pending' && (
                        <button onClick={() => deleteLoan(l.id)} className="text-[11px] text-red-400 hover:text-red-600">Delete</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function PayrollPage() {
  const { runs, loading } = useFirebasePayroll()
  const [pageTab,    setPageTab]    = useState<PageTab>('Runs')
  const [showNew,    setShowNew]    = useState(false)
  const [activeRun,  setActiveRun]  = useState<PayrollRun | null>(null)

  if (activeRun) {
    // Sync status if run was updated
    const fresh = runs.find(r => r.id === activeRun.id) ?? activeRun
    return <RunDetail run={fresh} onBack={() => setActiveRun(null)} />
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-secondary">Payroll</h1>
          <p className="text-xs text-gray-400 mt-0.5">FBR-compliant payroll with EOBI, advances &amp; loans</p>
        </div>
        {pageTab === 'Runs' && (
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} /> New Payroll Run
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['Runs','Advances','Loans'] as PageTab[]).map(t => (
          <button key={t} onClick={() => setPageTab(t)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-lg transition-colors',
              pageTab === t ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}>
            {t}
          </button>
        ))}
      </div>

      {/* Runs list */}
      {pageTab === 'Runs' && (
        <div className="space-y-3">
          {loading ? (
            <div className="card p-12 text-center text-sm text-gray-400">Loading payroll runs…</div>
          ) : runs.length === 0 ? (
            <div className="card p-12 text-center space-y-3">
              <Banknote size={32} className="text-gray-300 mx-auto" />
              <p className="text-sm text-gray-400">No payroll runs yet. Create your first run to get started.</p>
              <button onClick={() => setShowNew(true)} className="btn-primary text-sm mx-auto flex items-center gap-2">
                <Plus size={14} /> New Payroll Run
              </button>
            </div>
          ) : runs.map(run => (
            <div key={run.id}
              onClick={() => setActiveRun(run)}
              className="card p-5 flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  run.status === 'paid' ? 'bg-green-100' : run.status === 'approved' ? 'bg-blue-100' : 'bg-gray-100'
                )}>
                  {run.status === 'paid'     && <Check    size={18} className="text-green-600" />}
                  {run.status === 'approved' && <Clock    size={18} className="text-blue-600"  />}
                  {run.status === 'draft'    && <AlertCircle size={18} className="text-gray-500" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-secondary">{run.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{run.headcount} employees · {fmtPKR(run.totalGross)} gross</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-400">Net Payroll</p>
                  <p className="text-sm font-bold text-secondary">{fmtPKR(run.totalNet)}</p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[run.status]}`}>{run.status}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {pageTab === 'Advances' && <AdvancesTab />}
      {pageTab === 'Loans'    && <LoansTab />}

      {showNew && (
        <NewRunModal
          onClose={() => setShowNew(false)}
          onCreated={id => {
            setShowNew(false)
            const run = runs.find(r => r.id === id)
            if (run) setActiveRun(run)
          }}
        />
      )}
    </div>
  )
}
