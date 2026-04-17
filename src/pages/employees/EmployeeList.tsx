import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, MoreHorizontal, Eye, Pencil, Trash2, Users, Filter, DatabaseZap, ArrowUpDown, Check } from 'lucide-react'
import { useAppSelector } from '../../store'
import { format } from 'date-fns'
import { Avatar } from '../../components/common/Avatar'
import { Badge, statusVariant } from '../../components/common/Badge'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS, DEPARTMENT_COLORS } from '../../utils/constants'
import { useFirebaseEmployees, type FirebaseEmployee } from '../../hooks/useFirebaseEmployees'
import AddEditEmployeeModal from './components/AddEditEmployeeModal'
import DeleteConfirmModal   from './components/DeleteConfirmModal'
import { cn } from '../../utils/cn'
import { seedEmployees } from '../../utils/seedEmployees'
import { exportAllEmployees } from '../../utils/exportExcel'

// ── Toast ───────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [onDone])
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white flex items-center gap-2 animate-slide-up',
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    )}>
      {type === 'success' ? '✓' : '✕'} {msg}
    </div>
  )
}

// ── Actions dropdown ────────────────────────────────────────────────────
function ActionsMenu({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(v => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[150px]">
          {[
            { label: 'View Details', icon: Eye,    action: onView,   color: '' },
            { label: 'Edit',         icon: Pencil, action: onEdit,   color: '' },
            { label: 'Delete',       icon: Trash2, action: onDelete, color: 'text-red-500' },
          ].map(({ label, icon: Icon, action, color }) => (
            <button key={label} onClick={() => { action(); setOpen(false) }}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition', color || 'text-gray-700')}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sort options ────────────────────────────────────────────────────────
type SortKey = 'default' | 'gender_az' | 'date_new' | 'date_old' | 'name_az'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default',   label: 'Default (newest added)' },
  { key: 'date_new',  label: 'Join Date — Newest first' },
  { key: 'date_old',  label: 'Join Date — Oldest first' },
  { key: 'gender_az', label: 'Gender' },
  { key: 'name_az',   label: 'Name (A → Z)' },
]

function SortMenu({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const active = SORT_OPTIONS.find(o => o.key === value)!

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition',
          value !== 'default'
            ? 'border-primary text-primary bg-primary/5 font-medium'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        )}>
        <ArrowUpDown size={13} />
        {value === 'default' ? 'Sort by' : active.label}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-20 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[220px]">
          <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sort by</p>
          {SORT_OPTIONS.map(opt => (
            <button key={opt.key}
              onClick={() => { onChange(opt.key); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition text-gray-700">
              {opt.label}
              {value === opt.key && <Check size={13} className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status dot ──────────────────────────────────────────────────────────
const statusDot: Record<string, string> = {
  active: '#22c55e', on_leave: '#3b82f6', suspended: '#f59e0b',
  resigned: '#9ca3af', terminated: '#ef4444',
}

const DEPARTMENTS  = ['All', 'Operations', 'Customer Service', 'Dispatch', 'Admin', 'Management', 'IT']
const EMP_TYPES    = ['All', ...Object.keys(EMPLOYMENT_TYPE_LABELS)]
const STATUS_OPTS  = ['All', ...Object.keys(STATUS_LABELS)]

// ── Main component ──────────────────────────────────────────────────────
export default function EmployeeList() {
  const navigate    = useNavigate()
  const currentUser = useAppSelector(s => s.auth.user)
  const isTeamLead  = currentUser?.role === 'team_lead'
  const { employees, loading, error, addEmployee, updateEmployee, deleteEmployee } = useFirebaseEmployees()

  const [search,    setSearch]    = useState('')
  const [dept,      setDept]      = useState('All')
  const [empType,   setEmpType]   = useState('All')
  const [statusF,   setStatusF]   = useState('All')
  const [sort,      setSort]      = useState<SortKey>('default')

  const [addOpen,   setAddOpen]   = useState(false)
  const [editEmp,   setEditEmp]   = useState<FirebaseEmployee | null>(null)
  const [deleteEmp, setDeleteEmp] = useState<FirebaseEmployee | null>(null)

  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [seeding,  setSeeding]  = useState(false)

  const notify = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const result = await seedEmployees()
      if (result.skipped) notify('Database already has data — seed skipped', 'error')
      else notify(`${result.added} dummy employees added successfully`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      notify(msg, 'error')
    } finally {
      setSeeding(false)
    }
  }

  const filtered = employees
    .filter(e => {
      // Team leads only see their own team members
      if (isTeamLead && e.manager !== currentUser?.name) return false
      const q = search.toLowerCase()
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.jobTitle?.toLowerCase().includes(q)
      const matchDept   = dept === 'All'    || e.department    === dept
      const matchType   = empType === 'All' || e.employmentType === empType
      const matchStatus = statusF === 'All' || e.status         === statusF
      return matchSearch && matchDept && matchType && matchStatus
    })
    .sort((a, b) => {
      if (sort === 'name_az')   return a.name.localeCompare(b.name)
      if (sort === 'gender_az') return (a.gender ?? '').localeCompare(b.gender ?? '') || a.name.localeCompare(b.name)
      if (sort === 'date_new')  return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      if (sort === 'date_old')  return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      return 0 // default: keep Firestore order (newest added)
    })

  const handleAdd = async (data: Omit<FirebaseEmployee, 'id'>) => {
    try { await addEmployee(data); notify('Employee added successfully') }
    catch { notify('Failed to add employee', 'error') }
  }

  const handleEdit = async (data: Omit<FirebaseEmployee, 'id'>) => {
    if (!editEmp) return
    try { await updateEmployee(editEmp.id, data); notify('Employee updated') }
    catch { notify('Failed to update employee', 'error') }
  }

  const handleDelete = async () => {
    if (!deleteEmp) return
    try { await deleteEmployee(deleteEmp.id); notify('Employee deleted'); setDeleteEmp(null) }
    catch { notify('Failed to delete employee', 'error') }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">{isTeamLead ? 'My Team' : 'Employee Directory'}</h2>
          <p className="page-sub">
            {isTeamLead
              ? `${filtered.length} team member${filtered.length !== 1 ? 's' : ''} reporting to you`
              : `${employees.length} employees across ${DEPARTMENTS.length - 1} departments`}
          </p>
        </div>
        {!isTeamLead && (
          <div className="flex gap-2">
            <button
              onClick={handleSeed}
              disabled={seeding}
              title="Seed dummy data (only works on empty database)"
              className="btn-outline text-sm gap-2 disabled:opacity-50">
              <DatabaseZap size={14} /> {seeding ? 'Seeding…' : 'Seed Data'}
            </button>
            <button
              onClick={() => exportAllEmployees(filtered)}
              disabled={filtered.length === 0}
              className="btn-outline text-sm gap-2 disabled:opacity-40">
              <Download size={14} /> Export
            </button>
            <button onClick={() => setAddOpen(true)} className="btn-primary text-sm gap-2">
              <Plus size={14} /> Add Employee
            </button>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ID, email…"
              className="input pl-9 text-sm w-full" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-gray-400" />
            <select value={dept}     onChange={e => setDept(e.target.value)}     className="input w-auto text-sm">{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select>
            <select value={empType}  onChange={e => setEmpType(e.target.value)}  className="input w-auto text-sm">{EMP_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : EMPLOYMENT_TYPE_LABELS[t]}</option>)}</select>
            <select value={statusF}  onChange={e => setStatusF(e.target.value)}  className="input w-auto text-sm">{STATUS_OPTS.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : STATUS_LABELS[s]}</option>)}</select>
            <SortMenu value={sort} onChange={setSort} />
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} results</span>
        </div>
      </div>

      {/* ── List ── */}
      <div className="card overflow-hidden">

        {/* Column headers */}
        <div className="px-6 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center border-b border-gray-100 bg-gray-50/70 sticky top-0 z-10">
          <div className="flex-grow">Employee</div>
          <div className="w-24 shrink-0 hidden sm:block">ID</div>
          <div className="w-32 shrink-0 hidden md:block">Department</div>
          <div className="w-36 shrink-0 hidden lg:block">Designation</div>
          <div className="w-24 shrink-0 hidden lg:block">Type</div>
          <div className="w-24 shrink-0 hidden xl:block">Joined</div>
          <div className="w-24 shrink-0">Status</div>
          <div className="w-10 shrink-0"></div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading employees…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6 text-center text-red-500 text-sm">{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Users size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No employees found</p>
            <p className="text-gray-400 text-sm mt-1">
              {search || dept !== 'All' || empType !== 'All' || statusF !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Add your first employee to get started'}
            </p>
            {!search && dept === 'All' && empType === 'All' && statusF === 'All' && (
              <button onClick={() => setAddOpen(true)} className="btn-primary text-sm mt-4 gap-2">
                <Plus size={14} /> Add Employee
              </button>
            )}
          </div>
        )}

        {/* Rows */}
        {!loading && filtered.map(emp => (
          <div key={emp.id}
            onClick={() => navigate(`/employees/${emp.id}`)}
            className="w-full flex items-center px-6 py-3.5 border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors cursor-pointer text-sm">

            {/* Avatar + name + email */}
            <div className="flex-grow flex items-center gap-3 overflow-hidden min-w-0">
              <div className="relative shrink-0">
                <Avatar name={emp.name} size="sm" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: statusDot[emp.status] ?? '#9ca3af' }}
                />
              </div>
              <div className="overflow-hidden">
                <p className="font-semibold text-secondary truncate">{emp.name}</p>
                <p className="text-xs text-gray-400 truncate">{emp.email}</p>
              </div>
            </div>

            {/* ID */}
            <div className="w-24 shrink-0 hidden sm:block">
              <span className="text-xs font-mono text-gray-500">{emp.employeeId}</span>
            </div>

            {/* Department */}
            <div className="w-32 shrink-0 hidden md:block">
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: DEPARTMENT_COLORS[emp.department] ?? '#9ca3af' }} />
                {emp.department}
              </span>
            </div>

            {/* Designation */}
            <div className="w-36 shrink-0 hidden lg:block">
              <span className="text-xs text-gray-600 truncate block">{emp.jobTitle}</span>
            </div>

            {/* Type */}
            <div className="w-24 shrink-0 hidden lg:block">
              <Badge variant="neutral" size="xs">{EMPLOYMENT_TYPE_LABELS[emp.employmentType] ?? emp.employmentType}</Badge>
            </div>

            {/* Joined */}
            <div className="w-24 shrink-0 hidden xl:block">
              <span className="text-xs text-gray-400">
                {emp.startDate ? format(new Date(emp.startDate), 'MMM yyyy') : '—'}
              </span>
            </div>

            {/* Status */}
            <div className="w-24 shrink-0">
              <Badge variant={statusVariant(emp.status)} size="xs" dot>
                {STATUS_LABELS[emp.status] ?? emp.status}
              </Badge>
            </div>

            {/* Actions */}
            <div className="w-10 shrink-0 flex justify-end">
              {isTeamLead ? (
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/employees/${emp.id}?tab=Timesheet`) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-xs text-primary font-medium"
                  title="View Timesheet">
                  <Eye size={14} />
                </button>
              ) : (
                <ActionsMenu
                  onView={() => navigate(`/employees/${emp.id}`)}
                  onEdit={() => setEditEmp(emp)}
                  onDelete={() => setDeleteEmp(emp)}
                />
              )}
            </div>
          </div>
        ))}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <p className="text-xs text-gray-400">Showing {filtered.length} of {employees.length} employees</p>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {addOpen && (
        <AddEditEmployeeModal onSave={handleAdd} onClose={() => setAddOpen(false)} />
      )}
      {editEmp && (
        <AddEditEmployeeModal employee={editEmp} onSave={handleEdit} onClose={() => setEditEmp(null)} />
      )}
      {deleteEmp && (
        <DeleteConfirmModal
          name={deleteEmp.name}
          onConfirm={handleDelete}
          onClose={() => setDeleteEmp(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
