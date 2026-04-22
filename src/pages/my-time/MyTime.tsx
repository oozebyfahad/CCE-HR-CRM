import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import {
  CalendarClock, Sun, Sunset, Moon, ChevronLeft, ChevronRight, Clock,
} from 'lucide-react'

interface ShiftAssignment {
  id: string
  employeeId: string
  shiftName: string
  startTime: string
  endTime: string
  project?: string
  days: string[]
  startDate?: string
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const SHIFT_STYLE: Record<string, { Icon: React.ElementType; bg: string; border: string; text: string; badge: string }> = {
  Morning:   { Icon: Sun,         bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700'  },
  Afternoon: { Icon: Sunset,      bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  Night:     { Icon: Moon,        bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
  default:   { Icon: CalendarClock, bg: 'bg-blue-50', border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700'    },
}

function getWeekDates(ref: Date): Date[] {
  const day = ref.getDay()
  const mon = new Date(ref)
  mon.setDate(ref.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MyTime() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees, loading } = useFirebaseEmployees()
  const myEmployee = employees.find(e => e.email === currentUser?.email)

  const [shifts, setShifts] = useState<ShiftAssignment[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(true)
  const [tab, setTab] = useState<'week' | 'month'>('week')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d
  })

  useEffect(() => {
    if (!myEmployee) { setShiftsLoading(false); return }
    const fetch = async () => {
      try {
        const q = query(
          collection(db, 'shift_assignments'),
          where('employeeId', '==', myEmployee.employeeId ?? myEmployee.id),
        )
        const snap = await getDocs(q)
        setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftAssignment)))
      } finally { setShiftsLoading(false) }
    }
    fetch()
  }, [myEmployee?.id])

  const getShiftForDay = (dayName: string): ShiftAssignment | null =>
    shifts.find(s => s.days?.includes(dayName)) ?? null

  const weekDays = getWeekDates(new Date())
  const today = toYMD(new Date())

  // Stats
  const scheduledDaysPerWeek = DAY_ABBR.filter(d => getShiftForDay(d)).length
  const shiftHours = (s: ShiftAssignment) => {
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    let diff = (eh * 60 + em) - (sh * 60 + sm)
    if (diff < 0) diff += 24 * 60
    return diff / 60
  }
  const weeklyHours = shifts.reduce((acc, s) => {
    const h = shiftHours(s)
    return acc + s.days.length * h
  }, 0)
  const firstShift = shifts[0]

  // Month calendar
  const monthYear = currentMonth.getFullYear()
  const monthIdx  = currentMonth.getMonth()
  const daysInMonth = new Date(monthYear, monthIdx + 1, 0).getDate()
  const firstWeekday = new Date(monthYear, monthIdx, 1).getDay()
  const prevMonth = () => setCurrentMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })
  const nextMonth = () => setCurrentMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })

  if (loading) {
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
            <span className="text-indigo-300 text-[11px] font-semibold tracking-wide">SHIFT SCHEDULE</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">My Shifts</h1>
          <p className="text-white/50 text-sm mt-2">
            {firstShift
              ? `${firstShift.shiftName} Shift · ${firstShift.startTime} – ${firstShift.endTime}`
              : 'Your weekly and monthly shift schedule'}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Shifts Assigned',  value: String(shifts.length),                                color: '#818CF8' },
              { label: 'Days / Week',       value: scheduledDaysPerWeek > 0 ? `${scheduledDaysPerWeek}d` : '—', color: '#FCD34D' },
              { label: 'Hours / Week',      value: weeklyHours > 0 ? `${weeklyHours.toFixed(1)}h` : '—',        color: '#6EE7B7' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        {(['week', 'month'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
              tab === t ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {t === 'week' ? 'This Week' : 'Monthly View'}
          </button>
        ))}
      </div>

      {/* ── Week View ── */}
      {tab === 'week' && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Week of {weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
            {weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {weekDays.map(date => {
              const dayAbbr = DAY_ABBR[date.getDay()]
              const dayFull = DAY_FULL[date.getDay()]
              const shift   = getShiftForDay(dayAbbr)
              const isToday = toYMD(date) === today
              const style   = shift ? (SHIFT_STYLE[shift.shiftName] ?? SHIFT_STYLE.default) : null
              const ShiftIcon = style?.Icon ?? Clock

              return (
                <div key={dayAbbr}
                  className={`rounded-2xl border p-4 transition-all ${
                    isToday
                      ? 'bg-secondary border-secondary/30 shadow-lg'
                      : shift
                        ? `${style!.bg} ${style!.border}`
                        : 'bg-gray-50 border-gray-200'
                  }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-white/60' : 'text-gray-400'}`}>
                        {dayAbbr}
                      </p>
                      <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-secondary'}`}>
                        {dayFull}
                      </p>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isToday ? 'bg-white/20 text-white' : ''
                    }`}>
                      {date.getDate()}
                    </div>
                  </div>

                  {shiftsLoading ? (
                    <div className={`h-4 rounded animate-pulse ${isToday ? 'bg-white/10' : 'bg-gray-200'}`} />
                  ) : shift ? (
                    <div className={`flex items-center gap-2 ${isToday ? '' : ''}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isToday ? 'bg-white/20' : style!.badge.split(' ')[0]
                      }`}>
                        <ShiftIcon size={15} className={isToday ? 'text-white' : style!.text} />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${isToday ? 'text-white' : style!.text}`}>{shift.shiftName} Shift</p>
                        <p className={`text-[11px] ${isToday ? 'text-white/60' : 'text-gray-500'}`}>
                          {shift.startTime} – {shift.endTime}
                        </p>
                        {shift.project && (
                          <p className={`text-[10px] font-medium mt-0.5 ${isToday ? 'text-white/50' : 'text-gray-400'}`}>
                            {shift.project}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={`flex items-center gap-1.5 ${isToday ? 'text-white/40' : 'text-gray-400'}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      <p className="text-xs">No shift</p>
                    </div>
                  )}

                  {isToday && (
                    <div className="mt-3 pt-2 border-t border-white/10">
                      <span className="text-[10px] font-bold text-white/70 bg-white/10 px-2 py-0.5 rounded-full">TODAY</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Shift legend */}
          {shifts.length > 0 && (
            <div className="card p-4 flex items-center gap-6 flex-wrap">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Assigned Shifts</p>
              {shifts.map(s => {
                const st = SHIFT_STYLE[s.shiftName] ?? SHIFT_STYLE.default
                const SI = st.Icon
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${st.badge.split(' ')[0]}`}>
                      <SI size={13} className={st.text} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-secondary">{s.shiftName} Shift</p>
                      <p className="text-[10px] text-gray-400">{s.startTime} – {s.endTime}</p>
                    </div>
                    <div className="flex gap-1 ml-1">
                      {s.days.map(d => (
                        <span key={d} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{d}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!shiftsLoading && shifts.length === 0 && (
            <div className="card p-8 text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CalendarClock size={24} className="text-indigo-300" />
              </div>
              <p className="text-sm font-semibold text-secondary">No shifts assigned</p>
              <p className="text-xs text-gray-400 mt-1">Contact HR to get your shift schedule assigned.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Month View ── */}
      {tab === 'month' && (
        <div className="card overflow-hidden">
          {/* Month header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <button onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-secondary">{MONTH_NAMES[monthIdx]}</p>
              <p className="text-xs text-gray-400">{monthYear}</p>
            </div>
            <button onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_ABBR.map(d => (
                <p key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide py-1">{d}</p>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array(firstWeekday).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const date    = new Date(monthYear, monthIdx, day)
                const dayName = DAY_ABBR[date.getDay()]
                const shift   = getShiftForDay(dayName)
                const ds      = `${monthYear}-${String(monthIdx + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const isToday = ds === today
                const style   = shift ? (SHIFT_STYLE[shift.shiftName] ?? SHIFT_STYLE.default) : null

                return (
                  <div key={day}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all
                      ${isToday ? 'bg-secondary text-white shadow-md'
                        : shift ? `${style!.bg} ${style!.border} border`
                        : 'hover:bg-gray-50'
                      }`}>
                    <span className={`text-sm font-bold ${isToday ? 'text-white' : shift ? style!.text : 'text-gray-600'}`}>
                      {day}
                    </span>
                    {shift && !isToday && (
                      <span className={`text-[8px] font-bold leading-none mt-0.5 ${style!.text}`}>
                        {shift.shiftName.slice(0, 3).toUpperCase()}
                      </span>
                    )}
                    {shift && isToday && (
                      <span className="text-[8px] font-bold text-white/70 leading-none mt-0.5">
                        {shift.shiftName.slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-secondary" />
                <span className="text-[11px] text-gray-500">Today</span>
              </div>
              {Object.entries(SHIFT_STYLE).filter(([k]) => k !== 'default').map(([name, st]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-md ${st.bg} border ${st.border}`} />
                  <span className="text-[11px] text-gray-500">{name}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-gray-50 border border-gray-200" />
                <span className="text-[11px] text-gray-500">Day off</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
