import { useState, useMemo } from 'react'
import { Plus, Sun, Sunset, Moon, RotateCcw, Users, Clock, Edit2, Trash2, X } from 'lucide-react'
import type { Shift, ShiftAssignment } from '../../types'
import { cn } from '../../utils/cn'

// ── Static default shifts for CCE dispatch operations ─────────────────
const DEFAULT_SHIFTS: Shift[] = [
  { id: 's1', name: 'Morning',   startTime: '08:00', endTime: '16:00', project: 'CCE', days: ['Mon','Tue','Wed','Thu','Fri','Sat'], color: '#F59E0B' },
  { id: 's2', name: 'Afternoon', startTime: '14:00', endTime: '22:00', project: 'CCE', days: ['Mon','Tue','Wed','Thu','Fri','Sat'], color: '#2E86C1' },
  { id: 's3', name: 'Night',     startTime: '22:00', endTime: '06:00', project: 'CCE', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], color: '#8B5CF6' },
  { id: 's4', name: 'Morning',   startTime: '08:00', endTime: '16:00', project: 'VGT', days: ['Mon','Tue','Wed','Thu','Fri','Sat'], color: '#10B981' },
  { id: 's5', name: 'Night',     startTime: '20:00', endTime: '06:00', project: 'VGT', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], color: '#EC4899' },
  { id: 's6', name: 'Morning',   startTime: '08:00', endTime: '16:00', project: 'ADT', days: ['Mon','Tue','Wed','Thu','Fri','Sat'], color: '#F97316' },
  { id: 's7', name: 'Morning',   startTime: '08:00', endTime: '16:00', project: '1AB', days: ['Mon','Tue','Wed','Thu','Fri','Sat'], color: '#14B8A6' },
]

const PROJECTS = ['All', 'CCE', 'VGT', 'ADT', '1AB', 'A1 Ace Taxis']
const DAYS_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const SHIFT_ICON: Record<string, React.ElementType> = {
  Morning:   Sun,
  Afternoon: Sunset,
  Night:     Moon,
  Rotating:  RotateCcw,
}

// Sample assignments – in production these come from Firestore
const SAMPLE_ASSIGNMENTS: ShiftAssignment[] = [
  { id: 'a1', employeeId: 'CCE-1004', employeeName: 'Afaq Kiyani',          jobTitle: 'Senior Dispatcher', shiftId: 's1', shiftName: 'Morning',   project: 'ADT', startDate: '2024-01-01', isActive: true },
  { id: 'a2', employeeId: 'CCE-1008', employeeName: 'Syed Hasnain Ali Kazmi', jobTitle: 'Dispatcher',       shiftId: 's5', shiftName: 'Night',     project: 'VGT', startDate: '2024-01-01', isActive: true },
  { id: 'a3', employeeId: 'CCE-1010', employeeName: 'Muhammad Talha Imran Baig', jobTitle: 'Dispatcher',   shiftId: 's5', shiftName: 'Night',     project: 'VGT', startDate: '2024-01-01', isActive: true },
  { id: 'a4', employeeId: 'CCE-1012', employeeName: 'Hammad Javed',          jobTitle: 'Dispatcher',       shiftId: 's4', shiftName: 'Morning',   project: 'VGT', startDate: '2024-01-01', isActive: true },
  { id: 'a5', employeeId: 'CCE-1023', employeeName: 'Zaeem Shahid',          jobTitle: 'Dispatcher',       shiftId: 's5', shiftName: 'Night',     project: 'VGT', startDate: '2024-01-01', isActive: true },
  { id: 'a6', employeeId: 'CCE-1001', employeeName: 'Basit Mustafa Jilani',  jobTitle: 'Operations Manager', shiftId: 's1', shiftName: 'Morning', project: 'CCE', startDate: '2018-11-16', isActive: true },
  { id: 'a7', employeeId: 'CCE-1019', employeeName: 'Yousaf Hassan',         jobTitle: 'Dispatcher',       shiftId: 's1', shiftName: 'Morning',   project: 'A1 Ace Taxis', startDate: '2022-09-07', isActive: true },
]

function shiftDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`
}

export default function Shifts() {
  const [shifts, setShifts]           = useState<Shift[]>(DEFAULT_SHIFTS)
  const [assignments, setAssignments] = useState<ShiftAssignment[]>(SAMPLE_ASSIGNMENTS)
  const [projectFilter, setProjectFilter] = useState('All')
  const [view, setView]               = useState<'shifts' | 'roster'>('shifts')
  const [showForm, setShowForm]       = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)

  const [form, setForm] = useState({ name: '', startTime: '', endTime: '', project: 'CCE', days: [] as string[] })
  const [assignForm, setAssignForm] = useState({ employeeId: '', employeeName: '', jobTitle: '', shiftId: '', startDate: '' })

  const filteredShifts = useMemo(() =>
    projectFilter === 'All' ? shifts : shifts.filter(s => s.project === projectFilter),
    [shifts, projectFilter]
  )

  const filteredAssignments = useMemo(() =>
    projectFilter === 'All' ? assignments : assignments.filter(a => a.project === projectFilter),
    [assignments, projectFilter]
  )

  function toggleDay(day: string) {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }))
  }

  function saveShift() {
    if (!form.name || !form.startTime || !form.endTime) return
    if (editingShift) {
      setShifts(s => s.map(x => x.id === editingShift.id ? { ...editingShift, ...form } : x))
      setEditingShift(null)
    } else {
      const colors = ['#2E86C1','#10B981','#F59E0B','#8B5CF6','#EC4899','#F97316','#14B8A6']
      setShifts(s => [...s, { id: `s${Date.now()}`, ...form, color: colors[s.length % colors.length] }])
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
    setAssignments(a => [...a, {
      id: `a${Date.now()}`,
      ...assignForm,
      shiftName: shift?.name ?? '',
      project: shift?.project ?? '',
      isActive: true,
    }])
    setAssignForm({ employeeId: '', employeeName: '', jobTitle: '', shiftId: '', startDate: '' })
    setShowAssignForm(false)
  }

  function removeAssignment(id: string) {
    setAssignments(a => a.filter(x => x.id !== id))
  }

  function startEdit(shift: Shift) {
    setEditingShift(shift)
    setForm({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime, project: shift.project, days: [...shift.days] })
    setShowForm(true)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define shifts and assign dispatch staff across projects</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingShift(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
            <Plus size={16} /> New Shift
          </button>
          <button onClick={() => setShowAssignForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            <Users size={16} /> Assign Employee
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Shifts',      value: shifts.length },
          { label: 'Active Assignments',value: assignments.filter(a => a.isActive).length },
          { label: 'Projects Covered',  value: [...new Set(shifts.map(s => s.project))].length },
          { label: 'Night Shift Staff', value: assignments.filter(a => a.shiftName === 'Night' && a.isActive).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters + View toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['shifts', 'roster'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all',
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {v === 'shifts' ? 'Shift Definitions' : 'Staff Roster'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {PROJECTS.map(p => (
            <button key={p} onClick={() => setProjectFilter(p)}
              className={cn('px-3 py-1.5 text-xs rounded-lg font-medium border transition-all',
                projectFilter === p ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
              {p}
            </button>
          ))}
        </div>
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
              <select className={inputCls} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}>
                <option value="">Select...</option>
                {['Morning','Afternoon','Evening','Night','Rotating'].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start Time</label>
              <input type="time" className={inputCls} value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">End Time</label>
              <input type="time" className={inputCls} value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Project</label>
              <select className={inputCls} value={form.project} onChange={e => setForm(f => ({...f, project: e.target.value}))}>
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
                    form.days.includes(day) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                  {day}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveShift} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
              {editingShift ? 'Update' : 'Create'} Shift
            </button>
            <button onClick={() => { setShowForm(false); setEditingShift(null) }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Assign form */}
      {showAssignForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Assign Employee to Shift</h3>
            <button onClick={() => setShowAssignForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Employee ID (e.g. CCE-1004)" value={assignForm.employeeId} onChange={e => setAssignForm(f => ({...f, employeeId: e.target.value}))} />
            <input className={inputCls} placeholder="Employee Name" value={assignForm.employeeName} onChange={e => setAssignForm(f => ({...f, employeeName: e.target.value}))} />
            <input className={inputCls} placeholder="Job Title" value={assignForm.jobTitle} onChange={e => setAssignForm(f => ({...f, jobTitle: e.target.value}))} />
            <select className={inputCls} value={assignForm.shiftId} onChange={e => setAssignForm(f => ({...f, shiftId: e.target.value}))}>
              <option value="">Select Shift...</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.project} – {s.name} ({s.startTime}–{s.endTime})</option>)}
            </select>
            <input type="date" className={inputCls} value={assignForm.startDate} onChange={e => setAssignForm(f => ({...f, startDate: e.target.value}))} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveAssignment} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Assign</button>
            <button onClick={() => setShowAssignForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'shifts' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShifts.map(shift => {
            const Icon = SHIFT_ICON[shift.name] ?? Clock
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
                    <span className="font-medium text-gray-900">{shift.startTime} – {shift.endTime} ({shiftDuration(shift.startTime, shift.endTime)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Days</span>
                    <div className="flex gap-1">
                      {DAYS_ORDER.map(d => (
                        <span key={d} className={cn('text-[10px] px-1 rounded', shift.days.includes(d) ? 'bg-gray-800 text-white' : 'text-gray-300')}>{d[0]}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-50">
                    <span>Assigned Staff</span>
                    <span className="font-semibold" style={{ color: shift.color }}>{assignedCount}</span>
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
      ) : (
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
                      <button onClick={() => removeAssignment(a.id)} className="text-red-400 hover:text-red-600 transition-colors"><X size={14} /></button>
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
      )}
    </div>
  )
}
