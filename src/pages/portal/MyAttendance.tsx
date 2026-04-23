import { useState, useEffect } from 'react'
import {
  ChevronLeft, ChevronRight, Clock, TrendingUp, CheckCircle2,
  AlertTriangle, CalendarCheck, Timer, UserX,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { useMyEmployee } from '../../hooks/useMyEmployee'
import { useFirebaseTimesheets, fmt12, fmtHours, toYMD } from '../../hooks/useFirebaseTimesheets'
import { fetchRotaAttendance, monthToUnix, type RotaAttendance } from '../../services/rotacloud'
import { unixToLocalDate, unixToHHMM } from '../../hooks/useRotaAttendance'

const DAY_HEADS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type DayStatus = 'present' | 'late' | 'absent' | 'half_day' | 'clocked_in' | 'weekend' | 'future' | 'no_record'

const STATUS_STYLE: Record<DayStatus, string> = {
  present:   'bg-green-100  text-green-700  hover:bg-green-200  cursor-pointer',
  late:      'bg-amber-100  text-amber-700  hover:bg-amber-200  cursor-pointer',
  absent:    'bg-red-100    text-red-700    hover:bg-red-200    cursor-pointer',
  half_day:  'bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer',
  clocked_in:'bg-blue-100   text-blue-700   hover:bg-blue-200   cursor-pointer',
  weekend:   'text-gray-200 cursor-default',
  future:    'text-gray-300 cursor-default',
  no_record: 'text-gray-400 hover:bg-gray-100 cursor-pointer',
}

const STATUS_LABEL: Record<DayStatus, string> = {
  present:   'Present', late: 'Late', absent: 'Absent', half_day: 'Half Day',
  clocked_in:'Active',  weekend: '', future: '', no_record: 'No Record',
}

export default function MyAttendance() {
  const { employee: myEmployee, loading: empLoading } = useMyEmployee()
  const { entries, attendance, loading: tsLoading } = useFirebaseTimesheets(myEmployee?.id ?? '')

  const today    = new Date()
  const todayYMD = toYMD(today)

  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selDay,   setSelDay]   = useState<string | null>(todayYMD)

  // RotaCloud data (optional — only for employees with rotacloudId)
  const [rotaRecords,  setRotaRecords]  = useState<RotaAttendance[]>([])
  const [rotaLoading,  setRotaLoading]  = useState(false)
  const [rotaError,    setRotaError]    = useState(false)

  const year      = viewDate.getFullYear()
  const month     = viewDate.getMonth()
  const monthName = viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const daysInMo  = new Date(year, month + 1, 0).getDate()
  const startDay  = new Date(year, month, 1).getDay()
  const monthStr  = `${year}-${String(month + 1).padStart(2, '0')}`

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  // Fetch RotaCloud if employee is linked
  useEffect(() => {
    if (!myEmployee?.rotacloudId) return
    setRotaLoading(true)
    setRotaError(false)
    const { start, end } = monthToUnix(monthStr)
    // Pass userId so proxy filters server-side
    fetchRotaAttendance(start, end, myEmployee.rotacloudId)
      .then(recs => {
        setRotaRecords(recs.filter(r => !r.deleted))
        setRotaLoading(false)
      })
      .catch(() => { setRotaError(true); setRotaLoading(false) })
  }, [monthStr, myEmployee?.rotacloudId])

  // Index RotaCloud by date
  const rotaByDate = new Map<string, RotaAttendance>()
  for (const r of rotaRecords) {
    const dateStr  = unixToLocalDate(r.in_time)
    const existing = rotaByDate.get(dateStr)
    if (!existing || r.approved) rotaByDate.set(dateStr, r)
  }

  // ── Build per-day status ───────────────────────────────────────────────
  const dayStatus = new Map<string, DayStatus>()
  const useRota   = myEmployee?.rotacloudId && rotaRecords.length > 0 && !rotaError

  for (let d = 1; d <= daysInMo; d++) {
    const date    = new Date(year, month, d)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow     = date.getDay()

    if (dow === 0 || dow === 6) { dayStatus.set(dateStr, 'weekend');   continue }
    if (dateStr > todayYMD)     { dayStatus.set(dateStr, 'future');    continue }

    if (useRota) {
      // ── RotaCloud source ──
      const rec = rotaByDate.get(dateStr)
      if (!rec) {
        dayStatus.set(dateStr, dateStr < todayYMD ? 'absent' : 'no_record')
      } else if (rec.in_time_clocked && !rec.out_time_clocked) {
        dayStatus.set(dateStr, 'clocked_in')
      } else if (rec.hours > 0) {
        if (rec.hours < 4)           dayStatus.set(dateStr, 'half_day')
        else if (rec.minutes_late > 30) dayStatus.set(dateStr, 'late')
        else                          dayStatus.set(dateStr, 'present')
      } else {
        dayStatus.set(dateStr, 'no_record')
      }
    } else {
      // ── Firebase source ──
      // HR-marked record takes priority
      const hrRec = attendance.find(a => a.date === dateStr)
      if (hrRec) { dayStatus.set(dateStr, hrRec.status as DayStatus); continue }

      const dayEntries = entries.filter(e => e.date === dateStr)
      const active     = dayEntries.find(e => e.clockedIn)
      const completed  = dayEntries.filter(e => !e.clockedIn && e.hours > 0)

      if (active)              dayStatus.set(dateStr, 'clocked_in')
      else if (completed.length > 0) dayStatus.set(dateStr, 'present')
      else                           dayStatus.set(dateStr, 'no_record')
      // Note: we do NOT auto-mark as absent — only HR can mark absent
    }
  }

  // ── Monthly stats ──────────────────────────────────────────────────────
  let present = 0, late = 0, absent = 0, halfDay = 0, totalHours = 0
  dayStatus.forEach(s => {
    if (s === 'present' || s === 'clocked_in') present++
    else if (s === 'late')     late++
    else if (s === 'absent')   absent++
    else if (s === 'half_day') halfDay++
  })

  if (useRota) {
    rotaByDate.forEach(r => { totalHours += r.hours })
  } else {
    totalHours = entries
      .filter(e => e.date.startsWith(monthStr) && !e.clockedIn)
      .reduce((s, e) => s + e.hours, 0)
  }

  const attended  = present + late + halfDay
  const workDays  = attended + absent
  const attendancePct = workDays > 0 ? Math.round((attended / workDays) * 100) : (attended > 0 ? 100 : 0)

  // ── Selected day detail ────────────────────────────────────────────────
  const selRota    = selDay ? rotaByDate.get(selDay) : undefined
  const selEntries = selDay ? entries.filter(e => e.date === selDay).sort((a, b) =>
    (a.startTime ?? '').localeCompare(b.startTime ?? '')) : []
  const selHrRec   = selDay ? attendance.find(a => a.date === selDay) : undefined
  const selStatus  = selDay ? dayStatus.get(selDay) : undefined

  // ── 4-week bar chart ───────────────────────────────────────────────────
  const weekData = Array.from({ length: 4 }, (_, w) => {
    const ws = new Date(today)
    ws.setDate(today.getDate() - (3 - w) * 7 - (today.getDay() || 7) + 1)
    let hrs = 0
    for (let d = 0; d < 5; d++) {
      const dd = new Date(ws); dd.setDate(ws.getDate() + d)
      const ds = toYMD(dd)
      if (useRota) hrs += rotaByDate.get(ds)?.hours ?? 0
      else hrs += entries.filter(e => e.date === ds && !e.clockedIn).reduce((s, e) => s + e.hours, 0)
    }
    return { week: `W${w + 1}`, hours: Math.round(hrs * 10) / 10 }
  })

  const dayClass = (status: DayStatus | undefined, isToday: boolean, isSel: boolean) => {
    const base = `aspect-square text-[11px] font-semibold rounded-xl flex items-center justify-center transition-all
      ${isSel   ? 'ring-2 ring-primary ring-offset-1' : ''}
      ${isToday && !isSel ? 'ring-2 ring-secondary ring-offset-1' : ''}`
    return `${base} ${STATUS_STYLE[status ?? 'no_record']}`
  }

  const isLoading = empLoading || tsLoading || rotaLoading

  // ── Not linked state ───────────────────────────────────────────────────
  if (!empLoading && !myEmployee) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <UserX size={28} className="text-red-300" />
        </div>
        <p className="text-base font-bold text-secondary">Employee profile not linked</p>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Your account is not connected to an employee record. Please contact HR.
        </p>
      </div>
    )
  }

  const hasAnyData = attended > 0 || absent > 0 || totalHours > 0

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #0f1629 0%, #12121E 50%, #0f1a0f 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(46,134,193,0.4), transparent 65%)' }} />
        <div className="absolute bottom-0 left-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.2), transparent 65%)' }} />

        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 px-3 py-1 rounded-full">
              <CalendarCheck size={12} className="text-blue-400" />
              <span className="text-blue-300 text-[11px] font-semibold tracking-wide">ATTENDANCE</span>
            </div>
            {useRota && (
              <span className="text-[10px] bg-green-500/20 border border-green-500/30 text-green-300 px-2 py-0.5 rounded-full font-semibold">
                RotaCloud synced
              </span>
            )}
            {myEmployee?.rotacloudId && rotaError && (
              <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                RotaCloud offline — showing local data
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-white/50 text-sm mt-2">Your attendance history and punch records.</p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Attendance Rate',
                value: hasAnyData ? `${attendancePct}%` : '—',
                color: !hasAnyData ? '#6B7280' : attendancePct >= 90 ? '#6EE7B7' : '#FCD34D',
              },
              { label: 'Present Days',  value: hasAnyData ? String(present + halfDay) : '—', color: '#86EFAC' },
              { label: 'Late Arrivals', value: hasAnyData ? String(late)              : '—', color: late > 0 ? '#FDE68A' : '#6B7280' },
              { label: 'Hours Worked',  value: hasAnyData ? fmtHours(totalHours)      : '—', color: '#93C5FD' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-1">{s.label}</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── No data banner ── */}
      {!isLoading && !hasAnyData && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <CalendarCheck size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">No attendance records yet</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Use the Punch In button on your dashboard to record attendance, or wait for HR to sync your records.
            </p>
          </div>
        </div>
      )}

      {/* ── Summary badges ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Present',  value: present,  Icon: CheckCircle2, bg: 'bg-green-50',  text: 'text-green-700',  iconBg: 'bg-green-100'  },
          { label: 'Late',     value: late,      Icon: Timer,        bg: 'bg-amber-50',  text: 'text-amber-700',  iconBg: 'bg-amber-100'  },
          { label: 'Absent',   value: absent,    Icon: AlertTriangle,bg: 'bg-red-50',    text: 'text-red-700',    iconBg: 'bg-red-100'    },
          { label: 'Half Day', value: halfDay,   Icon: Clock,        bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100' },
        ].map(s => (
          <div key={s.label} className={`card p-4 flex items-center gap-3 ${s.bg}`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
              <s.Icon size={18} className={s.text} />
            </div>
            <div>
              <p className={`text-2xl font-bold tabular-nums ${s.text}`}>{s.value}</p>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Calendar + Detail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Calendar */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-secondary">{monthName}</p>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth}
                className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <button onClick={nextMonth}
                className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
              <Clock size={14} className="animate-spin" /> Loading attendance…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_HEADS.map(d => (
                  <span key={d} className="text-[10px] text-gray-400 font-bold text-center py-1">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array(startDay).fill(null).map((_, i) => <span key={`pad-${i}`} />)}
                {Array.from({ length: daysInMo }, (_, i) => {
                  const d       = i + 1
                  const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const status  = dayStatus.get(dateStr)
                  const isToday = dateStr === todayYMD
                  const isSel   = dateStr === selDay
                  return (
                    <button key={d}
                      onClick={() => status !== 'weekend' && status !== 'future' && setSelDay(dateStr)}
                      className={dayClass(status, isToday, isSel)}>
                      {d}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-50 flex-wrap">
            {[
              { l: 'Present',   c: 'bg-green-200'  },
              { l: 'Late',      c: 'bg-amber-200'  },
              { l: 'Absent',    c: 'bg-red-200'    },
              { l: 'Half Day',  c: 'bg-purple-200' },
              { l: 'Active',    c: 'bg-blue-200'   },
              { l: 'No record', c: 'bg-gray-100 border border-gray-200' },
            ].map(s => (
              <div key={s.l} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-md ${s.c}`} />
                <span className="text-[10px] text-gray-500">{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Selected day detail */}
          <div className="card p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-secondary">
                {selDay
                  ? (() => {
                      const [y, m, d] = selDay.split('-').map(Number)
                      return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })
                    })()
                  : 'Select a day'}
              </p>
              {selStatus && !['weekend','future','no_record'].includes(selStatus) && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selStatus === 'present' || selStatus === 'clocked_in' ? 'bg-green-100 text-green-700'
                  : selStatus === 'late'     ? 'bg-amber-100 text-amber-700'
                  : selStatus === 'absent'   ? 'bg-red-100 text-red-700'
                  : selStatus === 'half_day' ? 'bg-purple-100 text-purple-700'
                  : ''
                }`}>{STATUS_LABEL[selStatus]}</span>
              )}
            </div>

            {selHrRec && (
              <div className="flex items-center gap-1.5 mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <TrendingUp size={12} className="text-blue-500" />
                <span className="text-[11px] text-blue-700 font-semibold">
                  Marked by HR · {selHrRec.status}
                  {selHrRec.markedBy ? ` · ${selHrRec.markedBy}` : ''}
                </span>
              </div>
            )}

            {/* RotaCloud record */}
            {selRota && (
              <div className="space-y-2">
                <div className="flex items-start justify-between py-2 border-b border-gray-50">
                  <div>
                    <p className="text-xs font-semibold text-secondary">
                      {selRota.in_time_clocked && !selRota.out_time_clocked
                        ? `In: ${fmt12(unixToHHMM(selRota.in_time_clocked))} — active`
                        : selRota.in_time_clocked && selRota.out_time_clocked
                          ? `${fmt12(unixToHHMM(selRota.in_time_clocked))} → ${fmt12(unixToHHMM(selRota.out_time_clocked))}`
                          : 'No clock times'}
                    </p>
                    {selRota.minutes_late > 0 && (
                      <p className="text-[10px] text-amber-600 mt-0.5">{selRota.minutes_late} min late</p>
                    )}
                    {selRota.minutes_break > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{selRota.minutes_break} min break</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-primary tabular-nums shrink-0">
                    {selRota.in_time_clocked && !selRota.out_time_clocked ? 'Live' : fmtHours(selRota.hours)}
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selRota.approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {selRota.approved ? 'Approved' : 'Pending approval'}
                </span>
              </div>
            )}

            {/* Firebase entries */}
            {!selRota && selEntries.length > 0 && (
              <div className="space-y-2">
                {selEntries.map(e => (
                  <div key={e.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-semibold text-secondary">
                        {e.clockedIn
                          ? `In: ${fmt12(e.startTime)} — active`
                          : `${fmt12(e.startTime)} → ${fmt12(e.endTime)}`}
                      </p>
                      {e.projectTask && <p className="text-[10px] text-gray-400 mt-0.5">{e.projectTask}</p>}
                    </div>
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${e.clockedIn ? 'text-blue-600' : 'text-primary'}`}>
                      {e.clockedIn ? 'Live' : fmtHours(e.hours)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-gray-400">Day total</span>
                  <span className="text-sm font-bold text-secondary tabular-nums">
                    {fmtHours(selEntries.filter(e => !e.clockedIn).reduce((s, e) => s + e.hours, 0))}
                  </span>
                </div>
              </div>
            )}

            {!selRota && selEntries.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {selStatus === 'absent' ? 'Marked absent.' : 'No records for this day.'}
              </p>
            )}
          </div>

          {/* 4-week chart */}
          <div className="card p-5">
            <p className="text-sm font-bold text-secondary mb-3">4-Week Hours</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={weekData} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  formatter={(v: number) => [`${v}h`, 'Hours']}
                />
                <Bar dataKey="hours" radius={[5, 5, 0, 0]}>
                  {weekData.map((entry, i) => (
                    <Cell key={i} fill={entry.hours >= 35 ? '#10B981' : entry.hours >= 20 ? '#2E86C1' : entry.hours > 0 ? '#93C5FD' : '#E5E7EB'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> ≥35h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> ≥20h</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200" /> Any</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
