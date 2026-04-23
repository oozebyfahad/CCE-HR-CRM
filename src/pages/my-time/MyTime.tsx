import { useState, useEffect } from 'react'
import {
  CalendarClock, ChevronLeft, ChevronRight, Clock, RefreshCw,
  CheckCircle2, AlertCircle, TrendingUp, Timer, CalendarDays, Zap,
} from 'lucide-react'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import {
  fetchRotaAttendance, fetchRotaShifts, monthToUnix,
  type RotaAttendance, type RotaShift,
} from '../../services/rotacloud'
import { unixToHHMM, unixToLocalDate } from '../../hooks/useRotaAttendance'
import { fmt12, fmtHours } from '../../hooks/useFirebaseTimesheets'
import { cn } from '../../utils/cn'

// ── Helpers ────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentMonthStr(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function fmtMonthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getWeekStart(offset: number): Date {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function weekDates(offset: number): string[] {
  const mon = getWeekStart(offset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return toYMD(d)
  })
}

function weekUnixRange(offset: number): { start: number; end: number } {
  const mon = getWeekStart(offset)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59)
  return {
    start: Math.floor(mon.getTime() / 1000),
    end:   Math.floor(sun.getTime() / 1000),
  }
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00').getDay()
  return d === 0 || d === 6
}

function fmtDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function dayName(dateStr: string, short = false): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: short ? 'short' : 'long' })
}

function indexAtt(recs: RotaAttendance[]): Map<string, RotaAttendance> {
  const m = new Map<string, RotaAttendance>()
  for (const r of recs) {
    const unix = (r.in_time_clocked ?? r.in_time) as number
    const d = unixToLocalDate(unix)
    const ex = m.get(d)
    if (!ex || r.approved) m.set(d, r)
  }
  return m
}

function indexShifts(recs: RotaShift[]): Map<string, RotaShift> {
  const m = new Map<string, RotaShift>()
  for (const s of recs) {
    const d = unixToLocalDate(s.start_time)
    if (!m.has(d)) m.set(d, s)
  }
  return m
}

type DayStatus = 'live' | 'present' | 'late' | 'half_day' | 'absent' | 'day_off' | 'future'

function deriveStatus(att: RotaAttendance | undefined, dateStr: string, todayStr: string): DayStatus {
  const weekend = isWeekend(dateStr)
  const future  = dateStr > todayStr
  if (!att) {
    if (weekend) return 'day_off'
    if (future)  return 'future'
    return 'absent'
  }
  const stilIn = !!att.in_time_clocked && !att.out_time_clocked
  if (stilIn)                                         return 'live'
  if (att.hours > 0 && att.hours < 4)                return 'half_day'
  if (att.hours >= 4 && att.minutes_late > 30)        return 'late'
  return 'present'
}

const STATUS_CFG: Record<DayStatus, { label: string; pill: string; dot: string }> = {
  live:     { label: 'Live',     pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500 animate-pulse' },
  present:  { label: 'Present',  pill: 'bg-green-100 text-green-700',     dot: 'bg-green-500'   },
  late:     { label: 'Late',     pill: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  half_day: { label: 'Half Day', pill: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-500'  },
  absent:   { label: 'Absent',   pill: 'bg-red-100 text-red-600',         dot: 'bg-red-400'     },
  day_off:  { label: 'Day Off',  pill: 'bg-gray-100 text-gray-400',       dot: 'bg-gray-300'    },
  future:   { label: '—',        pill: '',                                 dot: 'bg-gray-200'    },
}

// ── Status badge ───────────────────────────────────────────────────────
function StatusPill({ status, approved }: { status: DayStatus; approved?: boolean }) {
  const cfg = STATUS_CFG[status]
  if (!cfg.pill) return <span className="text-gray-300 text-xs">—</span>
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full', cfg.pill)}>
      {cfg.label}
      {approved && status !== 'absent' && status !== 'day_off' && status !== 'future' && (
        <CheckCircle2 size={9} />
      )}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────
export default function MyTime() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees, loading: empLoading } = useFirebaseEmployees()
  const myEmployee = employees.find(e => e.email === currentUser?.email)
  const rcId = myEmployee?.rotacloudId ? Number(myEmployee.rotacloudId) : null
  const todayStr = toYMD(new Date())

  const [tab,        setTab]        = useState<'week' | 'month'>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [month,      setMonth]      = useState(currentMonthStr)

  // Week data
  const [weekAtt,     setWeekAtt]     = useState<RotaAttendance[]>([])
  const [weekShifts,  setWeekShifts]  = useState<RotaShift[]>([])
  const [weekLoading, setWeekLoading] = useState(false)

  // Month data
  const [monthAtt,     setMonthAtt]     = useState<RotaAttendance[]>([])
  const [monthShifts,  setMonthShifts]  = useState<RotaShift[]>([])
  const [monthLoading, setMonthLoading] = useState(false)
  const [error,        setError]        = useState('')

  // Fetch week
  useEffect(() => {
    if (!rcId) return
    let cancelled = false
    setWeekLoading(true)
    setError('')
    const { start, end } = weekUnixRange(weekOffset)
    Promise.all([fetchRotaAttendance(start, end), fetchRotaShifts(start, end)])
      .then(([att, sh]) => {
        if (cancelled) return
        setWeekAtt(att.filter(r => !r.deleted && r.user === rcId))
        setWeekShifts(sh.filter(s => !s.deleted && s.published && !s.open && s.user === rcId))
        setWeekLoading(false)
      })
      .catch(e => { if (!cancelled) { setError(e.message); setWeekLoading(false) } })
    return () => { cancelled = true }
  }, [rcId, weekOffset])

  // Fetch month
  useEffect(() => {
    if (!rcId) return
    let cancelled = false
    setMonthLoading(true)
    setError('')
    const { start, end } = monthToUnix(month)
    Promise.all([fetchRotaAttendance(start, end), fetchRotaShifts(start, end)])
      .then(([att, sh]) => {
        if (cancelled) return
        setMonthAtt(att.filter(r => !r.deleted && r.user === rcId))
        setMonthShifts(sh.filter(s => !s.deleted && s.published && !s.open && s.user === rcId))
        setMonthLoading(false)
      })
      .catch(e => { if (!cancelled) { setError(e.message); setMonthLoading(false) } })
    return () => { cancelled = true }
  }, [rcId, month])

  // Derived week data
  const wAttMap   = indexAtt(weekAtt)
  const wShiftMap = indexShifts(weekShifts)
  const wDates    = weekDates(weekOffset)
  const weekStart = getWeekStart(weekOffset)
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const wRangeLabel = `${fmtDateLabel(toYMD(weekStart))} – ${fmtDateLabel(toYMD(weekEnd))}`

  const wWorked    = wDates.filter(d => { const a = wAttMap.get(d); return a && a.hours > 0 }).length
  const wHours     = [...wAttMap.values()].reduce((s, r) => s + r.hours, 0)
  const wOvertime  = [...wAttMap.values()].reduce((s, r) => s + Math.max(0, r.hours - 8), 0)
  const wLate      = [...wAttMap.values()].filter(r => r.minutes_late > 30).length

  // Derived month data
  const [my, mmo] = month.split('-').map(Number)
  const daysInMonth  = new Date(my, mmo, 0).getDate()
  const mAttMap      = indexAtt(monthAtt)
  const mShiftMap    = indexShifts(monthShifts)
  const mDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dd   = String(i + 1).padStart(2, '0')
    const date = `${month}-${dd}`
    return { date, att: mAttMap.get(date), shift: mShiftMap.get(date) }
  })
  const mWorked   = [...mAttMap.values()].filter(r => r.hours > 0 || r.in_time_clocked).length
  const mHours    = [...mAttMap.values()].reduce((s, r) => s + r.hours, 0)
  const mOvertime = [...mAttMap.values()].reduce((s, r) => s + Math.max(0, r.hours - 8), 0)
  const mAbsent   = mDays.filter(({ date, att }) => !att && !isWeekend(date) && date < todayStr).length
  const mLate     = [...mAttMap.values()].filter(r => r.minutes_late > 30).length
  const mApproved = [...mAttMap.values()].filter(r => r.approved).length

  // Hero stats (show week stats when on week tab, month stats on month tab)
  const heroStats = tab === 'week'
    ? [
        { label: 'Days Worked',  value: `${wWorked}d`,          color: '#6EE7B7' },
        { label: 'Hours',        value: fmtHours(wHours),        color: '#818CF8' },
        { label: 'Overtime',     value: fmtHours(wOvertime),     color: '#FCD34D' },
        { label: 'Late',         value: `${wLate}d`,             color: '#FCA5A5' },
      ]
    : [
        { label: 'Days Worked',  value: `${mWorked}d`,           color: '#6EE7B7' },
        { label: 'Hours',        value: fmtHours(mHours),        color: '#818CF8' },
        { label: 'Overtime',     value: fmtHours(mOvertime),     color: '#FCD34D' },
        { label: 'Absent',       value: `${mAbsent}d`,           color: '#FCA5A5' },
      ]

  // ── Loading / not-linked screens ──────────────────────────────────
  if (empLoading) {
    return <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading…</div>
  }
  if (!myEmployee) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <CalendarClock size={24} className="text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium">Employee record not found</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">Contact HR to link your account to an employee profile.</p>
      </div>
    )
  }
  if (!rcId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle size={24} className="text-amber-400" />
        </div>
        <p className="text-gray-600 font-semibold">Not linked to RotaCloud</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">Your profile hasn't been linked to RotaCloud yet. Contact HR to set this up.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #0f1629 0%, #1a1230 50%, #0f1629 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 65%)' }} />
        <div className="absolute bottom-0 left-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.2), transparent 65%)' }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full mb-4">
            <CalendarClock size={12} className="text-indigo-400" />
            <span className="text-indigo-300 text-[11px] font-semibold tracking-wide">MY TIMESHEET</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">My Shifts</h1>
          <p className="text-white/50 text-sm mt-1">
            {tab === 'week' ? wRangeLabel : fmtMonthLabel(month)}
            {(weekLoading || monthLoading) && <RefreshCw size={11} className="inline ml-2 animate-spin opacity-60" />}
          </p>
          <div className="mt-6 grid grid-cols-4 gap-3">
            {heroStats.map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* ── Tab toggle ── */}
      <div className="flex gap-2">
        {(['week', 'month'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
              tab === t ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}>
            {t === 'week' ? 'This Week' : 'Monthly View'}
          </button>
        ))}
      </div>

      {/* ══════════════ WEEK VIEW ══════════════ */}
      {tab === 'week' && (
        <div className="space-y-4">

          {/* Week navigator */}
          <div className="flex items-center gap-3">
            <button onClick={() => setWeekOffset(o => o - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition">
              <ChevronLeft size={15} />
            </button>
            <p className="text-sm font-bold text-secondary min-w-[220px] text-center">{wRangeLabel}</p>
            <button onClick={() => setWeekOffset(o => o + 1)}
              disabled={weekOffset >= 0}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-30">
              <ChevronRight size={15} />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)}
                className="text-xs text-primary font-semibold hover:underline ml-1">
                Back to this week
              </button>
            )}
            {weekLoading && <RefreshCw size={13} className="text-gray-400 animate-spin ml-1" />}
          </div>

          {/* Week summary chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { Icon: CalendarDays, label: 'Worked',   value: `${wWorked} / 5 days`, color: 'bg-green-50 text-green-700 border-green-200'   },
              { Icon: Timer,        label: 'Hours',    value: fmtHours(wHours),       color: 'bg-blue-50 text-blue-700 border-blue-200'      },
              { Icon: Zap,          label: 'Overtime', value: fmtHours(wOvertime),    color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              { Icon: TrendingUp,   label: 'Late',     value: `${wLate} days`,        color: 'bg-amber-50 text-amber-700 border-amber-200'   },
            ].map(s => (
              <div key={s.label} className={cn('flex items-center gap-2 border rounded-xl px-3 py-2', s.color)}>
                <s.Icon size={13} />
                <span className="text-xs font-medium opacity-70">{s.label}</span>
                <span className="text-xs font-bold tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Day cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {wDates.map(dateStr => {
              const att    = wAttMap.get(dateStr)
              const shift  = wShiftMap.get(dateStr)
              const status = deriveStatus(att, dateStr, todayStr)
              const cfg    = STATUS_CFG[status]
              const isToday   = dateStr === todayStr
              const weekend   = isWeekend(dateStr)
              const stilIn    = !!att?.in_time_clocked && !att?.out_time_clocked

              const schedIn  = shift ? unixToHHMM(shift.start_time) : undefined
              const schedOut = shift ? unixToHHMM(shift.end_time)   : undefined
              const clockIn  = att?.in_time_clocked  ? unixToHHMM(att.in_time_clocked)  : att ? unixToHHMM(att.in_time)  : undefined
              const clockOut = att?.out_time_clocked ? unixToHHMM(att.out_time_clocked) : att ? unixToHHMM(att.out_time) : undefined
              const isActualClock = !!att?.in_time_clocked

              return (
                <div key={dateStr} className={cn(
                  'rounded-2xl border p-4 transition-all space-y-3',
                  isToday   ? 'bg-secondary border-secondary/30 shadow-lg'
                  : weekend ? 'bg-gray-50/80 border-gray-100'
                  : status === 'absent' ? 'bg-red-50/60 border-red-100'
                  : status === 'present' || status === 'live' ? 'bg-green-50/60 border-green-100'
                  : status === 'late'     ? 'bg-amber-50/60 border-amber-100'
                  : status === 'half_day' ? 'bg-purple-50/60 border-purple-100'
                  : 'bg-white border-gray-100'
                )}>

                  {/* Date row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('text-[10px] font-bold uppercase tracking-wider', isToday ? 'text-white/60' : 'text-gray-400')}>
                        {dayName(dateStr, true)}
                      </p>
                      <p className={cn('text-sm font-bold', isToday ? 'text-white' : 'text-secondary')}>
                        {fmtDateLabel(dateStr)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {cfg.dot && <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />}
                      {isToday && (
                        <span className="text-[9px] font-bold text-white/70 bg-white/15 px-2 py-0.5 rounded-full">TODAY</span>
                      )}
                    </div>
                  </div>

                  {/* Loading skeleton */}
                  {weekLoading && (
                    <div className={cn('space-y-1.5', isToday ? 'opacity-30' : '')}>
                      <div className="h-3 rounded bg-gray-200 animate-pulse w-3/4" />
                      <div className="h-3 rounded bg-gray-200 animate-pulse w-1/2" />
                    </div>
                  )}

                  {/* Times */}
                  {!weekLoading && (
                    <div className="space-y-1.5">
                      {/* Scheduled */}
                      <div className={cn('flex items-center justify-between text-[11px]', isToday ? 'text-white/60' : 'text-gray-400')}>
                        <span className="font-medium">Scheduled</span>
                        <span className="font-mono">
                          {schedIn && schedOut ? `${fmt12(schedIn)} – ${fmt12(schedOut)}` : '—'}
                        </span>
                      </div>
                      {/* Clock In */}
                      <div className={cn('flex items-center justify-between text-[11px]', isToday ? 'text-white/80' : 'text-gray-700')}>
                        <span className="font-medium flex items-center gap-1">
                          <Clock size={10} />In
                        </span>
                        <span className={cn('font-mono font-semibold', !isActualClock && clockIn ? (isToday ? 'text-white/50' : 'text-gray-400') : '')}>
                          {clockIn ? fmt12(clockIn) : <span className={isToday ? 'text-white/30' : 'text-gray-300'}>—</span>}
                          {att?.minutes_late && att.minutes_late > 0
                            ? <span className={cn('ml-1 text-[9px]', isToday ? 'text-white/60' : 'text-amber-500')}>+{att.minutes_late}m</span>
                            : null}
                        </span>
                      </div>
                      {/* Clock Out */}
                      <div className={cn('flex items-center justify-between text-[11px]', isToday ? 'text-white/80' : 'text-gray-700')}>
                        <span className="font-medium flex items-center gap-1">
                          <Clock size={10} />Out
                        </span>
                        <span className="font-mono font-semibold">
                          {stilIn
                            ? <span className="text-emerald-400 animate-pulse">Live</span>
                            : clockOut
                              ? <span className={cn(!isActualClock ? (isToday ? 'text-white/50' : 'text-gray-400') : '')}>{fmt12(clockOut)}</span>
                              : <span className={isToday ? 'text-white/30' : 'text-gray-300'}>—</span>}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Footer: hours + status */}
                  {!weekLoading && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/10">
                      <span className={cn('text-sm font-bold tabular-nums', isToday ? 'text-white' : 'text-gray-800')}>
                        {att?.hours ? fmtHours(att.hours) : <span className={isToday ? 'text-white/40' : 'text-gray-300'}>—</span>}
                      </span>
                      {isToday
                        ? <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white')}>{cfg.label}</span>
                        : <StatusPill status={status} approved={att?.approved} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Week total bar */}
          {!weekLoading && wHours > 0 && (
            <div className="card px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Week Total</span>
              <div className="flex items-center gap-4 text-sm">
                {wOvertime > 0 && (
                  <span className="text-xs text-indigo-600 font-semibold">+{fmtHours(wOvertime)} overtime</span>
                )}
                <span className="font-bold text-secondary">{fmtHours(wHours)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ MONTH VIEW ══════════════ */}
      {tab === 'month' && (
        <div className="space-y-4">

          {/* Month navigator */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth(m => shiftMonth(m, -1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition shrink-0">
                <ChevronLeft size={15} />
              </button>
              <div className="text-center min-w-[180px]">
                <p className="text-base font-bold text-secondary">{fmtMonthLabel(month)}</p>
                <p className="text-[10px] text-gray-400">RotaCloud Timesheet</p>
              </div>
              <button onClick={() => setMonth(m => shiftMonth(m, 1))}
                disabled={month >= currentMonthStr()}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-30 shrink-0">
                <ChevronRight size={15} />
              </button>
              {monthLoading && <RefreshCw size={13} className="text-gray-400 animate-spin ml-1" />}
            </div>

            {/* Month summary chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Worked',   value: `${mWorked}d`,       color: 'bg-green-50 text-green-700 border-green-200'   },
                { label: 'Hours',    value: fmtHours(mHours),    color: 'bg-blue-50 text-blue-700 border-blue-200'      },
                { label: 'Overtime', value: fmtHours(mOvertime), color: 'bg-indigo-50 text-indigo-700 border-indigo-200'},
                { label: 'Absent',   value: `${mAbsent}d`,       color: 'bg-red-50 text-red-600 border-red-200'         },
                { label: 'Late',     value: `${mLate}d`,         color: 'bg-amber-50 text-amber-700 border-amber-200'   },
                { label: 'Approved', value: `${mApproved}d`,     color: 'bg-violet-50 text-violet-700 border-violet-200'},
              ].map(s => (
                <div key={s.label} className={cn('border rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs', s.color)}>
                  <span className="font-medium opacity-70">{s.label}</span>
                  <span className="font-bold tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Month table */}
          <div className="rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
            <table className="w-full text-xs min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wide text-[10px] w-28">Date</th>
                  <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase tracking-wide text-[10px] w-14">Day</th>
                  <th className="px-3 py-3 text-center font-bold text-gray-400 uppercase tracking-wide text-[10px]" colSpan={2}>Scheduled</th>
                  <th className="px-3 py-3 text-center font-bold text-gray-600 uppercase tracking-wide text-[10px]" colSpan={2}>Actual Clock</th>
                  <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase tracking-wide text-[10px]">Hours</th>
                  <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase tracking-wide text-[10px]">Late</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-500 uppercase tracking-wide text-[10px]">Status</th>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <td colSpan={2} />
                  <td className="px-3 pb-2 text-center text-[9px] text-gray-400 font-semibold">Start</td>
                  <td className="px-3 pb-2 text-center text-[9px] text-gray-400 font-semibold">Finish</td>
                  <td className="px-3 pb-2 text-center text-[9px] text-gray-500 font-semibold">In</td>
                  <td className="px-3 pb-2 text-center text-[9px] text-gray-500 font-semibold">Out</td>
                  <td colSpan={3} />
                </tr>
              </thead>
              <tbody>
                {mDays.map(({ date, att, shift }) => {
                  const status  = deriveStatus(att, date, todayStr)
                  const weekend = isWeekend(date)
                  const isToday = date === todayStr
                  const stilIn  = !!att?.in_time_clocked && !att?.out_time_clocked

                  const schedIn  = shift ? unixToHHMM(shift.start_time) : undefined
                  const schedOut = shift ? unixToHHMM(shift.end_time)   : undefined

                  const clockInActual  = att?.in_time_clocked  ? unixToHHMM(att.in_time_clocked)  : undefined
                  const clockOutActual = att?.out_time_clocked ? unixToHHMM(att.out_time_clocked) : undefined
                  const clockInLogged  = att && !clockInActual  ? unixToHHMM(att.in_time)  : undefined
                  const clockOutLogged = att && !clockOutActual ? unixToHHMM(att.out_time) : undefined

                  const rowBg = isToday         ? 'bg-blue-50/40'
                              : status === 'absent'   ? 'bg-red-50/30'
                              : weekend               ? 'bg-gray-50/60'
                              : 'bg-white hover:bg-gray-50/40'
                  const txtBase  = (weekend || status === 'future') ? 'text-gray-300' : 'text-gray-700'
                  const txtMuted = (weekend || status === 'future') ? 'text-gray-300' : 'text-gray-400'

                  return (
                    <tr key={date} className={cn('border-b border-gray-100 last:border-0 transition-colors', rowBg)}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                          <span className={cn('font-semibold', isToday ? 'text-primary' : txtBase)}>
                            {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </td>
                      <td className={cn('px-3 py-2.5', txtMuted)}>{dayName(date, true)}</td>

                      {/* Scheduled */}
                      <td className={cn('px-3 py-2.5 text-center font-mono', txtMuted)}>
                        {schedIn ? fmt12(schedIn) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className={cn('px-3 py-2.5 text-center font-mono', txtMuted)}>
                        {schedOut ? fmt12(schedOut) : <span className="text-gray-200">—</span>}
                      </td>

                      {/* Actual In */}
                      <td className="px-3 py-2.5 text-center">
                        {clockInActual
                          ? <span className={cn('font-mono font-semibold', att?.minutes_late && att.minutes_late > 0 ? 'text-amber-600' : 'text-gray-700')}>
                              {fmt12(clockInActual)}
                              {att?.minutes_late && att.minutes_late > 0
                                ? <span className="ml-1 text-[9px] text-amber-500">+{att.minutes_late}m</span>
                                : null}
                            </span>
                          : clockInLogged
                            ? <span className="font-mono text-gray-400">{fmt12(clockInLogged)}</span>
                            : <span className="text-gray-200">—</span>}
                      </td>

                      {/* Actual Out */}
                      <td className="px-3 py-2.5 text-center">
                        {stilIn
                          ? <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
                            </span>
                          : clockOutActual
                            ? <span className="font-mono font-semibold text-gray-700">{fmt12(clockOutActual)}</span>
                            : clockOutLogged
                              ? <span className="font-mono text-gray-400">{fmt12(clockOutLogged)}</span>
                              : <span className="text-gray-200">—</span>}
                      </td>

                      {/* Hours */}
                      <td className="px-3 py-2.5 text-right">
                        {att?.hours
                          ? <span className="font-bold text-gray-800 tabular-nums">{fmtHours(att.hours)}</span>
                          : <span className="text-gray-200">—</span>}
                      </td>

                      {/* Late */}
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {att?.minutes_late && att.minutes_late > 0
                          ? <span className="text-amber-600 font-semibold">{att.minutes_late}m</span>
                          : <span className="text-gray-200">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5 text-center">
                        <StatusPill status={status} approved={att?.approved} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Monthly Total · {mWorked} days worked
                  </td>
                  <td colSpan={2} />
                  <td className="px-3 py-3 text-right text-xs font-bold text-primary tabular-nums">{fmtHours(mHours)}</td>
                  <td className="px-3 py-3 text-right text-xs text-gray-400 tabular-nums">{mLate}d late</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-[10px] text-violet-600 font-semibold">{mApproved} approved</span>
                  </td>
                </tr>
              </tfoot>
            </table>

            {!monthLoading && mWorked === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">
                No records found in RotaCloud for {fmtMonthLabel(month)}.
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
            {([
              ['bg-emerald-500 animate-pulse', 'Live — currently on shift'],
              ['bg-green-500',  'Present'],
              ['bg-amber-500',  'Late > 30 min'],
              ['bg-purple-500', 'Half Day < 4 h'],
              ['bg-red-400',    'Absent'],
            ] as [string, string][]).map(([dot, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />{label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={10} className="text-green-500 shrink-0" />Approved by manager
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
