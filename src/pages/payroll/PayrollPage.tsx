import { useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import {
  Plus, ChevronRight, Check, Clock, Banknote,
  Wallet, Users, AlertCircle, X, DollarSign, Download, RefreshCw,
  Star,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useFirebasePayroll, type PayrollRun, type PayrollEntry } from '../../hooks/useFirebasePayroll'
import { useFirebaseAdvances, useFirebaseLoans } from '../../hooks/useFirebaseAdvances'
import { useAppSelector } from '../../store'
import { fmtPKR, PAY_TYPE_LABELS } from '../../utils/payroll'
import PayslipModal from './components/PayslipModal'
import { cn } from '../../utils/cn'
import {
  fetchRotaAttendance, fetchRotaShifts, monthToUnix,
  type RotaAttendance, type RotaShift,
} from '../../services/rotacloud'
import { unixToLocalDate } from '../../hooks/useRotaAttendance'

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

  // Per-employee variable pay maps
  const active = employees.filter(e => e.status === 'active')
  const [hoursMap,       setHoursMap]       = useState<Record<string, string>>({})
  const [punctualityMap, setPunctualityMap] = useState<Record<string, string>>({})
  // Tracks RotaCloud-derived punctuality eligibility: empId → { lateCount, completedShifts }
  const [lateMap, setLateMap] = useState<Record<string, { lateCount: number; completedShifts: number }>>({})

  // Global punctuality bonus rate for auto-fill
  const [globalPuncRate, setGlobalPuncRate] = useState('')

  // RotaCloud hours import
  const [rotaImporting, setRotaImporting] = useState(false)
  const [rotaStatus,    setRotaStatus]    = useState<{ matched: number; total: number } | null>(null)
  const [rotaError,     setRotaError]     = useState('')

  const importFromRotacloud = async () => {
    setRotaImporting(true)
    setRotaError('')
    setRotaStatus(null)
    try {
      const { start, end } = monthToUnix(month)
      const [attRecords, shiftRecords] = await Promise.all([
        fetchRotaAttendance(start, end),
        fetchRotaShifts(start, end),
      ])

      // Build rotacloudId → FirebaseEmployee lookup
      const rotaToEmp: Record<number, typeof employees[number]> = {}
      employees.forEach(e => { if (e.rotacloudId) rotaToEmp[Number(e.rotacloudId)] = e })

      // Group attendance + shifts by RotaCloud user
      const byUser: Record<number, { atts: RotaAttendance[]; shifts: RotaShift[] }> = {}
      for (const r of attRecords) {
        if (r.deleted) continue
        if (!byUser[r.user]) byUser[r.user] = { atts: [], shifts: [] }
        byUser[r.user].atts.push(r)
      }
      for (const s of shiftRecords) {
        if (s.deleted || !s.published || s.open) continue
        if (!byUser[s.user]) byUser[s.user] = { atts: [], shifts: [] }
        byUser[s.user].shifts.push(s)
      }

      const newHours: Record<string, string>       = { ...hoursMap }
      const newPunc:  Record<string, string>       = { ...punctualityMap }
      const newLate:  typeof lateMap               = {}
      let matched = 0

      for (const [rotaIdStr, { atts, shifts }] of Object.entries(byUser)) {
        const emp = rotaToEmp[Number(rotaIdStr)]
        if (!emp) continue

        // Check Firestore for admin-approved shift summary first
        let approvedHours:    number | null = null
        let lateCount:        number | null = null
        let completedShifts:  number | null = null
        try {
          const snap = await getDoc(doc(db, 'shift_approvals', `${emp.id}_${month}`))
          if (snap.exists()) {
            const d = snap.data()
            approvedHours   = d.approvedHours   as number
            lateCount       = d.lateCount       as number
            completedShifts = d.completedShifts as number
          }
        } catch { /* no pre-approval — fall through */ }

        const isHourly  = emp.payType === 'hourly'
        const threshold = emp.monthlyHours   // undefined = no cap for hourly; default 160 for fixed

        if (approvedHours !== null) {
          let capped = approvedHours
          if (threshold != null) capped = Math.min(capped, threshold)
          newHours[emp.id] = String(Math.round(capped * 100) / 100)
        } else {
          // Calculate from raw RotaCloud data
          const shiftByDate = new Map<string, RotaShift>()
          for (const s of shifts) {
            const d = unixToLocalDate(s.start_time)
            if (!shiftByDate.has(d)) shiftByDate.set(d, s)
          }

          let totalHrs = 0; let late = 0; let completed = 0
          for (const att of atts) {
            if (!att.approved) continue
            if (att.in_time_clocked && att.out_time_clocked) completed++
            if (att.minutes_late > 0) late++
            let hrs = att.hours
            if (isHourly) {
              // Hourly: cap each shift to scheduled duration (no early/late padding)
              const d    = unixToLocalDate((att.in_time_clocked ?? att.in_time) as number)
              const shift = shiftByDate.get(d)
              if (shift) {
                const scheduled = (shift.end_time - shift.start_time) / 3600 - att.minutes_break / 60
                hrs = Math.min(att.hours, Math.max(0, scheduled))
              }
            }
            totalHrs += hrs
          }
          // Cap total at monthly threshold if set (applies to both hourly and fixed)
          if (threshold != null) totalHrs = Math.min(totalHrs, threshold)
          newHours[emp.id] = String(Math.round(totalHrs * 100) / 100)
          lateCount       = late
          completedShifts = completed
        }

        // Track eligibility and auto-zero punctuality if not eligible
        if (lateCount !== null && completedShifts !== null) {
          newLate[emp.id] = { lateCount, completedShifts }
          const qualifies = lateCount <= 3 && completedShifts >= 15
          if (!qualifies) newPunc[emp.id] = '0'
        }
        matched++
      }

      setHoursMap(newHours)
      setPunctualityMap(newPunc)
      setLateMap(newLate)
      setRotaStatus({ matched, total: Object.keys(byUser).length })
    } catch (e) {
      setRotaError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setRotaImporting(false)
    }
  }

  const hourly = active.filter(e => e.payType === 'hourly')
  const fixed  = active.filter(e => e.payType !== 'hourly')

  function toNumMap(map: Record<string, string>): Record<string, number> {
    const out: Record<string, number> = {}
    Object.entries(map).forEach(([id, v]) => {
      const n = parseFloat(v)
      if (!isNaN(n) && n > 0) out[id] = n
    })
    return out
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
      const id = await createRun(
        month, employees,
        toNumMap(hoursMap),
        advMap, loanMap,
        {}, {},
        {},
        toNumMap(punctualityMap),
        {}, {},
      )
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-secondary">New Payroll Run</p>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 2 — {step === 1 ? 'Select month' : 'Enter hours & bonuses'}</p>
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
                <input type="month" className={inp} value={month} onChange={e => { setMonth(e.target.value); setRotaStatus(null) }} />
              </div>

              {/* RotaCloud import */}
              <div className="border border-dashed border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-secondary">Import Hours from RotaCloud</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Pulls approved attendance hours for this month and pre-fills each employee's hours.</p>
                  </div>
                  <button
                    onClick={importFromRotacloud}
                    disabled={rotaImporting || !month}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition disabled:opacity-50 shrink-0">
                    <RefreshCw size={12} className={rotaImporting ? 'animate-spin' : ''} />
                    {rotaImporting ? 'Importing…' : 'Import'}
                  </button>
                </div>
                {rotaStatus && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <Check size={13} className="text-green-600" />
                    Imported hours for <strong>{rotaStatus.matched}</strong> of {rotaStatus.total} RotaCloud employees.
                    {rotaStatus.matched < rotaStatus.total && (
                      <span className="text-amber-600"> Unmatched employees need linking in Settings → Integrations.</span>
                    )}
                  </div>
                )}
                {rotaError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} /> {rotaError}
                  </p>
                )}
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

              {/* ── Global punctuality rate auto-fill ── */}
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Star size={14} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800">Punctuality Bonus Rate</p>
                  <p className="text-[10px] text-blue-600 mt-0.5">Set a global PKR amount and auto-fill it for all qualifying employees (late ≤ 3× and ≥ 15 shifts).</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number" min={0} step={100} placeholder="e.g. 2000"
                    value={globalPuncRate}
                    onChange={e => setGlobalPuncRate(e.target.value)}
                    className="w-28 border border-blue-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-blue-800 font-semibold"
                  />
                  <button
                    onClick={() => {
                      const rate = parseFloat(globalPuncRate)
                      if (isNaN(rate) || rate < 0) return
                      const next: Record<string, string> = { ...punctualityMap }
                      active.forEach(emp => {
                        const eli = lateMap[emp.id]
                        const qualifies = eli ? eli.lateCount <= 3 && eli.completedShifts >= 15 : false
                        next[emp.id] = qualifies ? String(rate) : '0'
                      })
                      setPunctualityMap(next)
                    }}
                    disabled={!globalPuncRate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-40">
                    <Check size={12} />Apply
                  </button>
                </div>
              </div>

              {/* Hourly employees */}
              {/* ── Hourly staff ── */}
              {hourly.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} className="text-amber-500" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Hourly Employees</p>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={thCls}>Employee</th>
                          <th className={thCls}>Rate (PKR/hr)</th>
                          <th className={thCls}>Hours Worked</th>
                          <th className={thCls}>Punctuality Bonus (PKR)</th>
                          <th className={thCls}>Eligibility</th>
                          <th className={thCls}>Est. Basic Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {hourly.map(emp => {
                          const hrs  = parseFloat(hoursMap[emp.id] ?? '') || 0
                          const punc = parseFloat(punctualityMap[emp.id] ?? '') || 0
                          const est  = Math.round((emp.hourlyRate ?? 0) * hrs)
                          const eli  = lateMap[emp.id]
                          const qualifies = eli ? eli.lateCount <= 3 && eli.completedShifts >= 15 : null
                          return (
                            <tr key={emp.id} className="hover:bg-gray-50/50">
                              <td className={tdCls}>
                                <p className="font-medium text-gray-900">{emp.name}</p>
                                <p className="text-xs text-gray-400">{emp.employeeId} · {emp.jobTitle}</p>
                              </td>
                              <td className={`${tdCls} font-medium text-gray-700`}>
                                {emp.hourlyRate ? `PKR ${emp.hourlyRate.toLocaleString()}` : <span className="text-red-400 text-xs">Not set</span>}
                              </td>
                              <td className={tdCls}>
                                <input type="number" min={0} step={0.5} placeholder="0"
                                  value={hoursMap[emp.id] ?? ''}
                                  onChange={e => setHoursMap(m => ({ ...m, [emp.id]: e.target.value }))}
                                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
                              </td>
                              <td className={tdCls}>
                                <input type="number" min={0} step={100} placeholder="0"
                                  value={punctualityMap[emp.id] ?? ''}
                                  onChange={e => setPunctualityMap(m => ({ ...m, [emp.id]: e.target.value }))}
                                  className={cn(
                                    'w-24 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 border',
                                    qualifies === false
                                      ? 'border-red-200 text-red-400 focus:ring-red-200'
                                      : 'border-blue-200 text-blue-700 focus:ring-blue-200'
                                  )} />
                              </td>
                              <td className={tdCls}>
                                {qualifies === null ? (
                                  <span className="text-[10px] text-gray-300">Import first</span>
                                ) : qualifies ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                    <Star size={9} />Qualifies
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5" title={`Late ${eli?.lateCount}× · ${eli?.completedShifts} shifts`}>
                                    Not eligible
                                  </span>
                                )}
                              </td>
                              <td className={tdCls}>
                                <span className={hrs > 0 ? 'font-semibold text-gray-800' : 'text-gray-300'}>
                                  {hrs > 0 ? `PKR ${(est + punc).toLocaleString()}` : '—'}
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

              {/* ── Fixed monthly / managers ── */}
              {fixed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote size={14} className="text-primary" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fixed Monthly (Managers)</p>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={thCls}>Employee</th>
                          <th className={thCls}>Fixed Salary</th>
                          <th className={thCls}>Hours / Threshold</th>
                          <th className={thCls}>OT Preview</th>
                          <th className={thCls}>Punctuality Bonus (PKR)</th>
                          <th className={thCls}>Eligibility</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {fixed.map(emp => {
                          const hrs       = parseFloat(hoursMap[emp.id] ?? '') || 0
                          const threshold = emp.monthlyHours ?? 160
                          const otHrs     = Math.max(0, hrs - threshold)
                          const otPay     = Math.round(otHrs * (emp.overtimeRate ?? 0))
                          const eli       = lateMap[emp.id]
                          const qualifies = eli ? eli.lateCount <= 3 && eli.completedShifts >= 15 : null
                          return (
                            <tr key={emp.id} className="hover:bg-gray-50/50">
                              <td className={tdCls}>
                                <p className="font-medium text-gray-900">{emp.name}</p>
                                <p className="text-xs text-gray-400">{emp.jobTitle}</p>
                              </td>
                              <td className={`${tdCls} font-medium text-gray-700`}>
                                {emp.salary ? `PKR ${emp.salary.toLocaleString()}` : <span className="text-red-400 text-xs">Not set</span>}
                              </td>
                              <td className={tdCls}>
                                <div className="flex items-center gap-1.5">
                                  <input type="number" min={0} step={0.5} placeholder={String(threshold)}
                                    value={hoursMap[emp.id] ?? ''}
                                    onChange={e => setHoursMap(m => ({ ...m, [emp.id]: e.target.value }))}
                                    className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                  <span className="text-xs text-gray-400">/ {threshold}</span>
                                </div>
                              </td>
                              <td className={tdCls}>
                                {otHrs > 0
                                  ? <span className="text-purple-600 font-semibold text-xs">{otHrs}h → +PKR {otPay.toLocaleString()}</span>
                                  : <span className="text-gray-300 text-xs">No OT</span>}
                              </td>
                              <td className={tdCls}>
                                <input type="number" min={0} step={100} placeholder="0"
                                  value={punctualityMap[emp.id] ?? ''}
                                  onChange={e => setPunctualityMap(m => ({ ...m, [emp.id]: e.target.value }))}
                                  className={cn(
                                    'w-24 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 border',
                                    qualifies === false
                                      ? 'border-red-200 text-red-400 focus:ring-red-200'
                                      : 'border-blue-200 text-blue-700 focus:ring-blue-200'
                                  )} />
                              </td>
                              <td className={tdCls}>
                                {qualifies === null ? (
                                  <span className="text-[10px] text-gray-300">Import first</span>
                                ) : qualifies ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                    <Star size={9} />Qualifies
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5" title={`Late ${eli?.lateCount}× · ${eli?.completedShifts} shifts`}>
                                    Not eligible
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Punctuality bonus qualifies when late ≤ 3 times AND ≥ 15 completed shifts. Import from RotaCloud to auto-check.
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

// ── Two-step Delete Confirmation Modal ───────────────────────────────
function DeleteConfirmModal({
  run, onCancel, onConfirmed,
}: { run: PayrollRun; onCancel: () => void; onConfirmed: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">
              {step === 1 ? 'Delete Payroll Run?' : 'Final Confirmation'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 2</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {step === 1 ? (
            <>
              <p className="text-sm text-gray-700">
                You are about to delete the <span className="font-semibold">{run.label}</span> payroll run.
              </p>
              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-semibold capitalize">{run.status}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Headcount</span><span className="font-semibold">{run.headcount} employees</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Net Payroll</span><span className="font-semibold">{fmtPKR(run.totalNet)}</span></div>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                All payslip entries for this run will also be deleted.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                This action is <span className="font-semibold text-red-600">permanent and cannot be undone.</span>
              </p>
              <p className="text-sm text-gray-600">
                Are you absolutely sure you want to permanently delete the <span className="font-semibold">{run.label}</span> run?
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onCancel}
            className="btn-outline text-sm px-4">
            Cancel
          </button>
          {step === 1 ? (
            <button onClick={() => setStep(2)}
              className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-semibold transition-colors">
              Yes, Delete →
            </button>
          ) : (
            <button onClick={onConfirmed}
              className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-semibold transition-colors">
              Permanently Delete
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
  const [entries,      setEntries]      = useState<PayrollEntry[]>([])
  const [loaded,       setLoaded]       = useState(false)
  const [payslip,      setPayslip]      = useState<PayrollEntry | null>(null)
  const [working,      setWorking]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [showDeleteDlg, setShowDeleteDlg] = useState(false)

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
    setWorking(true)
    await deleteRun(run.id)
    onBack()
  }

  const handleDownload = () => {
    const wb = XLSX.utils.book_new()

    // ── Summary sheet ──────────────────────────────────────────────
    const summaryRows = [
      ['CabCall Experts — Payroll Run'],
      [run.label],
      [],
      ['Status',          run.status.toUpperCase()],
      ['Headcount',       run.headcount],
      ['Gross Payroll',   run.totalGross],
      ['Withholding Tax', run.totalTax],
      ['EOBI (Employee)', run.totalEobi],
      ['Net Payroll',     run.totalNet],
      ...(run.approvedBy ? [['Approved By', run.approvedBy]] : []),
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)
    summaryWs['!cols'] = [{ wch: 22 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // ── Detail sheet ───────────────────────────────────────────────
    const headers = [
      'Employee', 'Department', 'Pay Type', 'Hours Worked',
      'Basic Pay', 'Overtime Pay', 'OT Hours',
      'Paid Holiday Pay', 'Eid Pay',
      'Fuel Allowance', 'Gym Allowance',
      'QA Bonus', 'Punctuality Bonus', 'Other Additions',
      'Gross Pay',
      'Withholding Tax', 'EOBI (Emp)', 'Advance Repay',
      'Loan Repay', 'Security Deduction', 'Other Deductions',
      'Total Deductions', 'Net Pay',
    ]
    const rows = entries.map(e => {
      const r = e.result
      return [
        e.employeeName, e.department,
        e.payType === 'hourly' ? 'Hourly' : 'Fixed Monthly',
        e.hoursWorked,
        r.basicPay, r.overtimePay, r.overtimeHours,
        r.paidHolidayPay, r.eidPay,
        r.fuelAllowance, r.gymAllowance,
        r.qualityBonus, r.punctualityBonus, r.otherAdditions,
        r.grossPay,
        r.withholdingTax, r.eobiEmployee, r.advanceRepay,
        r.loanRepay, r.securityDeduction, r.otherDeductions,
        r.totalDeductions, r.netPay,
      ]
    })
    const detailWs = XLSX.utils.aoa_to_sheet([headers, ...rows])
    detailWs['!cols'] = headers.map((_h, i) => ({ wch: i === 0 ? 28 : i === 1 ? 18 : 14 }))
    XLSX.utils.book_append_sheet(wb, detailWs, 'Payroll Detail')

    XLSX.writeFile(wb, `CCE_Payroll_${run.month}_${run.status}.xlsx`)
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
            <button onClick={handleApprove} disabled={working}
              className="btn-primary text-xs px-4 flex items-center gap-1.5 disabled:opacity-50">
              <Check size={13} /> Approve Run
            </button>
          )}
          {run.status === 'approved' && (
            <button onClick={handlePaid} disabled={working}
              className="btn-primary text-xs px-4 flex items-center gap-1.5 disabled:opacity-50">
              <Banknote size={13} /> Mark as Paid
            </button>
          )}
          {(run.status === 'approved' || run.status === 'paid') && loaded && (
            <button onClick={handleDownload}
              className="btn-outline text-xs px-4 flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
              <Download size={13} /> Download Excel
            </button>
          )}
          <button onClick={() => setShowDeleteDlg(true)} disabled={working}
            className="btn-outline text-xs px-4 flex items-center gap-1.5 text-red-500 border-red-200 hover:bg-red-50 disabled:opacity-50">
            <X size={13} /> Delete Run
          </button>
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
      {showDeleteDlg && (
        <DeleteConfirmModal
          run={run}
          onCancel={() => setShowDeleteDlg(false)}
          onConfirmed={handleDelete}
        />
      )}
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
