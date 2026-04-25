import { useState, useEffect, useMemo } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Download, FileText, Users, TrendingDown, Calendar, X,
  BookOpen, Banknote, Shield, RefreshCw, AlertCircle, Clock, Star, BarChart2,
  LucideIcon,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useFirebaseEmployees, type FirebaseEmployee } from '../../hooks/useFirebaseEmployees'
import { useFirebasePayroll, type PayrollEntry } from '../../hooks/useFirebasePayroll'
import {
  fetchRotaAttendance, fetchRotaShifts, fetchRotaLeave, fetchRotaLeaveTypes,
  monthToUnix,
} from '../../services/rotacloud'
import { fmtPKR } from '../../utils/payroll'
import { cn } from '../../utils/cn'

// ── Types ─────────────────────────────────────────────────────────────

type ReportType = 'headcount' | 'absenteeism' | 'leave' | 'turnover' |
  'performance' | 'training' | 'payroll' | 'audit'

interface ReportData {
  headers: string[]
  rows: (string | number)[][]
  summary?: { label: string; value: string | number; sub?: string }[]
}

// ── Constants ─────────────────────────────────────────────────────────

const DEPT_COLORS = ['#2E86C1','#10B981','#F59E0B','#8B5CF6','#EF4444','#EC4899','#6366F1','#14B8A6','#F97316','#84CC16']

const REPORT_CONFIG: {
  type: ReportType; name: string; desc: string
  Icon: LucideIcon
  color: string; bg: string
}[] = [
  { type: 'headcount',   name: 'Headcount Report',     desc: 'Workforce breakdown by department, pay type & employment type',          Icon: Users,        color: '#2E86C1', bg: 'bg-blue-50'    },
  { type: 'absenteeism', name: 'Absenteeism Report',   desc: 'Monthly absence & late arrival analysis pulled live from RotaCloud',     Icon: AlertCircle,  color: '#EF4444', bg: 'bg-red-50'     },
  { type: 'leave',       name: 'Leave Usage Report',   desc: 'Leave taken per employee for the selected year, matched from RotaCloud',  Icon: Calendar,     color: '#F59E0B', bg: 'bg-amber-50'   },
  { type: 'turnover',    name: 'Turnover Report',      desc: 'Active vs departed staff with monthly headcount trend',                  Icon: TrendingDown, color: '#EC4899', bg: 'bg-pink-50'    },
  { type: 'performance', name: 'Performance Report',   desc: 'Performance review scores and goal completion rates',                   Icon: Star,         color: '#8B5CF6', bg: 'bg-violet-50'  },
  { type: 'training',    name: 'Training Compliance',  desc: 'Mandatory training completion status across all staff',                 Icon: BookOpen,     color: '#10B981', bg: 'bg-emerald-50' },
  { type: 'payroll',     name: 'Payroll Summary',      desc: 'Salary cost aggregated by department from payroll runs',                Icon: Banknote,     color: '#059669', bg: 'bg-green-50'   },
  { type: 'audit',       name: 'Audit Trail Report',   desc: 'Complete log of all system actions by user',                           Icon: Shield,       color: '#6B7280', bg: 'bg-gray-50'    },
]

// ── Helpers ───────────────────────────────────────────────────────────

function downloadExcel(reportName: string, headers: string[], rows: (string | number)[][]) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 26 : 16 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `CCE_${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Report Modal ──────────────────────────────────────────────────────

function ReportModal({ type, employees, runs, onClose }: {
  type: ReportType
  employees: FirebaseEmployee[]
  runs: ReturnType<typeof useFirebasePayroll>['runs']
  onClose: () => void
}) {
  const today        = new Date()
  const defMonth     = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const defYear      = String(today.getFullYear())
  const cfg          = REPORT_CONFIG.find(r => r.type === type)!

  const [month,         setMonth]         = useState(defMonth)
  const [year,          setYear]          = useState(defYear)
  const [selectedRunId, setSelectedRunId] = useState(runs[0]?.id ?? '')
  const [data,          setData]          = useState<ReportData | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')

  // Firebase-only reports auto-generate on open
  useEffect(() => {
    if (['headcount', 'turnover', 'performance', 'training'].includes(type)) generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  // Payroll report re-generates when run changes
  useEffect(() => {
    if (type === 'payroll' && selectedRunId) generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId])

  const generate = async () => {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const rotaToEmp = new Map<number, FirebaseEmployee>()
      employees.forEach(e => { if (e.rotacloudId) rotaToEmp.set(Number(e.rotacloudId), e) })
      const active = employees.filter(e => !e.status || e.status === 'active')

      switch (type) {

        // ── Headcount ─────────────────────────────────────────────────
        case 'headcount': {
          const headers = ['Employee ID','Name','Department','Job Title','Employment Type','Pay Type','Start Date','Status']
          const rows = active
            .sort((a, b) => (a.department ?? '').localeCompare(b.department ?? ''))
            .map(e => [
              e.employeeId ?? '—',
              e.name,
              e.department ?? '—',
              e.jobTitle ?? '—',
              e.employmentType ?? '—',
              e.payType === 'hourly' ? 'Hourly' : e.payType === 'fixed_monthly' ? 'Fixed Monthly' : '—',
              e.startDate ?? '—',
              e.status ?? 'active',
            ])
          const byDept: Record<string, number> = {}
          active.forEach(e => { const d = e.department ?? 'Unknown'; byDept[d] = (byDept[d] ?? 0) + 1 })
          setData({
            headers, rows,
            summary: [
              { label: 'Total Active',   value: active.length },
              { label: 'Departments',    value: Object.keys(byDept).length },
              { label: 'Hourly Staff',   value: active.filter(e => e.payType === 'hourly').length, sub: `${active.filter(e => e.payType === 'fixed_monthly').length} fixed monthly` },
              { label: 'EOBI Enrolled',  value: active.filter(e => e.eobi).length },
            ],
          })
          break
        }

        // ── Absenteeism ───────────────────────────────────────────────
        case 'absenteeism': {
          const { start, end } = monthToUnix(month)
          const [atts, shifts] = await Promise.all([
            fetchRotaAttendance(start, end),
            fetchRotaShifts(start, end),
          ])

          const attsByUser   = new Map<number, typeof atts>()
          const shiftsByUser = new Map<number, typeof shifts>()
          for (const a of atts)   { if (!a.deleted) { if (!attsByUser.has(a.user)) attsByUser.set(a.user, []); attsByUser.get(a.user)!.push(a) } }
          for (const s of shifts) { if (!s.deleted && s.published && !s.open) { if (!shiftsByUser.has(s.user)) shiftsByUser.set(s.user, []); shiftsByUser.get(s.user)!.push(s) } }

          const headers = ['Name','Department','Scheduled Shifts','Completed','Absent','Late Count','Total Late (min)','Attendance %']
          const rows: (string | number)[][] = []
          let totalAbsent = 0, totalLate = 0

          for (const [rotaId, emp] of rotaToEmp.entries()) {
            const empShifts = shiftsByUser.get(rotaId) ?? []
            const empAtts   = attsByUser.get(rotaId)   ?? []
            const scheduled = empShifts.length
            const completed = empAtts.filter(a => a.in_time_clocked && a.out_time_clocked).length
            const absent    = Math.max(0, scheduled - completed)
            const lateCount = empAtts.filter(a => a.minutes_late > 0).length
            const lateMin   = empAtts.reduce((s, a) => s + (a.minutes_late || 0), 0)
            const pct       = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 100
            totalAbsent += absent
            totalLate   += lateCount
            rows.push([emp.name, emp.department ?? '—', scheduled, completed, absent, lateCount, lateMin, `${pct}%`])
          }
          rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))

          const avgPct = rows.length > 0
            ? Math.round(rows.reduce((s, r) => s + parseInt(String(r[7])), 0) / rows.length)
            : 0

          setData({
            headers, rows,
            summary: [
              { label: 'Employees Tracked',  value: rows.length },
              { label: 'Total Absent Shifts', value: totalAbsent },
              { label: 'Late Instances',      value: totalLate },
              { label: 'Avg Attendance',      value: `${avgPct}%` },
            ],
          })
          break
        }

        // ── Leave Usage ───────────────────────────────────────────────
        case 'leave': {
          const leaveTypes = await fetchRotaLeaveTypes()
          const typeMap: Record<number, string> = {}
          leaveTypes.forEach(lt => { typeMap[lt.id] = lt.name })

          const rotaEmps = employees.filter(e => e.rotacloudId != null)
          const allLeave = await Promise.all(
            rotaEmps.map(async emp => {
              try {
                const leaves = await fetchRotaLeave(Number(emp.rotacloudId))
                return leaves
                  .filter(l => l.start_date.startsWith(year))
                  .map(l => [emp.name, emp.department ?? '—', typeMap[l.leave_type] ?? 'Unknown', l.start_date, l.end_date, l.days, l.status] as (string | number)[])
              } catch { return [] as (string | number)[][] }
            })
          )
          const rows = (allLeave as (string | number)[][][]).flat().sort((a, b) => String(a[0]).localeCompare(String(b[0])))
          const totalDays = rows.reduce((s, r) => s + Number(r[5]), 0)
          const typeCount: Record<string, number> = {}
          rows.forEach(r => { const t = String(r[2]); typeCount[t] = (typeCount[t] ?? 0) + 1 })
          const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

          setData({
            headers: ['Name','Department','Leave Type','Start Date','End Date','Days','Status'],
            rows,
            summary: [
              { label: 'Total Records',    value: rows.length },
              { label: 'Total Days Taken', value: totalDays },
              { label: 'Most Used Type',   value: topType },
              { label: 'Approved',         value: rows.filter(r => r[6] === 'approved').length, sub: `${rows.filter(r => r[6] === 'pending').length} pending` },
            ],
          })
          break
        }

        // ── Turnover ──────────────────────────────────────────────────
        case 'turnover': {
          const activeCount   = employees.filter(e => !e.status || e.status === 'active').length
          const inactiveCount = employees.filter(e => e.status && e.status !== 'active').length
          setData({
            headers: ['Name','Department','Job Title','Employment Type','Start Date','Status'],
            rows: employees
              .sort((a, b) => (a.status ?? 'active').localeCompare(b.status ?? 'active'))
              .map(e => [e.name, e.department ?? '—', e.jobTitle ?? '—', e.employmentType ?? '—', e.startDate ?? '—', e.status ?? 'active']),
            summary: [
              { label: 'Total Staff',      value: employees.length },
              { label: 'Active',           value: activeCount },
              { label: 'Inactive / Left',  value: inactiveCount },
              { label: 'Turnover Rate',    value: employees.length > 0 ? `${Math.round((inactiveCount / employees.length) * 100)}%` : '0%' },
            ],
          })
          break
        }

        // ── Performance ───────────────────────────────────────────────
        case 'performance': {
          const snap = await getDocs(collection(db, 'performance'))
          const docs = snap.docs.map(d => d.data() as Record<string, unknown>)
          if (docs.length === 0) { setData({ headers: [], rows: [], summary: [{ label: 'Reviews Found', value: 0 }] }); break }
          const keys    = Array.from(new Set(docs.flatMap(d => Object.keys(d)))).filter(k => !['createdAt','updatedAt'].includes(k))
          const headers = keys.map(k => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()))
          const rows    = docs.map(d => keys.map(k => { const v = d[k]; if (v == null) return '—'; if (typeof v === 'object') return JSON.stringify(v); return String(v) }))
          setData({ headers, rows, summary: [{ label: 'Reviews', value: docs.length }] })
          break
        }

        // ── Training ──────────────────────────────────────────────────
        case 'training': {
          const snap = await getDocs(collection(db, 'training'))
          const docs = snap.docs.map(d => d.data() as Record<string, unknown>)
          if (docs.length === 0) { setData({ headers: [], rows: [], summary: [{ label: 'Records Found', value: 0 }] }); break }
          const keys    = Array.from(new Set(docs.flatMap(d => Object.keys(d)))).filter(k => !['createdAt','updatedAt'].includes(k))
          const headers = keys.map(k => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()))
          const rows    = docs.map(d => keys.map(k => { const v = d[k]; if (v == null) return '—'; if (typeof v === 'object') return JSON.stringify(v); return String(v) }))
          setData({ headers, rows, summary: [{ label: 'Training Records', value: docs.length }] })
          break
        }

        // ── Payroll Summary ───────────────────────────────────────────
        case 'payroll': {
          if (!selectedRunId) break
          const snap    = await getDocs(collection(db, 'payroll_runs', selectedRunId, 'entries'))
          const entries = snap.docs.map(d => d.data() as PayrollEntry)
          const byDept: Record<string, typeof entries> = {}
          entries.forEach(e => { const d = e.department || 'Unknown'; if (!byDept[d]) byDept[d] = []; byDept[d].push(e) })
          const rows = Object.entries(byDept).sort((a, b) => a[0].localeCompare(b[0])).map(([dept, es]) => [
            dept, es.length,
            Math.round(es.reduce((s, e) => s + e.result.grossPay, 0)),
            Math.round(es.reduce((s, e) => s + e.result.netPay, 0)),
            Math.round(es.reduce((s, e) => s + e.result.withholdingTax, 0)),
            Math.round(es.reduce((s, e) => s + e.result.eobiEmployee, 0)),
          ])
          const run = runs.find(r => r.id === selectedRunId)
          setData({
            headers: ['Department','Headcount','Gross Pay (PKR)','Net Pay (PKR)','Tax (PKR)','EOBI (PKR)'],
            rows,
            summary: [
              { label: 'Run',         value: run?.label ?? '—' },
              { label: 'Headcount',   value: entries.length },
              { label: 'Total Gross', value: fmtPKR(run?.totalGross ?? 0) },
              { label: 'Total Net',   value: fmtPKR(run?.totalNet ?? 0) },
            ],
          })
          break
        }

        case 'audit':
          setData({ headers: [], rows: [] })
          break
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const needsMonth     = type === 'absenteeism'
  const needsYear      = type === 'leave'
  const needsRunSelect = type === 'payroll'
  const needsGenerate  = ['absenteeism', 'leave'].includes(type)
  const isAudit        = type === 'audit'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
              <cfg.Icon size={16} style={{ color: cfg.color }} />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">{cfg.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{cfg.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Controls */}
          {(needsMonth || needsYear || needsRunSelect) && (
            <div className="flex items-end gap-3 flex-wrap">
              {needsMonth && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Month</label>
                  <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              )}
              {needsYear && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Year</label>
                  <select value={year} onChange={e => setYear(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {[0, 1, 2].map(i => { const y = String(today.getFullYear() - i); return <option key={y} value={y}>{y}</option> })}
                  </select>
                </div>
              )}
              {needsRunSelect && runs.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Payroll Run</label>
                  <select value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {runs.map(r => <option key={r.id} value={r.id}>{r.label} ({r.status})</option>)}
                  </select>
                </div>
              )}
              {needsGenerate && (
                <button onClick={generate} disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition disabled:opacity-50">
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Fetching from RotaCloud…' : 'Generate Report'}
                </button>
              )}
            </div>
          )}

          {/* Audit placeholder */}
          {isAudit && (
            <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center space-y-3">
              <Shield size={36} className="text-gray-300 mx-auto" />
              <p className="text-sm font-semibold text-gray-500">Audit Trail — Coming Soon</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                A full log of all system actions (employee edits, payroll runs, approvals) will be
                captured automatically once this feature is enabled.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="py-16 text-center text-sm text-gray-400">
              <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-gray-300" />
              Generating…
            </div>
          )}

          {/* Report content */}
          {!loading && !isAudit && data && (
            <>
              {/* Summary cards */}
              {data.summary && data.summary.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {data.summary.map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
                      <p className="text-lg font-bold text-secondary mt-0.5">{s.value}</p>
                      {s.sub && <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {data.rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center space-y-2">
                  <FileText size={32} className="text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-400">No data found for the selected period.</p>
                  {['absenteeism', 'leave'].includes(type) && (
                    <p className="text-xs text-gray-400">Make sure employees have a RotaCloud ID linked in their profile.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex justify-end">
                    <button onClick={() => downloadExcel(cfg.name, data.headers, data.rows)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-300 text-green-700 text-xs font-semibold hover:bg-green-50 transition">
                      <Download size={12} /> Export Excel
                    </button>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {data.headers.map(h => (
                              <th key={h} className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide text-left whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {data.rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-gray-50/50">
                              {row.map((cell, ci) => (
                                <td key={ci} className={cn('px-3 py-2 text-xs tabular-nums', ci === 0 ? 'font-semibold text-secondary' : 'text-gray-600')}>
                                  {data.headers[ci]?.toLowerCase() === 'status' ? (
                                    <span className={cn(
                                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                                      String(cell) === 'active' || String(cell) === 'approved'
                                        ? 'bg-green-100 text-green-700'
                                        : String(cell) === 'pending'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-gray-100 text-gray-500'
                                    )}>{cell}</span>
                                  ) : cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function Reports() {
  const { employees, loading: empLoading } = useFirebaseEmployees()
  const { runs }                           = useFirebasePayroll()
  const [activeReport, setActiveReport]    = useState<ReportType | null>(null)

  const today  = new Date()
  const active = useMemo(() => employees.filter(e => !e.status || e.status === 'active'), [employees])

  // Headcount trend — last 12 months from Firebase startDates
  const headcountTrend = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d        = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const label    = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    const count    = active.filter(e => !e.startDate || new Date(e.startDate) <= monthEnd).length
    return { month: label, count }
  }), [active])

  // Department distribution
  const deptData = useMemo(() => {
    const counts: Record<string, number> = {}
    active.forEach(e => { const d = e.department || 'Unknown'; counts[d] = (counts[d] ?? 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value], i) => ({ name, value, color: DEPT_COLORS[i % DEPT_COLORS.length] }))
  }, [active])

  // Payroll net cost trend from runs
  const payrollTrend = useMemo(() =>
    [...runs].sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map(r => ({
      month: new Date(r.month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      net: r.totalNet,
    }))
  , [runs])

  // Pay type counts
  const hourlyCount  = active.filter(e => e.payType === 'hourly').length
  const fixedCount   = active.filter(e => e.payType === 'fixed_monthly').length
  const noTypeCount  = active.filter(e => !e.payType).length
  const thisMonth    = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const newThisMonth = active.filter(e => e.startDate?.startsWith(thisMonth)).length

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div>
        <h2 className="page-header">Reports & Analytics</h2>
        <p className="page-sub">Live data from Firebase & RotaCloud · Export to Excel</p>
      </div>

      {/* KPI summary cards */}
      {!empLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: 'Active Headcount',  v: active.length,    sub: `${employees.length} total on record`, c: '#2E86C1', Icon: Users     },
            { l: 'Hourly Staff',      v: hourlyCount,      sub: `${fixedCount} fixed monthly`,          c: '#F59E0B', Icon: Clock     },
            { l: 'Departments',       v: deptData.length,  sub: 'active departments',                   c: '#10B981', Icon: BarChart2 },
            { l: 'Joined This Month', v: newThisMonth,     sub: 'new hires',                            c: '#8B5CF6', Icon: Calendar  },
          ].map(k => (
            <div key={k.l} className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${k.c}18` }}>
                <k.Icon size={16} style={{ color: k.c }} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{k.l}</p>
                <p className="text-lg font-bold text-secondary">{k.v}</p>
                <p className="text-[10px] text-gray-400">{k.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Headcount trend */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-secondary mb-4">Headcount Trend — 12 Months</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={headcountTrend} margin={{ left: -20, bottom: 0, top: 4, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="count" stroke="#2E86C1" strokeWidth={2} dot={{ r: 3, fill: '#2E86C1' }} name="Headcount" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Department distribution */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-secondary mb-4">Department Distribution</p>
          {deptData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400">No employee data</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={deptData} innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={2}>
                    {deptData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {deptData.map(d => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-500 truncate max-w-[110px]">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-secondary">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payroll cost trend */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-secondary mb-4">Payroll Net Cost — Last 6 Runs</p>
          {payrollTrend.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400">No payroll runs yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={payrollTrend} barSize={20} margin={{ left: -20, bottom: 0, top: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  formatter={(v) => [fmtPKR(v as number), 'Net Pay']} />
                <Bar dataKey="net" fill="#10B981" radius={[4, 4, 0, 0]} name="Net Pay" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pay type breakdown */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-secondary mb-4">Pay Type Distribution</p>
          <div className="space-y-3 mt-2">
            {[
              { label: 'Hourly',        count: hourlyCount, color: '#F59E0B' },
              { label: 'Fixed Monthly', count: fixedCount,  color: '#2E86C1' },
              ...(noTypeCount > 0 ? [{ label: 'Not Set', count: noTypeCount, color: '#9CA3AF' }] : []),
            ].map(pt => (
              <div key={pt.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">{pt.label}</span>
                  <span className="font-semibold text-secondary">{pt.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: active.length > 0 ? `${(pt.count / active.length) * 100}%` : '0%', backgroundColor: pt.color }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 text-right pt-1">{active.length} active employees total</p>
          </div>
        </div>
      </div>

      {/* Pre-built report cards */}
      <div>
        <p className="text-sm font-bold text-secondary mb-3">Pre-Built Reports</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {REPORT_CONFIG.map(r => (
            <button key={r.type} onClick={() => setActiveReport(r.type)}
              className="card p-4 flex items-center gap-4 text-left hover:shadow-md transition-shadow group">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', r.bg)}>
                <r.Icon size={18} style={{ color: r.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">{r.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{r.desc}</p>
              </div>
              <FileText size={14} className="text-gray-300 group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Report modal */}
      {activeReport && (
        <ReportModal
          type={activeReport}
          employees={employees}
          runs={runs}
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  )
}
