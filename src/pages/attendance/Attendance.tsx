import { useState } from 'react'
import { Download, Search, ChevronLeft, ChevronRight, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/common/Avatar'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useRotaAttendance, type DailyAttendanceRow } from '../../hooks/useRotaAttendance'
import { fmt12 } from '../../hooks/useFirebaseTimesheets'
import { cn } from '../../utils/cn'

// ── Helpers ───────────────────────────────────────────────────────────
function toYMD(d: Date) { return d.toISOString().slice(0, 10) }
function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function shiftDate(s: string, n: number) {
  const d = new Date(s + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toYMD(d)
}

// ── Status config ─────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; dot: string; pill: string }> = {
  clocked_in:     { label: 'Clocked In',     dot: 'bg-green-500 animate-pulse', pill: 'bg-green-100 text-green-700 border border-green-200' },
  present:        { label: 'Present',         dot: 'bg-green-400',               pill: 'bg-green-50 text-green-700 border border-green-100'  },
  late:           { label: 'Late',            dot: 'bg-amber-400',               pill: 'bg-amber-50 text-amber-700 border border-amber-100'  },
  half_day:       { label: 'Half Day',        dot: 'bg-purple-400',              pill: 'bg-purple-50 text-purple-700 border border-purple-100'},
  absent:         { label: 'Absent',          dot: 'bg-red-400',                 pill: 'bg-red-50 text-red-700 border border-red-100'        },
  not_clocked_in: { label: 'Not Clocked In',  dot: 'bg-gray-300',                pill: 'bg-gray-100 text-gray-500 border border-gray-200'    },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.not_clocked_in
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full', cfg.pill)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function fmtHrs(h: number) {
  if (!h) return '—'
  return `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`
}

// ── Export to CSV ─────────────────────────────────────────────────────
function exportCSV(rows: DailyAttendanceRow[], date: string) {
  const header = 'Employee,Department,Clock In,Clock Out,Hours Worked,Overtime,Late (min),Status'
  const body = rows.map(r =>
    `"${r.employeeName}","${r.department}","${r.clockIn ? fmt12(r.clockIn) : '—'}","${r.clockOut ? fmt12(r.clockOut) : '—'}","${r.hoursWorked.toFixed(2)}","${r.overtime.toFixed(2)}","${r.minutesLate}","${STATUS_CFG[r.status]?.label ?? r.status}"`
  ).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `attendance-${date}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Main page ─────────────────────────────────────────────────────────
export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState(toYMD(new Date()))
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const { employees } = useFirebaseEmployees()
  const { rows, weeklyData, counts, loading, error } = useRotaAttendance(selectedDate, employees)

  const today   = toYMD(new Date())
  const isToday = selectedDate === today

  const unlinked = employees.filter(e => e.status === 'active' && !e.rotacloudId).length

  const filtered = rows.filter(r => {
    const matchSearch = !search ||
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.department.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Attendance Tracking</h2>
          <p className="page-sub">{fmtDate(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setSelectedDate(d => shiftDate(d, -1))}
              className="px-2 py-1.5 hover:bg-gray-50 transition text-gray-500">
              <ChevronLeft size={15} />
            </button>
            <input type="date" value={selectedDate} max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-sm text-gray-700 px-1 py-1.5 focus:outline-none bg-transparent w-32" />
            <button onClick={() => setSelectedDate(d => shiftDate(d, 1))}
              disabled={isToday}
              className="px-2 py-1.5 hover:bg-gray-50 transition text-gray-500 disabled:opacity-30">
              <ChevronRight size={15} />
            </button>
          </div>
          {!isToday && (
            <button onClick={() => setSelectedDate(today)} className="btn-outline text-xs px-3 py-1.5">Today</button>
          )}
          <button onClick={() => exportCSV(rows, selectedDate)} className="btn-outline text-sm gap-2">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Could not fetch from RotaCloud</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <Link to="/settings" className="flex items-center gap-1 text-xs text-primary font-medium shrink-0">
            Settings <ExternalLink size={11} />
          </Link>
        </div>
      )}

      {/* ── Unlinked employees notice ── */}
      {!error && unlinked > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertCircle size={14} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 flex-1">
            <span className="font-semibold">{unlinked} employee{unlinked !== 1 ? 's' : ''}</span> not linked to RotaCloud — their attendance won't show.
          </p>
          <Link to="/settings" className="flex items-center gap-1 text-xs text-amber-700 font-semibold shrink-0">
            Link now <ExternalLink size={11} />
          </Link>
        </div>
      )}

      {/* ── Summary tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Present',        value: counts.present,        color: '#10B981', bg: '#10B98115' },
          { label: 'Clocked In Now', value: counts.clocked_in,     color: '#2E86C1', bg: '#2E86C115' },
          { label: 'Late',           value: counts.late,           color: '#F59E0B', bg: '#F59E0B15' },
          { label: 'Absent',         value: counts.absent,         color: '#EF4444', bg: '#EF444415' },
          { label: 'Not Clocked In', value: counts.not_clocked_in, color: '#9CA3AF', bg: '#9CA3AF15' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg }}>
              <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
            <div>
              <p className="text-base font-bold text-secondary leading-tight">{s.value}</p>
              <p className="text-[10px] text-gray-400 leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Weekly chart ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-secondary">7-Day Overview</p>
            <p className="text-xs text-gray-400">Live data from RotaCloud</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weeklyData} barSize={14} barCategoryGap="30%" margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="present" name="Present" fill="#2E86C1" radius={[3,3,0,0]} />
            <Bar dataKey="absent"  name="Absent"  fill="#EF4444" radius={[3,3,0,0]} />
            <Bar dataKey="late"    name="Late"    fill="#F59E0B" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or department…" className="input pl-9 text-sm w-full" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto text-sm">
            <option value="All">All Statuses</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-xs text-gray-400">{filtered.length} employees</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee', 'Department', 'Clock In', 'Clock Out', 'Hours', 'Overtime', 'Late', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">

              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                      <Clock size={14} className="animate-spin" /> Fetching from RotaCloud…
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    No records found.
                  </td>
                </tr>
              )}

              {!loading && filtered.map(r => (
                <tr key={r.employeeId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        <Avatar name={r.employeeName} size="xs" />
                        {r.isClockedIn && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-secondary">{r.employeeName}</p>
                        {!r.rotacloudLinked && (
                          <p className="text-[10px] text-gray-400">Not linked</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.department || '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {r.clockIn ? fmt12(r.clockIn) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {r.isClockedIn
                      ? <span className="text-green-600 text-xs font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>
                      : r.clockOut
                        ? fmt12(r.clockOut)
                        : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.hoursWorked > 0 ? fmtHrs(r.hoursWorked) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.overtime > 0
                      ? <span className="text-amber-600 font-semibold text-sm">+{fmtHrs(r.overtime)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.minutesLate > 0
                      ? <span className="text-red-500 text-xs font-semibold">{r.minutesLate}m</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
            <p className="text-xs text-gray-400">Showing {filtered.length} of {rows.length} active employees</p>
            <p className="text-xs text-gray-400">
              {counts.present} present · {counts.absent} absent · {counts.not_clocked_in} no record
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
