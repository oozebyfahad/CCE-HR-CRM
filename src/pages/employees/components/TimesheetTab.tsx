import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, getDocs, doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../config/firebase'
import {
  Clock, ChevronLeft, ChevronRight, Plus, Edit2,
  CheckCircle2, History, AlarmClock, UserCheck, RefreshCw, AlertCircle, Download,
  MoreVertical, Check, FileText, Info, Trash2,
} from 'lucide-react'
import type { FirebaseEmployee } from '../../../hooks/useFirebaseEmployees'
import {
  useFirebaseTimesheets, fmtHours, fmt12, weekMonday, toYMD,
  calcHours, PROJECTS, type TimeEntry, type AttendanceRecord,
} from '../../../hooks/useFirebaseTimesheets'
import { useAppSelector } from '../../../store'
import { cn } from '../../../utils/cn'
import { fetchRotaAttendance, fetchRotaShifts, monthToUnix, type RotaAttendance, type RotaShift } from '../../../services/rotacloud'
import { unixToHHMM, unixToLocalDate } from '../../../hooks/useRotaAttendance'
import { exportTimesheetExcel } from '../../../utils/exportTimesheetExcel'

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

// ── Note modal ────────────────────────────────────────────────────────
function NoteModal({ date, initial, onSave, onClose }: {
  date: string; initial: string
  onSave: (text: string) => void; onClose: () => void
}) {
  const [text, setText] = useState(initial)
  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-secondary">Shift Note</p>
            <p className="text-xs text-gray-400 mt-0.5">{dayLabel}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-sm">✕</button>
        </div>
        <div className="p-5">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            placeholder="Add a note about this shift…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            autoFocus
          />
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-outline text-sm px-4">Cancel</button>
          <button onClick={() => onSave(text)} className="btn-primary text-sm px-5">Save Note</button>
        </div>
      </div>
    </div>
  )
}

// ── Shift info modal ───────────────────────────────────────────────────
function ShiftInfoModal({ date, att, shift, note, onClose }: {
  date: string; att?: RotaAttendance; shift?: RotaShift; note: string; onClose: () => void
}) {
  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const row = (label: string, val: React.ReactNode) => (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right">{val ?? '—'}</span>
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-secondary">Shift Information</p>
            <p className="text-xs text-gray-400 mt-0.5">{dayLabel}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-sm">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {shift && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Scheduled Shift</p>
              {row('Start', shift ? unixToHHMM(shift.start_time) : undefined)}
              {row('Finish', shift ? unixToHHMM(shift.end_time) : undefined)}
              {row('Break', shift ? `${(shift.minutes_break ?? 0)}m` : undefined)}
              {row('Shift ID', `#${shift.id}`)}
            </div>
          )}
          {att && (
            <div className="bg-blue-50 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Attendance Record</p>
              {row('Clock In', att.in_time_clocked ? unixToHHMM(att.in_time_clocked) : 'Not clocked')}
              {row('Clock Out', att.out_time_clocked ? unixToHHMM(att.out_time_clocked) : 'Not clocked')}
              {row('Hours', `${att.hours}h`)}
              {row('Break', `${att.minutes_break}m`)}
              {row('Late', att.minutes_late > 0 ? `${att.minutes_late}m` : 'On time')}
              {row('Approved', att.approved ? 'Yes' : 'No')}
              {row('In Method', att.in_method)}
              {row('Record ID', `#${att.id}`)}
            </div>
          )}
          {note && (
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1">Note</p>
              <p className="text-xs text-gray-700">{note}</p>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose} className="btn-primary text-sm px-5">Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Shift action dropdown ──────────────────────────────────────────────
function ShiftActionDropdown({ date, att, shift, approved, note, late, deleted, onApprove, onNote, onMarkLate, onDelete, onInfo }: {
  date: string; att?: RotaAttendance; shift?: RotaShift
  approved: boolean; note: string; late: boolean; deleted: boolean
  onApprove: () => void; onNote: () => void; onMarkLate: () => void
  onDelete: () => void; onInfo: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  if (!att && !shift) return <span className="text-gray-200">—</span>
  type MenuItem = { label: string; icon: React.ElementType; color?: string; onClick: () => void; sep?: boolean }
  const items: MenuItem[] = [
    { label: approved ? 'Approved ✓' : 'Approve Shift', icon: Check, color: approved ? 'text-green-600 font-semibold' : undefined, onClick: () => { onApprove(); setOpen(false) } },
    { label: note ? 'Edit Note' : 'Add Note', icon: FileText, onClick: () => { onNote(); setOpen(false) } },
    { label: late ? 'Unmark Late' : 'Mark as Late', icon: AlarmClock, color: late ? 'text-amber-600 font-semibold' : undefined, onClick: () => { onMarkLate(); setOpen(false) }, sep: true },
    { label: 'Shift Information', icon: Info, onClick: () => { onInfo(); setOpen(false) } },
    { label: 'History', icon: History, onClick: () => setOpen(false) },
    { label: deleted ? 'Restore' : 'Delete', icon: Trash2, color: 'text-red-500', onClick: () => { onDelete(); setOpen(false) }, sep: true },
  ]
  return (
    <div ref={ref} className="relative flex items-center justify-center">
      <button onClick={() => setOpen(v => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-40 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[175px]">
          {items.map((item, i) => (
            <div key={i}>
              {item.sep && <div className="my-1 border-t border-gray-100" />}
              <button onClick={item.onClick}
                className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition', item.color ?? 'text-gray-700')}>
                <item.icon size={12} className="shrink-0" />
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main TimesheetTab ──────────────────────────────────────────────────
// ── RotaCloud Monthly Timesheet ────────────────────────────────────────

const MIN_MONTH = '2026-04'

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}
function fmtMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function dayOfWeek(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}
function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00').getDay()
  return d === 0 || d === 6
}

// Status badge used in the RotaCloud-style timesheet
function StatusBadge({ status, approved }: { status: string; approved?: boolean }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    live:     { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Live' },
    present:  { bg: 'bg-green-100',   text: 'text-green-700',   label: 'Present' },
    late:     { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Late' },
    half_day: { bg: 'bg-purple-100',  text: 'text-purple-700',  label: 'Half Day' },
    absent:   { bg: 'bg-red-100',     text: 'text-red-600',     label: 'Absent' },
    day_off:  { bg: 'bg-gray-100',    text: 'text-gray-400',    label: 'Day Off' },
    future:   { bg: '',               text: 'text-gray-300',    label: '—' },
  }
  const s = cfg[status] ?? cfg.future
  if (!s.bg) return <span className="text-[10px] text-gray-300">—</span>
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', s.bg, s.text)}>
      {s.label}
      {approved && status !== 'absent' && status !== 'day_off' && (
        <CheckCircle2 size={9} className="shrink-0" />
      )}
    </span>
  )
}

function RotaMonthlyView({ emp }: { emp: FirebaseEmployee }) {
  const [month,       setMonth]       = useState(currentMonth)
  const [attendance,  setAttendance]  = useState<RotaAttendance[]>([])
  const [shifts,      setShifts]      = useState<RotaShift[]>([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [downloading, setDownloading] = useState(false)

  // Per-shift local overrides (synced to Firestore)
  const [localApproved,  setLocalApproved]  = useState<Set<string>>(new Set())
  const [localNotes,     setLocalNotes]     = useState<Map<string, string>>(new Map())
  const [localLate,      setLocalLate]      = useState<Set<string>>(new Set())
  const [localDeleted,   setLocalDeleted]   = useState<Set<string>>(new Set())
  const [noteModal,      setNoteModal]      = useState<{ date: string; current: string } | null>(null)
  const [infoDate,       setInfoDate]       = useState<string | null>(null)
  const [approving,      setApproving]      = useState(false)
  const [approveStatus,  setApproveStatus]  = useState<{ ok: boolean; msg: string } | null>(null)
  const currentUser = useAppSelector(s => s.auth.user)

  const maxMonth = currentMonth()
  const rcId = emp.rotacloudId ? Number(emp.rotacloudId) : null
  const todayStr = new Date().toISOString().slice(0, 10)

  async function handleDownload() {
    setDownloading(true)
    try {
      await exportTimesheetExcel({
        employeeName: emp.name,
        department:   emp.department ?? '',
        month,
        attendance,
        shifts,
      })
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (!rcId) return
    let cancelled = false
    setLoading(true)
    setError('')
    const { start, end } = monthToUnix(month)

    Promise.all([
      fetchRotaAttendance(start, end),
      fetchRotaShifts(start, end),
    ])
      .then(([attRecs, shiftRecs]) => {
        if (!cancelled) {
          setAttendance(attRecs.filter(r => !r.deleted && r.user === rcId))
          setShifts(shiftRecs.filter(s => !s.deleted && s.published && !s.open && s.user === rcId))
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [month, rcId])

  // Load per-shift notes/flags from Firestore
  useEffect(() => {
    if (!emp.id) return
    let cancelled = false
    getDocs(query(
      collection(db, 'shift_notes'),
      where('employeeId', '==', emp.id),
      where('month', '==', month),
    )).then(snap => {
      if (cancelled) return
      const approved = new Set<string>()
      const notes    = new Map<string, string>()
      const late     = new Set<string>()
      const deleted  = new Set<string>()
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.approved)    approved.add(data.date as string)
        if (data.note)        notes.set(data.date as string, data.note as string)
        if (data.markedLate)  late.add(data.date as string)
        if (data.deleted)     deleted.add(data.date as string)
      })
      setLocalApproved(approved)
      setLocalNotes(notes)
      setLocalLate(late)
      setLocalDeleted(deleted)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [emp.id, month])

  async function saveShiftNote(date: string, patch: Record<string, unknown>) {
    await setDoc(doc(db, 'shift_notes', `${emp.id}_${date}`), {
      employeeId: emp.id, month, date, ...patch,
    }, { merge: true })
  }

  const handleApproveShift = (date: string) => {
    const was = localApproved.has(date)
    setLocalApproved(prev => { const n = new Set(prev); was ? n.delete(date) : n.add(date); return n })
    saveShiftNote(date, { approved: !was }).catch(() => {})
  }
  const handleMarkLate = (date: string) => {
    const was = localLate.has(date)
    setLocalLate(prev => { const n = new Set(prev); was ? n.delete(date) : n.add(date); return n })
    saveShiftNote(date, { markedLate: !was }).catch(() => {})
  }
  const handleDeleteShift = (date: string) => {
    const was = localDeleted.has(date)
    setLocalDeleted(prev => { const n = new Set(prev); was ? n.delete(date) : n.add(date); return n })
    saveShiftNote(date, { deleted: !was }).catch(() => {})
  }
  const handleSaveNote = (date: string, note: string) => {
    setLocalNotes(prev => { const n = new Map(prev); n.set(date, note); return n })
    saveShiftNote(date, { note }).catch(() => {})
    setNoteModal(null)
  }

  // Index attendance by date — use actual clock-in if present, else scheduled
  const attByDate = new Map<string, RotaAttendance>()
  for (const r of attendance) {
    const unix = (r.in_time_clocked ?? r.in_time) as number
    const d = unixToLocalDate(unix)
    const ex = attByDate.get(d)
    if (!ex || r.approved) attByDate.set(d, r)
  }

  // Index shifts by date (scheduled start time)
  const shiftByDate = new Map<string, RotaShift>()
  for (const s of shifts) {
    const d = unixToLocalDate(s.start_time)
    if (!shiftByDate.has(d)) shiftByDate.set(d, s)
  }

  // All days of the month
  const [y, mo] = month.split('-').map(Number)
  const daysInMonth = new Date(y, mo, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dd   = String(i + 1).padStart(2, '0')
    const date = `${month}-${dd}`
    return { date, att: attByDate.get(date), shift: shiftByDate.get(date) }
  })
  const visibleDays = days.filter(d => !localDeleted.has(d.date))

  // Totals (exclude locally deleted rows)
  const attList      = [...attByDate.values()].filter(r => {
    const d = unixToLocalDate((r.in_time_clocked ?? r.in_time) as number)
    return !localDeleted.has(d)
  })
  const totalHours   = attList.reduce((s, r) => s + r.hours, 0)
  const totalDays    = attList.filter(r => r.hours > 0 || r.in_time_clocked).length
  const lateDays     = attList.filter(r => r.minutes_late > 0).length
  const approvedDays = attList.filter(r => r.approved).length
  const overtimeH    = attList.reduce((s, r) => s + Math.max(0, r.hours - 8), 0)
  const absentDays   = days.filter(({ date, att }) =>
    !att && !isWeekend(date) && date < todayStr && !localDeleted.has(date)
  ).length

  const completedAtt = attendance.filter(a => a.in_time_clocked && a.out_time_clocked)

  const handleApproveAll = async () => {
    if (!rcId) return
    setApproving(true)
    setApproveStatus(null)
    try {
      const isHourly = emp.payType === 'hourly'
      let approvedHours = 0
      let lateCount = 0
      let completedShifts = 0
      for (const att of attendance) {
        if (!att.in_time_clocked || !att.out_time_clocked) continue
        completedShifts++
        if (att.minutes_late > 0) lateCount++

        // Use RotaCloud's hours when set; otherwise compute from clock times
        let hrs = att.hours > 0
          ? att.hours
          : Math.max(0, (att.out_time_clocked - att.in_time_clocked) / 3600 - att.minutes_break / 60)

        if (isHourly) {
          const d = unixToLocalDate(att.in_time_clocked)
          const shift = shiftByDate.get(d)
          if (shift) {
            const scheduledHrs = (shift.end_time - shift.start_time) / 3600 - att.minutes_break / 60
            hrs = Math.min(hrs, Math.max(0, scheduledHrs))
          }
        }
        approvedHours += hrs
      }
      // Apply monthly threshold cap if set
      const threshold = emp.monthlyHours
      if (threshold != null) approvedHours = Math.min(approvedHours, threshold)

      await setDoc(doc(db, 'shift_approvals', `${emp.id}_${month}`), {
        employeeId:     emp.id,
        month,
        approvedHours:  Math.round(approvedHours * 100) / 100,
        lateCount,
        completedShifts,
        approvedAt:     serverTimestamp(),
        approvedBy:     currentUser?.name ?? currentUser?.email ?? 'Admin',
      })
      const capNote = threshold != null ? ` (capped at ${threshold}h)` : isHourly ? ' (capped to scheduled hours)' : ''
      setApproveStatus({
        ok:  true,
        msg: `${completedShifts} shifts approved · ${Math.round(approvedHours * 10) / 10}h${capNote} · sent to payroll`,
      })
    } catch (err) {
      setApproveStatus({ ok: false, msg: err instanceof Error ? err.message : 'Failed to save approval' })
    } finally {
      setApproving(false)
    }
  }

  if (!rcId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertCircle size={28} className="text-gray-300" />
        <p className="text-sm font-semibold text-gray-500">Not linked to RotaCloud</p>
        <p className="text-xs text-gray-400">Go to Settings → Integrations → Fetch & Match to link this employee.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header: month nav + summary tiles ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Month navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(m => prevMonth(m))}
            disabled={month <= MIN_MONTH}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-30 shrink-0">
            <ChevronLeft size={15} />
          </button>
          <div className="text-center min-w-[160px]">
            <p className="text-base font-bold text-secondary">{fmtMonth(month)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">RotaCloud Timesheet</p>
          </div>
          <button
            onClick={() => setMonth(m => nextMonth(m))}
            disabled={month >= maxMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-30 shrink-0">
            <ChevronRight size={15} />
          </button>
          {loading && <RefreshCw size={13} className="text-gray-400 animate-spin ml-2" />}
          <button
            onClick={handleDownload}
            disabled={downloading || loading || attendance.length === 0}
            className={cn(
              'ml-3 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition',
              downloading || loading || attendance.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary/90 shadow-sm'
            )}>
            {downloading
              ? <><RefreshCw size={12} className="animate-spin" />Exporting…</>
              : <><Download size={12} />Download Excel</>}
          </button>
          <button
            onClick={handleApproveAll}
            disabled={approving || loading || completedAtt.length === 0}
            className={cn(
              'ml-1 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition',
              approving || loading || completedAtt.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
            )}>
            {approving
              ? <><RefreshCw size={12} className="animate-spin" />Approving…</>
              : <><CheckCircle2 size={12} />Approve All ({completedAtt.length})</>}
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: 'Worked',    value: `${totalDays}d`,           color: 'bg-green-50 text-green-700 border-green-200'   },
            { label: 'Hours',     value: fmtHours(totalHours),      color: 'bg-blue-50 text-blue-700 border-blue-200'      },
            { label: 'Overtime',  value: fmtHours(overtimeH),       color: 'bg-indigo-50 text-indigo-700 border-indigo-200'},
            { label: 'Absent',    value: `${absentDays}d`,          color: 'bg-red-50 text-red-600 border-red-200'         },
            { label: 'Late',      value: `${lateDays}d`,            color: 'bg-amber-50 text-amber-700 border-amber-200'   },
            { label: 'Approved',  value: `${approvedDays}d`,        color: 'bg-violet-50 text-violet-700 border-violet-200'},
          ].map(s => (
            <div key={s.label} className={cn('border rounded-lg px-3 py-1.5 flex items-center gap-1.5', s.color)}>
              <span className="font-medium opacity-70">{s.label}</span>
              <span className="font-bold tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Approve-all status banner */}
      {approveStatus && (
        <div className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-3 text-xs',
          approveStatus.ok
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-600'
        )}>
          {approveStatus.ok ? <CheckCircle2 size={13} className="shrink-0" /> : <AlertCircle size={13} className="shrink-0" />}
          <span className="flex-1">{approveStatus.msg}</span>
          <button onClick={() => setApproveStatus(null)} className="text-gray-400 hover:text-gray-600 ml-auto">✕</button>
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <NoteModal
          date={noteModal.date}
          initial={noteModal.current}
          onSave={text => handleSaveNote(noteModal.date, text)}
          onClose={() => setNoteModal(null)}
        />
      )}

      {/* Shift info modal */}
      {infoDate && (() => {
        const found = days.find(x => x.date === infoDate)
        return found
          ? <ShiftInfoModal date={infoDate} att={found.att} shift={found.shift} note={localNotes.get(infoDate) ?? ''} onClose={() => setInfoDate(null)} />
          : null
      })()}

      {/* ── Timesheet table ── */}
      <div className="rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        <table className="w-full text-xs min-w-[880px] border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap w-24">Date</th>
              <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase tracking-wide text-[10px] w-12">Day</th>
              <th className="px-3 py-3 text-center font-bold text-gray-400 uppercase tracking-wide text-[10px]" colSpan={2}>Scheduled</th>
              <th className="px-3 py-3 text-center font-bold text-gray-600 uppercase tracking-wide text-[10px]" colSpan={2}>Actual Clock</th>
              <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">Break</th>
              <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">Hours</th>
              <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">Overtime</th>
              <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">Late</th>
              <th className="px-4 py-3 text-center font-bold text-gray-500 uppercase tracking-wide text-[10px]">Status</th>
              <th className="px-3 py-3 text-center font-bold text-gray-500 uppercase tracking-wide text-[10px]">Actions</th>
            </tr>
            {/* Sub-headers for Scheduled / Actual columns */}
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <td colSpan={2} />
              <td className="px-3 pb-2 text-center text-[9px] text-gray-400 font-semibold">Start</td>
              <td className="px-3 pb-2 text-center text-[9px] text-gray-400 font-semibold">Finish</td>
              <td className="px-3 pb-2 text-center text-[9px] text-gray-500 font-semibold">In</td>
              <td className="px-3 pb-2 text-center text-[9px] text-gray-500 font-semibold">Out</td>
              <td colSpan={6} />
            </tr>
          </thead>
          <tbody>
            {visibleDays.map(({ date, att, shift }) => {
              const weekend  = isWeekend(date)
              const future   = date > todayStr
              const isToday  = date === todayStr
              const stilIn   = !!att?.in_time_clocked && !att?.out_time_clocked

              // Scheduled times from published shift record
              const schedIn  = shift ? unixToHHMM(shift.start_time) : undefined
              const schedOut = shift ? unixToHHMM(shift.end_time)   : undefined

              // Actual clock times — fall back to att.in_time/out_time for timesheet entries
              const clockInActual  = att?.in_time_clocked  ? unixToHHMM(att.in_time_clocked)  : undefined
              const clockOutActual = att?.out_time_clocked ? unixToHHMM(att.out_time_clocked) : undefined
              const clockInLogged  = att && !clockInActual  ? unixToHHMM(att.in_time)  : undefined
              const clockOutLogged = att && !clockOutActual ? unixToHHMM(att.out_time) : undefined

              // Derive status
              let status = 'future'
              if (weekend && !att) {
                status = 'day_off'
              } else if (att) {
                if (stilIn)                                            status = 'live'
                else if (att.hours > 0 && att.hours < 4)             status = 'half_day'
                else if (att.hours >= 4 && att.minutes_late > 0)     status = 'late'
                else if (att.hours >= 4)                              status = 'present'
                else                                                   status = 'present'
              } else if (!future && !weekend) {
                status = 'absent'
              }

              const dimmed     = weekend || future
              const rowBg      = isToday   ? 'bg-blue-50/40'
                               : status === 'absent' ? 'bg-red-50/30'
                               : weekend  ? 'bg-gray-50/60'
                               : 'bg-white hover:bg-gray-50/50'

              const txtBase    = dimmed ? 'text-gray-300' : 'text-gray-700'
              const txtMuted   = dimmed ? 'text-gray-300' : 'text-gray-400'

              return (
                <tr key={date} className={cn('border-b border-gray-100 last:border-0 transition-colors', rowBg)}>

                  {/* Date */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                      <span className={cn('font-semibold tabular-nums', isToday ? 'text-primary' : txtBase)}>
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </td>

                  {/* Day */}
                  <td className={cn('px-3 py-2.5', txtMuted)}>{dayOfWeek(date)}</td>

                  {/* Scheduled Start */}
                  <td className={cn('px-3 py-2.5 text-center font-mono', txtMuted)}>
                    {schedIn ? fmt12(schedIn) : <span className="text-gray-200">—</span>}
                  </td>

                  {/* Scheduled Finish */}
                  <td className={cn('px-3 py-2.5 text-center font-mono', txtMuted)}>
                    {schedOut ? fmt12(schedOut) : <span className="text-gray-200">—</span>}
                  </td>

                  {/* Actual Clock In (terminal) or logged start time */}
                  <td className="px-3 py-2.5 text-center">
                    {clockInActual
                      ? <span className={cn('font-mono font-semibold', att?.minutes_late && att.minutes_late > 0 ? 'text-amber-600' : 'text-gray-700')}>
                          {fmt12(clockInActual)}
                          {att?.minutes_late && att.minutes_late > 0
                            ? <span className="ml-1 text-[9px] text-amber-500">+{att.minutes_late}m</span>
                            : null}
                        </span>
                      : clockInLogged
                        ? <span className="font-mono text-gray-400" title="Logged time (no terminal clock-in)">{fmt12(clockInLogged)}</span>
                        : <span className="text-gray-200">—</span>}
                  </td>

                  {/* Actual Clock Out (terminal) or logged finish time */}
                  <td className="px-3 py-2.5 text-center">
                    {stilIn
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
                        </span>
                      : clockOutActual
                        ? <span className="font-mono font-semibold text-gray-700">{fmt12(clockOutActual)}</span>
                        : clockOutLogged
                          ? <span className="font-mono text-gray-400" title="Logged time (no terminal clock-out)">{fmt12(clockOutLogged)}</span>
                          : <span className="text-gray-200">—</span>}
                  </td>

                  {/* Break */}
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', txtMuted)}>
                    {att?.minutes_break ? `${att.minutes_break}m` : <span className="text-gray-200">—</span>}
                  </td>

                  {/* Hours */}
                  <td className="px-3 py-2.5 text-right">
                    {att?.hours
                      ? <span className="font-bold text-gray-800 tabular-nums">{fmtHours(att.hours)}</span>
                      : <span className="text-gray-200">—</span>}
                  </td>

                  {/* Overtime */}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {att?.hours && att.hours > 8
                      ? <span className="text-indigo-600 font-semibold">{fmtHours(att.hours - 8)}</span>
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
                    <div className="flex items-center justify-center gap-1">
                      <StatusBadge status={status} approved={att?.approved || localApproved.has(date)} />
                      {localNotes.has(date) && (
                        <span title={localNotes.get(date)} className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5 text-center">
                    <ShiftActionDropdown
                      date={date}
                      att={att}
                      shift={shift}
                      approved={localApproved.has(date)}
                      note={localNotes.get(date) ?? ''}
                      late={localLate.has(date)}
                      deleted={localDeleted.has(date)}
                      onApprove={() => handleApproveShift(date)}
                      onNote={() => setNoteModal({ date, current: localNotes.get(date) ?? '' })}
                      onMarkLate={() => handleMarkLate(date)}
                      onDelete={() => handleDeleteShift(date)}
                      onInfo={() => setInfoDate(date)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Monthly totals footer */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                Monthly Total — {totalDays} days worked
              </td>
              <td colSpan={2} />
              <td className="px-3 py-3 text-right text-xs font-bold text-gray-600 tabular-nums">
                {attList.reduce((s, r) => s + r.minutes_break, 0)}m
              </td>
              <td className="px-3 py-3 text-right text-xs font-bold text-primary tabular-nums">
                {fmtHours(totalHours)}
              </td>
              <td className="px-3 py-3 text-right text-xs font-bold text-indigo-600 tabular-nums">
                {fmtHours(overtimeH)}
              </td>
              <td className="px-3 py-3 text-right text-xs text-gray-400 tabular-nums">
                {lateDays}d late
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-[10px] text-violet-600 font-semibold">{approvedDays} approved</span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        {!loading && days.length > 0 && totalDays === 0 && !error && (
          <div className="py-8 text-center text-xs text-gray-400">
            No clock-in records found in RotaCloud for {fmtMonth(month)}.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
        {[
          { dot: 'bg-emerald-500', label: 'Live — currently clocked in' },
          { dot: 'bg-green-500',   label: 'Present' },
          { dot: 'bg-amber-500',   label: 'Late > 30 min' },
          { dot: 'bg-purple-500',  label: 'Half Day < 4 h' },
          { dot: 'bg-red-400',     label: 'Absent (no clock-in)' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', l.dot)} />{l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={10} className="text-green-500 shrink-0" />Approved by manager
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TimesheetTab({ emp }: { emp: FirebaseEmployee }) {
  const currentUser = useAppSelector(s => s.auth.user)
  const role        = currentUser?.role ?? 'employee'

  // Determine permissions based on who is viewing
  const isOwnProfile      = currentUser?.email === emp.email
  const canClockInOut     = isOwnProfile
  const canMarkAttendance = (role === 'hr' || role === 'admin') && !isOwnProfile
  const canEdit           = role === 'hr' || role === 'admin'
  const canApprove        = (role === 'admin' || role === 'hr' || role === 'team_lead') && !isOwnProfile

  const [view,        setView]        = useState<'weekly' | 'monthly'>('weekly')
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

  const rcId = emp.rotacloudId ? Number(emp.rotacloudId) : null

  // ── Weekly RotaCloud fetch ────────────────────────────────────────────
  const [weekRcAtt,     setWeekRcAtt]     = useState<RotaAttendance[]>([])
  const [weekRcShifts,  setWeekRcShifts]  = useState<RotaShift[]>([])
  const [weekRcLoading, setWeekRcLoading] = useState(false)

  useEffect(() => {
    if (!rcId || view !== 'weekly') return
    let cancelled = false
    setWeekRcLoading(true)
    const startUnix = Math.floor(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).getTime() / 1000)
    const endDay    = addDays(weekStart, 6)
    const endUnix   = Math.floor(new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59).getTime() / 1000)
    Promise.all([
      fetchRotaAttendance(startUnix, endUnix),
      fetchRotaShifts(startUnix, endUnix),
    ])
      .then(([att, shf]) => {
        if (!cancelled) {
          setWeekRcAtt(att.filter(r => !r.deleted && r.user === rcId))
          setWeekRcShifts(shf.filter(s => !s.deleted && s.published && !s.open && s.user === rcId))
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setWeekRcLoading(false) })
    return () => { cancelled = true }
  }, [weekStart, rcId, view])

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

  // Index weekly RC data by date string (YYYY-MM-DD)
  const weekRcAttByDate   = new Map<string, RotaAttendance>()
  for (const r of weekRcAtt) {
    const d = unixToLocalDate((r.in_time_clocked ?? r.in_time) as number)
    weekRcAttByDate.set(d, r)
  }
  const weekRcShiftByDate = new Map<string, RotaShift>()
  for (const s of weekRcShifts) {
    const d = unixToLocalDate(s.start_time)
    if (!weekRcShiftByDate.has(d)) weekRcShiftByDate.set(d, s)
  }

  return (
    <div>
      {/* ── View toggle ── */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-4">
        {(['weekly', 'monthly'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition',
              view === v ? 'bg-white shadow-sm text-secondary' : 'text-gray-500 hover:text-gray-700'
            )}>
            {v === 'weekly' ? 'Weekly' : 'Monthly (RotaCloud)'}
          </button>
        ))}
      </div>

      {/* ── Monthly RotaCloud view ── */}
      {view === 'monthly' && <RotaMonthlyView emp={emp} />}

      {/* ── Weekly view ── */}
      {view === 'weekly' && <div>

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
              {weekRcLoading && <RefreshCw size={11} className="text-gray-400 animate-spin ml-1" />}
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
                    {/* RotaCloud attendance row */}
                    {(() => {
                      const rcAtt   = weekRcAttByDate.get(ymd)
                      const rcShift = weekRcShiftByDate.get(ymd)
                      if (!rcAtt && !rcShift) return null
                      const stilIn = !!rcAtt?.in_time_clocked && !rcAtt?.out_time_clocked
                      return (
                        <div className={cn(
                          'flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]',
                          dayEntries.length > 0 && 'mt-1.5 pt-1.5 border-t border-gray-100'
                        )}>
                          <span className="font-bold px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded text-[9px] uppercase tracking-wider shrink-0">RC</span>
                          {rcShift && (
                            <span className="text-gray-400">
                              Sched: <span className="font-mono text-gray-500">{fmt12(unixToHHMM(rcShift.start_time))}–{fmt12(unixToHHMM(rcShift.end_time))}</span>
                            </span>
                          )}
                          {rcAtt?.in_time_clocked && (
                            <span className={cn('font-mono', rcAtt.minutes_late > 0 ? 'text-amber-600' : 'text-gray-600')}>
                              In {fmt12(unixToHHMM(rcAtt.in_time_clocked))}
                              {rcAtt.minutes_late > 0 && <span className="text-amber-500 ml-0.5">+{rcAtt.minutes_late}m late</span>}
                            </span>
                          )}
                          {stilIn
                            ? <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />Live
                              </span>
                            : rcAtt?.out_time_clocked
                              ? <span className="font-mono text-gray-600">Out {fmt12(unixToHHMM(rcAtt.out_time_clocked))}</span>
                              : null}
                          {rcAtt && rcAtt.hours > 0 && (
                            <span className="font-semibold text-gray-700">{fmtHours(rcAtt.hours)}</span>
                          )}
                          {rcAtt?.approved && (
                            <span className="text-green-600 flex items-center gap-0.5">
                              <CheckCircle2 size={9} />Approved
                            </span>
                          )}
                        </div>
                      )
                    })()}
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
      </div>}
    </div>
  )
}
