import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, MoreHorizontal, Eye, Pencil, Trash2, Users, Filter, DatabaseZap, ArrowUpDown, Check, FileUp, RefreshCw, X, AlertCircle, UserCheck, KeyRound, ShieldCheck } from 'lucide-react'
import { fetchRotaUsers, fetchRotaRoles, rotaUserName, type RotaUser, type RotaRole } from '../../services/rotacloud'
import { useAppSelector } from '../../store'
import { format, isValid } from 'date-fns'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, authSecondary, db } from '../../config/firebase'
import { useFirebaseUsers, type FirebaseUser } from '../../hooks/useFirebaseUsers'
import type { UserRole } from '../../types'

function safeFormatDate(d?: string): string {
  if (!d) return '—'
  const parsed = new Date(d)
  return isValid(parsed) ? format(parsed, 'MMM yyyy') : '—'
}
import { Avatar } from '../../components/common/Avatar'
import { Badge, statusVariant } from '../../components/common/Badge'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS, DEPARTMENT_COLORS, DEPARTMENTS as DEPARTMENTS_LIST } from '../../utils/constants'
import { useFirebaseEmployees, type FirebaseEmployee } from '../../hooks/useFirebaseEmployees'
import AddEditEmployeeModal    from './components/AddEditEmployeeModal'
import DeleteConfirmModal      from './components/DeleteConfirmModal'
import ImportEmployeeModal     from './components/ImportEmployeeModal'
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

// ── Role change modal (inline) ──────────────────────────────────────────
const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'admin',     label: 'Admin',     color: 'text-red-600 bg-red-50 border-red-200'       },
  { value: 'hr',        label: 'HR',        color: 'text-blue-600 bg-blue-50 border-blue-200'    },
  { value: 'team_lead', label: 'Team Lead', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { value: 'employee',  label: 'Employee',  color: 'text-green-600 bg-green-50 border-green-200' },
]

function ChangeRoleModal({ userName, currentRole, onSave, onClose }: {
  userName: string; currentRole: UserRole
  onSave: (r: UserRole) => Promise<void>; onClose: () => void
}) {
  const [role, setRole] = useState<UserRole>(currentRole)
  const [saving, setSaving] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-bold text-gray-800">Change Portal Role</p>
            <p className="text-xs text-gray-400 mt-0.5">{userName}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-500" /></button>
        </div>
        <div className="space-y-2 mb-5">
          {ROLE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setRole(opt.value)}
              className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition',
                role === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
              <span>{opt.label}</span>
              {role === opt.value && <Check size={14} className="text-primary" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button disabled={saving || role === currentRole} onClick={async () => { setSaving(true); await onSave(role); onClose() }}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bulk create portal accounts modal ──────────────────────────────────
function CreatePortalAccountsModal({ employees, existingUsers, onClose, onDone }: {
  employees: import('../../hooks/useFirebaseEmployees').FirebaseEmployee[]
  existingUsers: FirebaseUser[]
  onClose: () => void
  onDone: (count: number) => void
}) {
  const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase().trim()))
  const toCreate = employees.filter(e => e.email && !existingEmails.has(e.email.toLowerCase().trim()))

  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{ name: string; email: string; ok: boolean; reason?: string }[]>([])

  const run = async () => {
    setStatus('running')
    const out: typeof results = []
    for (let i = 0; i < toCreate.length; i++) {
      const emp = toCreate[i]
      try {
        const { user } = await createUserWithEmailAndPassword(authSecondary, emp.email!, '123456')
        await authSecondary.signOut()
        await setDoc(doc(db, 'users', user.uid), {
          name:        emp.name,
          email:       emp.email!.toLowerCase().trim(),
          role:        'employee' as UserRole,
          designation: emp.jobTitle  ?? '',
          department:  emp.department ?? '',
        })
        out.push({ name: emp.name, email: emp.email!, ok: true })
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? ''
        const reason = code === 'auth/email-already-in-use' ? 'Email already registered' : 'Failed'
        out.push({ name: emp.name, email: emp.email!, ok: false, reason })
      }
      setProgress(i + 1)
      setResults([...out])
    }
    setStatus('done')
    onDone(out.filter(r => r.ok).length)
  }

  const pct = toCreate.length ? Math.round((progress / toCreate.length) * 100) : 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <UserCheck size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Create Portal Accounts</p>
              <p className="text-xs text-gray-400">{toCreate.length} employees without accounts · password: 123456</p>
            </div>
          </div>
          {status !== 'running' && (
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"><X size={15} className="text-gray-500" /></button>
          )}
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {toCreate.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck size={32} className="mx-auto text-green-400 mb-3" />
              <p className="text-sm font-semibold text-gray-600">All employees already have portal accounts.</p>
            </div>
          ) : status === 'idle' ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                <strong>{toCreate.length} accounts</strong> will be created with role <strong>Employee</strong> and default password <strong>123456</strong>. You can change roles individually after.
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {toCreate.map(e => (
                  <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 text-xs">
                    <span className="font-medium text-gray-700 truncate flex-1">{e.name}</span>
                    <span className="text-gray-400 truncate max-w-[180px]">{e.email}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {status === 'running' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Creating accounts…</span>
                    <span>{progress} / {toCreate.length}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
              <div className="space-y-1 max-h-[260px] overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', r.ok ? 'bg-green-50' : 'bg-red-50')}>
                    <span className={r.ok ? 'text-green-600' : 'text-red-500'}>{r.ok ? '✓' : '✕'}</span>
                    <span className="font-medium truncate flex-1">{r.name}</span>
                    <span className={cn('truncate max-w-[180px]', r.ok ? 'text-gray-400' : 'text-red-400')}>{r.ok ? r.email : r.reason}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <button onClick={onClose} disabled={status === 'running'} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-40">
            {status === 'done' ? 'Close' : 'Cancel'}
          </button>
          {status === 'idle' && toCreate.length > 0 && (
            <button onClick={run} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold transition hover:bg-primary/90 flex items-center justify-center gap-1.5">
              <UserCheck size={14} /> Create {toCreate.length} Accounts
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Actions dropdown ────────────────────────────────────────────────────
interface ActionsMenuProps {
  onView: () => void; onEdit: () => void; onDelete: () => void
  portalUser?: FirebaseUser | null
  onChangeRole?: () => void
  onResetPassword?: () => void
}
function ActionsMenu({ onView, onEdit, onDelete, portalUser, onChangeRole, onResetPassword }: ActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { label: 'View Details',    icon: Eye,       action: onView,           color: '' },
    { label: 'Edit',            icon: Pencil,    action: onEdit,           color: '' },
    ...(portalUser && onChangeRole    ? [{ label: 'Change Portal Role', icon: ShieldCheck, action: onChangeRole,    color: 'text-purple-600' }] : []),
    ...(portalUser && onResetPassword ? [{ label: 'Send Password Reset', icon: KeyRound,  action: onResetPassword, color: 'text-amber-600' }] : []),
    { label: 'Delete',          icon: Trash2,    action: onDelete,         color: 'text-red-500' },
  ]

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(v => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-20 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[175px]">
          {portalUser && (
            <div className="px-3 pt-2 pb-1.5 border-b border-gray-50 mb-1">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Portal Account</p>
              <p className="text-[10px] font-semibold text-primary capitalize">{portalUser.role.replace('_', ' ')}</p>
            </div>
          )}
          {items.map(({ label, icon: Icon, action, color }) => (
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

// ── RotaCloud Import Modal ──────────────────────────────────────────────
function RotacloudImportModal({
  existing,
  onImport,
  onClose,
}: {
  existing: FirebaseEmployee[]
  onImport: (emps: Omit<FirebaseEmployee, 'id'>[]) => Promise<void>
  onClose: () => void
}) {
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [rotaUsers, setRotaUsers] = useState<RotaUser[]>([])
  const [roleMap,   setRoleMap]   = useState<Record<number, string>>({})
  const [selected,  setSelected]  = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const [users, roles] = await Promise.all([fetchRotaUsers(), fetchRotaRoles()])

        // Build role ID → name map
        const rm: Record<number, string> = {}
        ;(roles as RotaRole[]).forEach(r => { rm[r.id] = r.name })
        setRoleMap(rm)

        // Filter out employees already in Firestore (by email or rotacloudId)
        const existingEmails  = new Set(existing.map(e => e.email?.toLowerCase().trim()).filter(Boolean))
        const existingRotaIds = new Set(existing.map(e => e.rotacloudId).filter(Boolean))

        const newUsers = (users as RotaUser[]).filter(u =>
          !u.deleted &&
          !existingRotaIds.has(u.id) &&
          !(u.email && existingEmails.has(u.email.toLowerCase().trim()))
        )

        setRotaUsers(newUsers)
        // Select all by default
        setSelected(new Set(newUsers.map(u => u.id)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch from RotaCloud')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleAll = () =>
    setSelected(s => s.size === rotaUsers.length ? new Set() : new Set(rotaUsers.map(u => u.id)))

  const toggle = (id: number) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const mapEmploymentType = (v?: string | null): string => {
    if (!v) return 'full_time'
    const l = v.toLowerCase()
    if (l.includes('part')) return 'part_time'
    if (l.includes('contract')) return 'contract'
    return 'full_time'
  }

  const handleImport = async () => {
    setImporting(true)
    const toAdd = rotaUsers
      .filter(u => selected.has(u.id))
      .map(u => ({
        name:           rotaUserName(u),
        email:          u.email ?? '',
        phone:          u.phone ?? '',
        employeeId:     `RC-${u.id}`,
        jobTitle:       u.default_role ? (roleMap[u.default_role] ?? 'Staff') : 'Staff',
        department:     '',
        employmentType: mapEmploymentType(u.employment_type),
        payType:        (u.salary_type === 'salaried' ? 'fixed_monthly' : 'hourly') as 'hourly' | 'fixed_monthly',
        status:         'active',
        startDate:      u.start_date ?? '',
        rotacloudId:    u.id,
        gender:         u.gender ?? undefined,
        dob:            u.dob    ?? undefined,
        currentAddress: u.address_1 ?? undefined,
        currentCity:    u.city      ?? undefined,
        emergencyContactName:     u.emergency_contact_name         ?? undefined,
        emergencyContactPhone:    u.emergency_contact_phone        ?? undefined,
        emergencyContactRelation: u.emergency_contact_relationship ?? undefined,
      } as Omit<FirebaseEmployee, 'id'>))
    await onImport(toAdd)
  }

  const allChecked = selected.size === rotaUsers.length && rotaUsers.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-secondary">Import from RotaCloud</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? 'Fetching employees…' : `${rotaUsers.length} new employee${rotaUsers.length !== 1 ? 's' : ''} not yet in your directory`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <RefreshCw size={16} className="animate-spin" /> Fetching from RotaCloud…
            </div>
          )}

          {error && (
            <div className="m-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Failed to fetch</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
                <p className="text-xs text-gray-500 mt-1">Make sure <code className="bg-gray-100 px-1 rounded">ROTACLOUD_API_KEY</code> is set in Netlify environment variables.</p>
              </div>
            </div>
          )}

          {!loading && !error && rotaUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Users size={32} strokeWidth={1.2} />
              <p className="text-sm">All RotaCloud employees are already in your directory.</p>
            </div>
          )}

          {!loading && !error && rotaUsers.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer" />
                  </th>
                  {['Name', 'Email', 'Role', 'Pay Type'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rotaUsers.map(u => {
                  const name = rotaUserName(u)
                  const role = u.default_role ? (roleMap[u.default_role] ?? '—') : '—'
                  const payType = u.salary_type === 'salaried' ? 'Fixed Monthly' : 'Hourly'
                  return (
                    <tr key={u.id}
                      onClick={() => toggle(u.id)}
                      className="hover:bg-gray-50/60 cursor-pointer transition">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                            {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-secondary">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[160px]">{u.email}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{role}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          u.salary_type === 'salaried'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        )}>{payType}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && rotaUsers.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400">
              {selected.size} of {rotaUsers.length} selected
            </p>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || selected.size === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition disabled:opacity-50">
                {importing
                  ? <><RefreshCw size={13} className="animate-spin" /> Importing…</>
                  : <><Plus size={13} /> Import {selected.size} Employee{selected.size !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Status dot ──────────────────────────────────────────────────────────
const statusDot: Record<string, string> = {
  active: '#22c55e', on_leave: '#3b82f6', suspended: '#f59e0b',
  resigned: '#9ca3af', terminated: '#ef4444',
}

const DEPARTMENTS  = ['All', ...DEPARTMENTS_LIST]
const EMP_TYPES    = ['All', ...Object.keys(EMPLOYMENT_TYPE_LABELS)]
const STATUS_OPTS  = ['All', ...Object.keys(STATUS_LABELS)]

// ── Main component ──────────────────────────────────────────────────────
export default function EmployeeList() {
  const navigate    = useNavigate()
  const currentUser = useAppSelector(s => s.auth.user)
  const isTeamLead  = currentUser?.role === 'team_lead'
  const isAdmin     = currentUser?.role === 'admin'
  const { employees, loading, error, addEmployee, updateEmployee, deleteEmployee } = useFirebaseEmployees()
  const { users: portalUsers, updateUserRole } = useFirebaseUsers()

  // Build email → portal user lookup
  const userByEmail = new Map<string, FirebaseUser>()
  portalUsers.forEach(u => userByEmail.set(u.email.toLowerCase().trim(), u))

  const [search,    setSearch]    = useState('')
  const [dept,      setDept]      = useState('All')
  const [project,   setProject]   = useState('All')
  const [empType,   setEmpType]   = useState('All')
  const [statusF,   setStatusF]   = useState('All')
  const [sort,      setSort]      = useState<SortKey>('default')

  const [addOpen,         setAddOpen]         = useState(false)
  const [editEmp,         setEditEmp]         = useState<FirebaseEmployee | null>(null)
  const [deleteEmp,       setDeleteEmp]       = useState<FirebaseEmployee | null>(null)
  const [changeRoleEmp,   setChangeRoleEmp]   = useState<{ emp: FirebaseEmployee; user: FirebaseUser } | null>(null)
  const [showPortalModal, setShowPortalModal] = useState(false)
  const [resetSentFor,    setResetSentFor]    = useState<string | null>(null)
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set())
  const [bulkDeleting,    setBulkDeleting]    = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  const [importOpen,       setImportOpen]       = useState(false)
  const [rotaImportOpen,   setRotaImportOpen]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [seeding,  setSeeding]  = useState(false)

  const notify = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
      setResetSentFor(email)
      notify(`Password reset email sent to ${email}`)
      setTimeout(() => setResetSentFor(null), 3000)
    } catch { notify('Failed to send reset email', 'error') }
  }

  const handleImportEmployees = async (employees: Omit<FirebaseEmployee, 'id'>[]) => {
    for (const emp of employees) {
      await addEmployee(emp)
    }
    notify(`${employees.length} employee${employees.length !== 1 ? 's' : ''} imported successfully`)
    setImportOpen(false)
  }

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
      if (isTeamLead && e.department !== currentUser?.department) return false
      const q = search.toLowerCase()
      const matchSearch  = !q || e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.jobTitle?.toLowerCase().includes(q)
      const matchDept    = dept    === 'All' || e.department    === dept
      const matchProject = project === 'All' || (e.project ?? '') === project
      const matchType    = empType === 'All' || e.employmentType === empType
      const matchStatus  = statusF === 'All' || e.status         === statusF
      return matchSearch && matchDept && matchProject && matchType && matchStatus
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

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      for (const id of selectedIds) await deleteEmployee(id)
      notify(`${selectedIds.size} employee${selectedIds.size !== 1 ? 's' : ''} deleted`)
      setSelectedIds(new Set())
      setShowBulkConfirm(false)
    } catch { notify('Failed to delete some employees', 'error') }
    finally { setBulkDeleting(false) }
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(e => e.id)))
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
          <div className="flex gap-2 flex-wrap">
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
            <button onClick={() => setImportOpen(true)} className="btn-outline text-sm gap-2">
              <FileUp size={14} /> Import Excel
            </button>
            <button onClick={() => setRotaImportOpen(true)} className="btn-outline text-sm gap-2">
              <RefreshCw size={14} /> From RotaCloud
            </button>
            {isAdmin && (
              <button onClick={() => setShowPortalModal(true)} className="btn-outline text-sm gap-2 text-primary border-primary/30 hover:bg-primary/5">
                <UserCheck size={14} /> Create Portal Accounts
              </button>
            )}
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
            <select value={project}  onChange={e => setProject(e.target.value)}  className="input w-auto text-sm">
              <option value="All">All Projects</option>
              {[...new Set(employees.map(e => e.project).filter(Boolean))].sort().map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={empType}  onChange={e => setEmpType(e.target.value)}  className="input w-auto text-sm">{EMP_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : EMPLOYMENT_TYPE_LABELS[t]}</option>)}</select>
            <select value={statusF}  onChange={e => setStatusF(e.target.value)}  className="input w-auto text-sm">{STATUS_OPTS.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : STATUS_LABELS[s]}</option>)}</select>
            <SortMenu value={sort} onChange={setSort} />
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} results</span>
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm font-semibold text-red-700">{selectedIds.size} employee{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setShowBulkConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors ml-auto">
            <Trash2 size={13} /> Delete Selected
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-red-400 hover:text-red-600 transition-colors">
            Clear
          </button>
        </div>
      )}

      {/* ── List ── */}
      <div className="card overflow-hidden">

        {/* Column headers */}
        <div className="px-6 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center border-b border-gray-100 bg-gray-50/70 sticky top-0 z-10">
          <div className="w-6 shrink-0 mr-3">
            <input type="checkbox"
              checked={filtered.length > 0 && selectedIds.size === filtered.length}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" />
          </div>
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
            className={cn('w-full flex items-center px-6 py-3.5 border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors cursor-pointer text-sm', selectedIds.has(emp.id) && 'bg-red-50/40')}>

            {/* Checkbox */}
            <div className="w-6 shrink-0 mr-3" onClick={e => toggleSelect(emp.id, e)}>
              <input type="checkbox"
                checked={selectedIds.has(emp.id)}
                onChange={() => {}}
                className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" />
            </div>

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
                  style={{ backgroundColor: DEPARTMENT_COLORS[emp.department ?? ''] ?? '#9ca3af' }} />
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
                {safeFormatDate(emp.startDate)}
              </span>
            </div>

            {/* Status */}
            <div className="w-24 shrink-0">
              <Badge variant={statusVariant(emp.status)} size="xs" dot>
                {STATUS_LABELS[emp.status] ?? emp.status}
              </Badge>
            </div>

            {/* Actions */}
            <div className="w-10 shrink-0 flex justify-end" onClick={e => e.stopPropagation()}>
              {isTeamLead ? (
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/employees/${emp.id}?tab=Timesheet`) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-xs text-primary font-medium"
                  title="View Timesheet">
                  <Eye size={14} />
                </button>
              ) : (() => {
                const portalUser = emp.email ? userByEmail.get(emp.email.toLowerCase().trim()) ?? null : null
                return (
                  <ActionsMenu
                    onView={() => navigate(`/employees/${emp.id}`)}
                    onEdit={() => setEditEmp(emp)}
                    onDelete={() => setDeleteEmp(emp)}
                    portalUser={portalUser}
                    onChangeRole={portalUser ? () => setChangeRoleEmp({ emp, user: portalUser }) : undefined}
                    onResetPassword={portalUser && emp.email ? () => handleResetPassword(emp.email!) : undefined}
                  />
                )
              })()}
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
      {importOpen && (
        <ImportEmployeeModal onImport={handleImportEmployees} onClose={() => setImportOpen(false)} />
      )}
      {rotaImportOpen && (
        <RotacloudImportModal
          existing={employees}
          onImport={async emps => {
            for (const e of emps) await addEmployee(e)
            notify(`${emps.length} employee${emps.length !== 1 ? 's' : ''} imported from RotaCloud`)
            setRotaImportOpen(false)
          }}
          onClose={() => setRotaImportOpen(false)}
        />
      )}
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
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-96 p-6">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete {selectedIds.size} Employee{selectedIds.size !== 1 ? 's' : ''}?</h3>
            <p className="text-sm text-gray-500 mb-6">This will permanently delete {selectedIds.size} employee record{selectedIds.size !== 1 ? 's' : ''}. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {changeRoleEmp && (
        <ChangeRoleModal
          userName={changeRoleEmp.emp.name}
          currentRole={changeRoleEmp.user.role}
          onSave={role => updateUserRole(changeRoleEmp.user.id, role)}
          onClose={() => { setChangeRoleEmp(null); notify('Role updated') }}
        />
      )}

      {showPortalModal && (
        <CreatePortalAccountsModal
          employees={employees.filter(e => e.status === 'active')}
          existingUsers={portalUsers}
          onClose={() => setShowPortalModal(false)}
          onDone={count => { setShowPortalModal(false); notify(`${count} portal account${count !== 1 ? 's' : ''} created`) }}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
