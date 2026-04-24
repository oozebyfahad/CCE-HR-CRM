import { useState, useMemo, useEffect } from 'react'
import {
  Plus, Sun, Sunset, Moon, RotateCcw, Users, Clock, Edit2, Trash2, X,
  ChevronLeft, ChevronRight, Copy, CheckCircle2, UserPlus, AlertTriangle,
} from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, isToday } from 'date-fns'
import type { Shift, ShiftAssignment } from '../../types'
import { cn } from '../../utils/cn'

// ── Types ─────────────────────────────────────────────────────────────
type View      = 'rota' | 'shifts' | 'roster'
type RotaData  = Record<string, Record<string, string>>   // [dateStr][empId] = shiftId
type RotaState = Record<string, RotaData>                 // [weekKey] = RotaData

interface RotaEmployee {
  id: string
  name: string
  jobTitle: string
  project: string
}

// ── Constants ─────────────────────────────────────────────────────────
const DEFAULT_SHIFTS: Shift[] = []

const DEFAULT_EMPLOYEES: RotaEmployee[] = []

const SAMPLE_ASSIGNMENTS: ShiftAssignment[] = []

const PROJECTS    = ['All', 'CCE', 'VGT', 'ADT', '1AB', 'A1 Ace Taxis']
const DAYS_ORDER  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const SHIFT_ICON: Record<string, React.ElementType> = {
  Morning:   Sun,
  Afternoon: Sunset,
  Night:     Moon,
  Rotating:  RotateCcw,
}

// ── Helpers ───────────────────────────────────────────────────────────
function getWeekDates(offset: number): Date[] {
  const base = startOfWeek(addWeeks(new Date(), offset), { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(base, i))
}

function shiftMins(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const m = (eh * 60 + em) - (sh * 60 + sm)
  return m < 0 ? m + 1440 : m
}

function fmtDuration(start: string, end: string): string {
  const m = shiftMins(start, end)
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`
}

function buildRota(assignments: ShiftAssignment[], shifts: Shift[], dates: Date[]): RotaData {
  const rota: RotaData = {}
  dates.forEach(date => {
    const ds  = format(date, 'yyyy-MM-dd')
    const dow = format(date, 'EEE')
    rota[ds]  = {}
    assignments.forEach(a => {
      const sh = shifts.find(s => s.id === a.shiftId)
      if (sh && a.isActive && sh.days.includes(dow)) rota[ds][a.employeeId] = a.shiftId
    })
  })
  return rota
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────
export default function Shifts() {
  const [shifts,      setShifts]      = useState<Shift[]>(DEFAULT_SHIFTS)
  const [assignments, setAssignments] = useState<ShiftAssignment[]>(SAMPLE_ASSIGNMENTS)
  const [employees]                   = useState<RotaEmployee[]>(DEFAULT_EMPLOYEES)
  const [view,        setView]        = useState<View>('rota')
  const [weekOffset,  setWeekOffset]  = useState(0)
  const [projectFilter, setProjectFilter] = useState('All')
  const [publishedWeeks, setPublishedWeeks] = useState<Set<string>>(new Set())
  const [rotaState,   setRotaState]   = useState<RotaState>({})
  const [cellModal,   setCellModal]   = useState<{ dateStr: string; empId: string } | null>(null)

  // Shift-definition form
  const [showForm,       setShowForm]       = useState(false)
  const [editingShift,   setEditingShift]   = useState<Shift | null>(null)
  const [form,           setForm]           = useState({ name: '', startTime: '', endTime: '', project: 'CCE', days: [] as string[] })

  // Roster assign form
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignForm,     setAssignForm]     = useState({ employeeId: '', employeeName: '', jobTitle: '', shiftId: '', startDate: '' })

  const weekDates  = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const weekKey    = format(weekDates[0], 'yyyy-MM-dd')
  const isPublished = publishedWeeks.has(weekKey)

  // Auto-initialise rota for any week we navigate to
  useEffect(() => {
    setRotaState(prev => {
      if (prev[weekKey]) return prev
      return { ...prev, [weekKey]: buildRota(assignments, shifts, weekDates) }
    })
  }, [weekKey, assignments, shifts, weekDates])

  const currentRota = useMemo(() => rotaState[weekKey] ?? {}, [rotaState, weekKey])

  const filteredEmployees  = useMemo(() =>
    projectFilter === 'All' ? employees  : employees.filter(e  => e.project  === projectFilter),
    [employees, projectFilter])

  const filteredShifts     = useMemo(() =>
    projectFilter === 'All' ? shifts     : shifts.filter(s     => s.project  === projectFilter),
    [shifts, projectFilter])

  const filteredAssignments = useMemo(() =>
    projectFilter === 'All' ? assignments : assignments.filter(a => a.project === projectFilter),
    [assignments, projectFilter])

  // ── Rota actions ─────────────────────────────────────────────────
  function assignCell(dateStr: string, empId: string, shiftId: string | null) {
    setRotaState(prev => {
      const week = { ...(prev[weekKey] ?? {}) }
      const day  = { ...(week[dateStr] ?? {}) }
      if (shiftId === null) delete day[empId]
      else day[empId] = shiftId
      week[dateStr] = day
      return { ...prev, [weekKey]: week }
    })
    setCellModal(null)
  }

  function copyLastWeek() {
    const lastDates    = getWeekDates(weekOffset - 1)
    const lastKey      = format(lastDates[0], 'yyyy-MM-dd')
    const lastRota     = rotaState[lastKey] ?? buildRota(assignments, shifts, lastDates)
    const newRota: RotaData = {}
    weekDates.forEach((date, i) => {
      const ds = format(date, 'yyyy-MM-dd')
      newRota[ds] = { ...(lastRota[format(lastDates[i], 'yyyy-MM-dd')] ?? {}) }
    })
    setRotaState(prev => ({ ...prev, [weekKey]: newRota }))
  }

  function togglePublish() {
    setPublishedWeeks(prev => {
      const next = new Set(prev)
      next.has(weekKey) ? next.delete(weekKey) : next.add(weekKey)
      return next
    })
  }

  // ── Shift CRUD ────────────────────────────────────────────────────
  function toggleDay(day: string) {
    setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] }))
  }

  function saveShift() {
    if (!form.name || !form.startTime || !form.endTime) return
    const COLORS = ['#2E86C1','#10B981','#F59E0B','#8B5CF6','#EC4899','#F97316','#14B8A6']
    if (editingShift) {
      setShifts(s => s.map(x => x.id === editingShift.id ? { ...editingShift, ...form } : x))
      setEditingShift(null)
    } else {
      setShifts(s => [...s, { id: `s${Date.now()}`, ...form, color: COLORS[s.length % COLORS.length] }])
    }
    setForm({ name: '', startTime: '', endTime: '', project: 'CCE', days: [] })
    setShowForm(false)
  }

  function deleteShift(id: string) {
    setShifts(s => s.filter(x => x.id !== id))
    setAssignments(a => a.filter(x => x.shiftId !== id))
  }

  function saveAssignment() {
    if (!assignForm.employeeId || !assignForm.shiftId) return
    const shift = shifts.find(s => s.id === assignForm.shiftId)
    setAssignments(a => [...a, { id: `a${Date.now()}`, ...assignForm, shiftName: shift?.name ?? '', project: shift?.project ?? '', isActive: true }])
    setAssignForm({ employeeId: '', employeeName: '', jobTitle: '', shiftId: '', startDate: '' })
    setShowAssignForm(false)
  }

  function startEdit(shift: Shift) {
    setEditingShift(shift)
    setForm({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime, project: shift.project, days: [...shift.days] })
    setShowForm(true)
  }

  // ── Stats ─────────────────────────────────────────────────────────
  const weekStats = useMemo(() => {
    let assigned = 0, totalHours = 0
    weekDates.forEach(date => {
      const ds = format(date, 'yyyy-MM-dd')
      const day = currentRota[ds] ?? {}
      const entries = Object.entries(day).filter(([empId]) =>
        projectFilter === 'All' || employees.find(e => e.id === empId)?.project === projectFilter
      )
      assigned += entries.length
      entries.forEach(([, sid]) => {
        const sh = shifts.find(s => s.id === sid)
        if (sh) totalHours += shiftMins(sh.startTime, sh.endTime) / 60
      })
    })
    const openSlots = Math.max(0, filteredEmployees.length * 7 - assigned)
    return { assigned, totalHours: Math.round(totalHours), openSlots }
  }, [weekDates, currentRota, shifts, employees, projectFilter, filteredEmployees.length])

  const empWeeklyHours = useMemo(() => {
    const result: Record<string, number> = {}
    filteredEmployees.forEach(emp => {
      let h = 0
      weekDates.forEach(date => {
        const sid = currentRota[format(date, 'yyyy-MM-dd')]?.[emp.id]
        if (sid) { const sh = shifts.find(s => s.id === sid); if (sh) h += shiftMins(sh.startTime, sh.endTime) / 60 }
      })
      result[emp.id] = Math.round(h)
    })
    return result
  }, [filteredEmployees, weekDates, currentRota, shifts])

  const dayCoverage = useMemo(() =>
    weekDates.map(date => {
      const ds    = format(date, 'yyyy-MM-dd')
      const day   = currentRota[ds] ?? {}
      const count = Object.keys(day).filter(empId =>
        projectFilter === 'All' || employees.find(e => e.id === empId)?.project === projectFilter
      ).length
      return count
    }),
    [weekDates, currentRota, employees, projectFilter]
  )

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Build and manage weekly rotas for your team</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingShift(null); setShowForm(true); setView('shifts') }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
            <Plus size={16} /> New Shift
          </button>
          <button onClick={() => { setShowAssignForm(true); setView('roster') }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors">
            <UserPlus size={16} /> Assign
          </button>
        </div>
      </div>

      {/* ── View tabs + Project filter ───────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([
            { key: 'rota',   label: 'Weekly Rota' },
            { key: 'shifts', label: 'Shift Definitions' },
            { key: 'roster', label: 'Staff Roster' },
          ] as const).map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                view === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto flex-wrap">
          {PROJECTS.map(p => (
            <button key={p} onClick={() => setProjectFilter(p)}
              className={cn('px-3 py-1.5 text-xs rounded-lg font-medium border transition-all',
                projectFilter === p
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROTA VIEW
      ══════════════════════════════════════════════════════════ */}
      {view === 'rota' && (
        <div className="space-y-4">

          {/* Week nav bar */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekOffset(w => w - 1)}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setWeekOffset(0)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600">
                Today
              </button>
              <button onClick={() => setWeekOffset(w => w + 1)}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600">
                <ChevronRight size={16} />
              </button>
              <div className="ml-1">
                <span className="text-sm font-bold text-gray-800">
                  {format(weekDates[0], 'd MMM')} – {format(weekDates[6], 'd MMM yyyy')}
                </span>
                {weekOffset === 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">This Week</span>
                )}
                {weekOffset === 1 && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Next Week</span>
                )}
                {weekOffset === -1 && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">Last Week</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={copyLastWeek}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
                <Copy size={13} /> Copy Last Week
              </button>
              <button onClick={togglePublish}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                  isPublished
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-primary text-white border-primary hover:bg-primary/90'
                )}>
                <CheckCircle2 size={13} />
                {isPublished ? 'Published ✓' : 'Publish Rota'}
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Shifts Assigned',  value: weekStats.assigned,            icon: Users,         col: 'text-primary',   bg: 'bg-primary/5'  },
              { label: 'Total Hours',       value: `${weekStats.totalHours}h`,    icon: Clock,         col: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Open Slots',        value: weekStats.openSlots,           icon: AlertTriangle, col: weekStats.openSlots > 0 ? 'text-amber-600' : 'text-gray-400', bg: weekStats.openSlots > 0 ? 'bg-amber-50' : 'bg-gray-50' },
            ].map(({ label, value, icon: Icon, col, bg }) => (
              <div key={label} className={cn('rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3', bg)}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
                  <Icon size={20} className={col} />
                </div>
                <div>
                  <p className={cn('text-2xl font-bold', col)}>{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Rota grid */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  {/* Employee header */}
                  <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-100 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">
                    Employee
                  </th>
                  {/* Day headers */}
                  {weekDates.map((date, idx) => {
                    const ds        = format(date, 'yyyy-MM-dd')
                    const count     = dayCoverage[idx]
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6
                    const today     = isToday(date)
                    return (
                      <th key={ds} className={cn(
                        'border-b border-r border-gray-100 px-2 py-2 text-center',
                        today ? 'bg-primary/5' : isWeekend ? 'bg-gray-50/80' : 'bg-gray-50'
                      )}>
                        <div className={cn('text-[10px] font-bold uppercase tracking-widest', today ? 'text-primary' : 'text-gray-400')}>
                          {format(date, 'EEE')}
                        </div>
                        <div className={cn('text-base font-bold mt-0.5', today ? 'text-primary' : 'text-gray-800')}>
                          {format(date, 'd')}
                        </div>
                        <div className="text-[9px] text-gray-400">{format(date, 'MMM')}</div>
                        <div className={cn(
                          'mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block',
                          count > 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-300'
                        )}>
                          {count} staff
                        </div>
                      </th>
                    )
                  })}
                  {/* Hours header */}
                  <th className="bg-gray-50 border-b border-gray-100 px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-14">
                    Hrs
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-14 text-gray-400 text-sm">
                      No employees found for this project.
                    </td>
                  </tr>
                ) : filteredEmployees.map((emp, rowIdx) => (
                  <tr key={emp.id}
                    className={cn('border-b border-gray-50 transition-colors hover:bg-gray-50/40', rowIdx % 2 === 1 && 'bg-gray-50/20')}>

                    {/* Employee cell */}
                    <td className="sticky left-0 z-10 bg-white border-r border-gray-100 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {initials(emp.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{emp.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{emp.jobTitle}</p>
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {weekDates.map(date => {
                      const ds        = format(date, 'yyyy-MM-dd')
                      const shiftId   = currentRota[ds]?.[emp.id]
                      const shift     = shifts.find(s => s.id === shiftId)
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6
                      const today     = isToday(date)
                      const Icon      = shift ? (SHIFT_ICON[shift.name] ?? Clock) : null
                      return (
                        <td key={ds}
                          onClick={() => setCellModal({ dateStr: ds, empId: emp.id })}
                          className={cn(
                            'border-r border-gray-100 px-1.5 py-1.5 cursor-pointer transition-colors',
                            today && 'bg-primary/[0.03]',
                            isWeekend && !shift && 'bg-gray-50/60',
                            !shift && 'hover:bg-gray-50'
                          )}>
                          {shift ? (
                            <div
                              className="rounded-lg px-2 py-1.5 text-white cursor-pointer hover:opacity-90 transition-opacity select-none"
                              style={{ backgroundColor: shift.color }}>
                              <div className="flex items-center gap-1 mb-0.5">
                                {Icon && <Icon size={10} />}
                                <span className="text-[10px] font-bold truncate">{shift.name}</span>
                              </div>
                              <div className="text-[9px] opacity-80">{shift.startTime}–{shift.endTime}</div>
                            </div>
                          ) : (
                            <div className="h-[48px] rounded-lg border-2 border-dashed border-gray-150 hover:border-primary/30 hover:bg-primary/5 flex items-center justify-center transition-all group">
                              <Plus size={12} className="text-gray-250 group-hover:text-primary/40 transition-colors" />
                            </div>
                          )}
                        </td>
                      )
                    })}

                    {/* Weekly hours */}
                    <td className="px-2 py-2.5 text-center">
                      <span className={cn(
                        'text-xs font-bold px-1.5 py-0.5 rounded-md',
                        empWeeklyHours[emp.id] > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-gray-300'
                      )}>
                        {empWeeklyHours[emp.id] > 0 ? `${empWeeklyHours[emp.id]}h` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shift legend */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Legend:</span>
            {filteredShifts.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
                <span>{s.project} {s.name}</span>
                <span className="text-gray-400">({s.startTime}–{s.endTime})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SHIFT DEFINITIONS VIEW
      ══════════════════════════════════════════════════════════ */}
      {view === 'shifts' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Shifts',       value: shifts.length },
              { label: 'Active Assignments', value: assignments.filter(a => a.isActive).length },
              { label: 'Projects Covered',   value: [...new Set(shifts.map(s => s.project))].length },
              { label: 'Night Shift Staff',  value: assignments.filter(a => a.shiftName === 'Night' && a.isActive).length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Shift form */}
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{editingShift ? 'Edit Shift' : 'New Shift'}</h3>
                <button onClick={() => { setShowForm(false); setEditingShift(null) }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Shift Name</label>
                  <select className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}>
                    <option value="">Select...</option>
                    {['Morning','Afternoon','Evening','Night','Rotating'].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start Time</label>
                  <input type="time" className={inputCls} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">End Time</label>
                  <input type="time" className={inputCls} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Project</label>
                  <select className={inputCls} value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
                    {PROJECTS.slice(1).map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-2 block">Working Days</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_ORDER.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                        form.days.includes(day)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveShift} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
                  {editingShift ? 'Update' : 'Create'} Shift
                </button>
                <button onClick={() => { setShowForm(false); setEditingShift(null) }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Shift cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShifts.map(shift => {
              const Icon          = SHIFT_ICON[shift.name] ?? Clock
              const assignedCount = assignments.filter(a => a.shiftId === shift.id && a.isActive).length
              return (
                <div key={shift.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${shift.color}20` }}>
                        <Icon size={20} style={{ color: shift.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{shift.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{shift.project}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(shift)} className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 transition-colors"><Edit2 size={13} /></button>
                      <button onClick={() => deleteShift(shift.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Hours</span>
                      <span className="font-medium text-gray-900">{shift.startTime} – {shift.endTime} ({fmtDuration(shift.startTime, shift.endTime)})</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Days</span>
                      <div className="flex gap-0.5">
                        {DAYS_ORDER.map(d => (
                          <span key={d} className={cn('text-[10px] w-5 text-center py-0.5 rounded font-medium',
                            shift.days.includes(d) ? 'bg-gray-800 text-white' : 'text-gray-200')}>
                            {d[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-50">
                      <span>Assigned Staff</span>
                      <span className="font-bold" style={{ color: shift.color }}>{assignedCount}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {filteredShifts.length === 0 && (
              <div className="col-span-3 py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
                No shifts defined for this project yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ROSTER VIEW
      ══════════════════════════════════════════════════════════ */}
      {view === 'roster' && (
        <div className="space-y-4">
          {showAssignForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Assign Employee to Shift</h3>
                <button onClick={() => setShowAssignForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <input className={inputCls} placeholder="Employee ID (e.g. CCE-1004)" value={assignForm.employeeId} onChange={e => setAssignForm(f => ({ ...f, employeeId: e.target.value }))} />
                <input className={inputCls} placeholder="Employee Name" value={assignForm.employeeName} onChange={e => setAssignForm(f => ({ ...f, employeeName: e.target.value }))} />
                <input className={inputCls} placeholder="Job Title" value={assignForm.jobTitle} onChange={e => setAssignForm(f => ({ ...f, jobTitle: e.target.value }))} />
                <select className={inputCls} value={assignForm.shiftId} onChange={e => setAssignForm(f => ({ ...f, shiftId: e.target.value }))}>
                  <option value="">Select Shift...</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.project} – {s.name} ({s.startTime}–{s.endTime})</option>)}
                </select>
                <input type="date" className={inputCls} value={assignForm.startDate} onChange={e => setAssignForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveAssignment} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors">Assign</button>
                <button onClick={() => setShowAssignForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Employee','Job Title','Project','Shift','Hours','Since',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAssignments.map(a => {
                  const shift = shifts.find(s => s.id === a.shiftId)
                  const Icon  = SHIFT_ICON[a.shiftName] ?? Clock
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.employeeName}</td>
                      <td className="px-4 py-3 text-gray-500">{a.jobTitle}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">{a.project}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon size={14} style={{ color: shift?.color }} />
                          <span>{a.shiftName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {shift ? `${shift.startTime} – ${shift.endTime}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{a.startDate}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setAssignments(x => x.filter(r => r.id !== a.id))}
                          className="text-red-400 hover:text-red-600 transition-colors">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredAssignments.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No staff assigned for this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          CELL ASSIGNMENT MODAL
      ══════════════════════════════════════════════════════════ */}
      {cellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setCellModal(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Assign Shift</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {employees.find(e => e.id === cellModal.empId)?.name}
                  {' · '}
                  {format(new Date(cellModal.dateStr + 'T12:00:00'), 'EEE d MMM')}
                </p>
              </div>
              <button onClick={() => setCellModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {shifts.map(shift => {
                const Icon       = SHIFT_ICON[shift.name] ?? Clock
                const isSelected = currentRota[cellModal.dateStr]?.[cellModal.empId] === shift.id
                return (
                  <button key={shift.id}
                    onClick={() => assignCell(cellModal.dateStr, cellModal.empId, isSelected ? null : shift.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    )}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${shift.color}20` }}>
                      <Icon size={16} style={{ color: shift.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{shift.project} – {shift.name}</p>
                      <p className="text-xs text-gray-400">{shift.startTime} – {shift.endTime} · {fmtDuration(shift.startTime, shift.endTime)}</p>
                    </div>
                    {isSelected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                  </button>
                )
              })}
            </div>

            {currentRota[cellModal.dateStr]?.[cellModal.empId] && (
              <button onClick={() => assignCell(cellModal.dateStr, cellModal.empId, null)}
                className="w-full mt-3 py-2 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors">
                Remove Shift
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
