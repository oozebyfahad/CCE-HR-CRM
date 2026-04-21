import { useState, useEffect, useRef } from 'react'
import {
  Clock, ChevronLeft, ChevronRight, Plus, Edit2,
  CheckCircle2, History, AlarmClock, UserCheck,
} from 'lucide-react'
import type { FirebaseEmployee } from '../../../hooks/useFirebaseEmployees'
import {
  useFirebaseTimesheets, fmtHours, fmt12, weekMonday, toYMD,
  calcHours, PROJECTS, type TimeEntry, type AttendanceRecord,
} from '../../../hooks/useFirebaseTimesheets'
import { useAppSelector } from '../../../store'
import { cn } from '../../../utils/cn'

// ── Constants ─────────────────────────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TYPES = [
  { v: 'regular',  l: 'Regular'  },
  { v: 'overtime', l: 'Overtime' },
  { v: 'holiday',  l: 'Holiday'  },
  { v: 'pto',      l: 'PTO'      },
]
const TYPE_STYLE: Record<string, string> = {
  overtime: 'bg-amber-100 text-amber-700',
  holiday:  'bg-blue-100 text-blue-700',
  pto:      'bg-purple-100 text-purple-700',
}

const ATTENDANCE_OPTS: { v: AttendanceRecord['status']; l: string; dot: string; pill: string }[] = [
  { v: 'present',  l: 'Present',  dot: 'bg-green-500',  pill: 'bg-green-100 text-green-700 border-green-200' },
  { v: 'absent',   l: 'Absent',   dot: 'bg-red-500',    pill: 'bg-red-100 text-red-700 border-red-200' },
  { v: 'late',     l: 'Late',     dot: 'bg-amber-500',  pill: 'bg-amber-100 text-amber-700 border-amber-200' },
  { v: 'half_day', l: 'Half Day', dot: 'bg-purple-500', pill: 'bg-purple-100 text-purple-700 border-purple-200' },
]

// ── Helpers ───────────────────────────────────────────────────────────
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function fmtRange(mon: Date): string {
  const sun = addDays(mon, 6)
  const a = mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const b = sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${a} – ${b}`
}
function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Shared input style ─────────────────────────────────────────────────
const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
const lbl = 'block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5'

// ── Attendance pill with dropdown ──────────────────────────────────────
function AttendancePill({
  date, attendance, onMark,
}: {
  date: string
  attendance: AttendanceRecord[]
  onMark: (date: string, status: AttendanceRecord['status'] | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const record = attendance.find(a => a.date === date)
  const current = ATTENDANCE_OPTS.find(o => o.v === record?.status)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'text-[10px] px-2 py-0.5 rounded-full border font-medium transition whitespace-nowrap',
          current ? current.pill : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
        )}>
        {current ? current.l : '+ Mark'}
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-30 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[130px]">
          <p className="px-3 pt-1.5 pb-0.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Set Attendance</p>
          {ATTENDANCE_OPTS.map(o => (
            <button key={o.v} onClick={() => { onMark(date, o.v); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition',
                record?.status === o.v ? 'font-semibold text-secondary' : 'text-gray-700'
              )}>
              <span className={cn('w-2 h-2 rounded-full shrink-0', o.dot)} />
              {o.l}
              {record?.status === o.v && <CheckCircle2 size={10} className="ml-auto text-primary" />}
            </button>
          ))}
          {record && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => { onMark(date, null); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-50 transition">
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add / Edit entry modal ─────────────────────────────────────────────
function EntryModal({
  date, entry, employeeId, onSave, onDelete, onClose,
}: {
  date: string
  entry?: TimeEntry
  employeeId: string
  onSave: (data: Omit<TimeEntry, 'id'>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [startTime, setStart]   = useState(entry?.startTime   ?? '09:00')
  const [endTime,   setEnd]     = useState(entry?.endTime     ?? '17:00')
  const [type,      setType]    = useState(entry?.type        ?? 'regular')
  const [project,   setProject] = useState(entry?.projectTask ?? '')
  const [note,      setNote]    = useState(entry?.note        ?? '')
  const [saving,    setSaving]  = useState(false)
  const [error,     setError]   = useState('')

  const hours    = calcHours(startTime, endTime)
  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const save = async () => {
    setError('')
    if (!date || !employeeId) { setError('Missing date or employee.'); return }
    setSaving(true)
    try {
      await onSave({ employeeId, date, startTime, endTime, hours, type: type as TimeEntry['type'], projectTask: project, note, clockedIn: false })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save. Check your connection.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <AlarmClock size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">{entry ? 'Edit Time Worked' : 'Add Time Entry'}</p>
              <p className="text-xs text-gray-400">{dayLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400 text-sm">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Start Time</label>
              <input type="time" value={startTime} onChange={e => setStart(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>End Time</label>
              <input type="time" value={endTime} onChange={e => setEnd(e.target.value)} className={inp} />
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
            <span className="text-xs text-gray-500 font-medium">Day Total</span>
            <span className="text-sm font-bold text-secondary">{fmtHours(hours)}</span>
          </div>

          <div>
            <label className={lbl}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as TimeEntry['type'])} className={inp}>
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>

          <div>
            <label className={lbl}>Project / Task</label>
            <select value={project} onChange={e => setProject(e.target.value)} className={inp}>
              <option value="">— Select Project / Task —</option>
              {PROJECTS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className={lbl}>Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={2} placeholder="Add note…"
              className={cn(inp, 'resize-none')} />
          </div>
        </div>

        {error && (
          <p className="mx-5 mb-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="px-5 pb-5 flex items-center justify-between">
          {entry && onDelete
            ? <button onClick={async () => { await onDelete(); onClose() }} className="text-xs text-red-400 hover:text-red-600 transition font-medium">Delete Time Entry</button>
            : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-outline text-sm px-4">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm px-5">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Clock-in modal ─────────────────────────────────────────────────────
function ClockInModal({ onClockIn, onClose }: {
  onClockIn: (project?: string, note?: string) => Promise<void>
  onClose: () => void
}) {
  const [project, setProject] = useState('')
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const now      = new Date()
  const dayLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const go = async () => {
    setSaving(true)
    try { await onClockIn(project || undefined, note || undefined); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <Clock size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Clock In</p>
              <p className="text-xs text-gray-400">{dayLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400 text-sm">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={lbl}>Project / Task</label>
            <select value={project} onChange={e => setProject(e.target.value)} className={inp}>
              <option value="">— Select Project / Task —</option>
              {PROJECTS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Add note…" className={cn(inp, 'resize-none')} />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-outline text-sm px-4">Cancel</button>
          <button onClick={go} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
            <Clock size={13} /> {saving ? 'Clocking in…' : 'Clock In'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Mini bar chart ─────────────────────────────────────────────────────
function WeekBar({ days, entries }: { days: Date[]; entries: TimeEntry[] }) {
  const MAX        = 9
  const BAR_MAX_PX = 40
  return (
    <div className="flex items-end gap-1" style={{ height: 52 }}>
      {days.slice(0, 7).map((d, i) => {
        const h      = entries.filter(e => e.date === toYMD(d)).reduce((s, e) => s + e.hours, 0)
        const barPx  = Math.max(2, Math.round((Math.min(h, MAX) / MAX) * BAR_MAX_PX))
        return (
          <div key={i} className="flex flex-col items-center justify-end gap-0.5 flex-1 h-full">
            <div className="w-full rounded-sm"
              style={{ height: barPx, backgroundColor: h > 0 ? '#2E86C1' : '#E5E7EB' }} />
            <span className="text-[8px] text-gray-400">{DAY_LABELS[i][0]}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main TimesheetTab ──────────────────────────────────────────────────
export default function TimesheetTab({ emp }: { emp: FirebaseEmployee }) {
  const currentUser = useAppSelector(s => s.auth.user)
  const role        = currentUser?.role ?? 'employee'

  // Determine permissions based on who is viewing
  const isOwnProfile      = currentUser?.email === emp.email
  const canClockInOut     = isOwnProfile
  const canMarkAttendance = (role === 'hr' || role === 'admin') && !isOwnProfile
  const canEdit           = role === 'hr' || role === 'admin' || isOwnProfile
  const canApprove        = (role === 'admin' || role === 'hr' || role === 'team_lead') && !isOwnProfile

  const [weekStart,   setWeekStart]   = useState<Date>(() => weekMonday(new Date()))
  const [editEntry,   setEditEntry]   = useState<TimeEntry | null>(null)
  const [addingDay,   setAddingDay]   = useState<string | null>(null)
  const [showClockIn, setShowClockIn] = useState(false)
  const [liveTime,    setLiveTime]    = useState(new Date())

  const {
    entries, approvals, attendance, loading,
    addEntry, updateEntry, deleteEntry,
    approveWeek, markAttendance, clockIn, clockOut,
    currentlyClockedIn,
  } = useFirebaseTimesheets(emp.id)

  // Live clock tick every 30 s
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const weekDays     = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartYMD = toYMD(weekStart)
  const weekEndYMD   = toYMD(addDays(weekStart, 6))
  const isThisWeek   = weekStartYMD === toYMD(weekMonday(new Date()))

  const weekEntries  = entries.filter(e => e.date >= weekStartYMD && e.date <= weekEndYMD)
  const weekTotal    = weekEntries.reduce((s, e) => s + e.hours, 0)
  const weekApproval = approvals.find(a => a.weekStart === weekStartYMD)
  const isApproved   = weekApproval?.status === 'approved'

  // Live clocked-in duration
  let liveDuration = '0h 00m'
  if (currentlyClockedIn?.startTime) {
    const [sh, sm] = currentlyClockedIn.startTime.split(':').map(Number)
    const diffM    = liveTime.getHours() * 60 + liveTime.getMinutes() - sh * 60 - sm
    liveDuration   = fmtHours(Math.max(0, diffM / 60))
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option>This Pay Period</option>
            <option>Last Pay Period</option>
            <option>Custom Range</option>
          </select>
          {isApproved && (
            <span className="flex items-center gap-1 text-xs text-green-700 font-medium bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={11} /> Approved · {weekApproval?.approvedBy}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canApprove && !isApproved && weekTotal > 0 && (
            <button
              onClick={() => approveWeek(weekStartYMD, currentUser?.name ?? 'Manager')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition">
              <CheckCircle2 size={12} /> Approve Week
            </button>
          )}
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition">
            <History size={12} /> History
          </button>
        </div>
      </div>

      {/* ── HR attendance banner ── */}
      {canMarkAttendance && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-4">
          <UserCheck size={14} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800">
            You can mark daily attendance for this employee. Use the pill buttons on each day row.
          </p>
        </div>
      )}

      <div className="flex gap-4 items-start">

        {/* ── Left: weekly calendar ── */}
        <div className="flex-1 min-w-0 card overflow-hidden">

          {/* Week navigation */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50/80 border-b border-gray-100">
            <button onClick={() => setWeekStart(d => addDays(d, -7))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 transition text-gray-500">
              <ChevronLeft size={15} />
            </button>
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-primary" />
              <span className="text-sm font-bold text-secondary">{fmtRange(weekStart)}</span>
            </div>
            <button onClick={() => setWeekStart(d => addDays(d, 7))}
              disabled={isThisWeek}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 transition text-gray-500 disabled:opacity-30">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Day rows */}
          {loading ? (
            <div className="py-16 text-center text-xs text-gray-400">Loading timesheet…</div>
          ) : weekDays.map((day, i) => {
            const ymd        = toYMD(day)
            const dayEntries = weekEntries.filter(e => e.date === ymd)
            const dayHours   = dayEntries.reduce((s, e) => s + e.hours, 0)
            const isToday    = ymd === toYMD(new Date())
            const isWeekend  = i >= 5

            return (
              <div key={ymd} className={cn('border-b border-gray-50 last:border-0', isWeekend && 'bg-gray-50/30')}>
                <div className="flex items-center px-5 py-3 gap-3 group">

                  {/* Day label */}
                  <div className="w-16 shrink-0">
                    <p className={cn('text-xs font-bold', isToday ? 'text-primary' : 'text-secondary')}>{DAY_LABELS[i]}</p>
                    <p className="text-[10px] text-gray-400">{fmtDayLabel(day)}</p>
                  </div>

                  {/* Entries */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {dayEntries.length === 0
                      ? <span className="text-xs text-gray-300">—</span>
                      : dayEntries.map(e => (
                        <div key={e.id} className="flex items-center gap-2.5 group/row">
                          <span className="text-xs font-semibold text-secondary w-14 shrink-0">
                            {e.clockedIn
                              ? <span className="text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>
                              : fmtHours(e.hours)}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {fmt12(e.startTime)}{e.endTime ? ` – ${fmt12(e.endTime)}` : ''}
                          </span>
                          {e.projectTask && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/8 text-primary rounded font-medium truncate max-w-[120px]">
                              {e.projectTask}
                            </span>
                          )}
                          {e.type !== 'regular' && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', TYPE_STYLE[e.type] ?? '')}>
                              {TYPES.find(t => t.v === e.type)?.l}
                            </span>
                          )}
                          {e.note && (
                            <span className="text-[10px] text-gray-400 italic truncate max-w-[90px]" title={e.note}>{e.note}</span>
                          )}
                          {canEdit && (
                            <button onClick={() => setEditEntry(e)}
                              className="ml-auto opacity-0 group-hover/row:opacity-100 transition p-1 rounded hover:bg-gray-100">
                              <Edit2 size={11} className="text-gray-400" />
                            </button>
                          )}
                        </div>
                      ))
                    }
                  </div>

                  {/* Day total + attendance + add */}
                  <div className="flex items-center gap-2 shrink-0">
                    {dayHours > 0 && (
                      <span className="text-xs font-bold text-secondary w-14 text-right">{fmtHours(dayHours)}</span>
                    )}
                    {canMarkAttendance && (
                      <AttendancePill
                        date={ymd}
                        attendance={attendance}
                        onMark={(date, status) => markAttendance(date, status, currentUser?.name ?? 'HR')}
                      />
                    )}
                    {canEdit && (
                      <button onClick={() => setAddingDay(ymd)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-primary hover:text-white transition text-gray-400 opacity-0 group-hover:opacity-100">
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Week total */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50/60 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Week Total</span>
            <span className="text-sm font-bold text-secondary">{fmtHours(weekTotal)}</span>
          </div>
        </div>

        {/* ── Right: status panel ── */}
        <div className="w-52 shrink-0 space-y-3">

          {/* Clock in/out card — only for the employee's own profile */}
          {canClockInOut && (
            <div className="card p-4 text-center space-y-2.5">
              {currentlyClockedIn ? (
                <>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-bold text-green-600">Clocked In</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary leading-tight">{liveDuration}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Since {fmt12(currentlyClockedIn.startTime)}</p>
                  </div>
                  <button
                    onClick={() => clockOut(currentlyClockedIn.id, currentlyClockedIn.startTime!)}
                    className="w-full py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition">
                    Clock Out
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Not Clocked In</p>
                  <p className="text-xl font-bold text-secondary">
                    {liveTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <button
                    onClick={() => setShowClockIn(true)}
                    className="w-full py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-1.5">
                    <Clock size={13} /> Clock In
                  </button>
                </>
              )}
            </div>
          )}

          {/* Weekly stats */}
          <div className="card p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">This Week</span>
              <span className="text-sm font-bold text-secondary">{fmtHours(weekTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Pay Period</span>
              <span className="text-sm font-bold text-secondary">{fmtHours(weekTotal)}</span>
            </div>
            <div className="border-t border-gray-100 pt-2">
              <WeekBar days={weekDays} entries={weekEntries} />
            </div>
          </div>

          {/* Reminder for employee */}
          {canClockInOut && !isApproved && weekTotal > 0 && (
            <div className="card p-3 bg-amber-50 border border-amber-100">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Reminder</p>
              <p className="text-[10px] text-amber-600 leading-relaxed">
                Review your timesheet for accuracy before it is approved.
              </p>
            </div>
          )}

          {/* Empty week nudge for own profile */}
          {canClockInOut && weekTotal === 0 && !loading && isThisWeek && (
            <div className="card p-3 text-center">
              <p className="text-[10px] text-gray-400 leading-relaxed">No hours this week. Use Clock In or add entries manually.</p>
            </div>
          )}

          {/* HR attendance legend */}
          {canMarkAttendance && (
            <div className="card p-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Attendance Legend</p>
              {ATTENDANCE_OPTS.map(o => (
                <div key={o.v} className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', o.dot)} />
                  <span className="text-[10px] text-gray-600">{o.l}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showClockIn && <ClockInModal onClockIn={clockIn} onClose={() => setShowClockIn(false)} />}

      {addingDay && (
        <EntryModal
          date={addingDay}
          employeeId={emp.id}
          onSave={async data => { await addEntry(data) }}
          onClose={() => setAddingDay(null)}
        />
      )}

      {editEntry && (
        <EntryModal
          date={editEntry.date}
          entry={editEntry}
          employeeId={emp.id}
          onSave={data => updateEntry(editEntry.id, data)}
          onDelete={() => deleteEntry(editEntry.id)}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  )
}
