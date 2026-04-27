import { useState } from 'react'
import { Save, Shield, Bell, Palette, Globe, Database, Users, Pencil, X, Send, Check, UserPlus, Eye, EyeOff, Building2, Link, RefreshCw, CheckCircle2, AlertCircle, Unlink, Trash2, Plus } from 'lucide-react'
import { doc, setDoc, writeBatch } from 'firebase/firestore'
import { fetchRotaUsers, rotaUserName, type RotaUser } from '../../services/rotacloud'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useFirebaseOrgs } from '../../hooks/useFirebaseOrgs'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth, authSecondary, db } from '../../config/firebase'
import { useAppSelector, useAppDispatch } from '../../store'
import { setCurrentOrg, type Org } from '../../store/slices/orgSlice'
import { useFirebaseUsers, type FirebaseUser } from '../../hooks/useFirebaseUsers'
import { cn } from '../../utils/cn'
import type { UserRole } from '../../types'
import AddEditEmployeeModal from '../employees/components/AddEditEmployeeModal'
import type { FirebaseEmployee } from '../../hooks/useFirebaseEmployees'
import { addStaffByRole, roleToCollection, COLLECTION_LABELS } from '../../hooks/useFirebaseStaff'

const TABS = [
  { key: 'general',       label: 'General',        Icon: Globe     },
  { key: 'security',      label: 'Security',        Icon: Shield    },
  { key: 'notifications', label: 'Notifications',   Icon: Bell      },
  { key: 'appearance',    label: 'Appearance',      Icon: Palette   },
  { key: 'data',          label: 'Data & GDPR',     Icon: Database  },
  { key: 'access',        label: 'Access Levels',   Icon: Users     },
  { key: 'integrations',  label: 'Integrations',    Icon: Link      },
]

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'admin',     label: 'Admin',     color: 'text-red-600 bg-red-50'     },
  { value: 'hr',        label: 'HR',        color: 'text-blue-600 bg-blue-50'   },
  { value: 'team_lead', label: 'Team Lead', color: 'text-purple-600 bg-purple-50'},
  { value: 'employee',  label: 'Employee',  color: 'text-green-600 bg-green-50' },
]

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_OPTIONS.find(r => r.value === role)
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', cfg?.color ?? 'text-gray-600 bg-gray-100')}>
      {cfg?.label ?? role}
    </span>
  )
}

// ── Notify modal ────────────────────────────────────────────────────────
function NotifyModal({
  userName, onSend, onClose,
}: { userName: string; onSend: (msg: string) => Promise<void>; onClose: () => void }) {
  const [msg,     setMsg]     = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)

  const handleSend = async () => {
    if (!msg.trim()) return
    setSending(true)
    await onSend(msg.trim())
    setSent(true)
    setSending(false)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Notify {userName}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X size={15} className="text-gray-500" />
          </button>
        </div>
        {sent ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Check size={20} className="text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-700">Notification sent!</p>
          </div>
        ) : (
          <>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              rows={4}
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder={`e.g. "Your role has been upgraded to Team Lead. Please log in using the Team Lead tab."`}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSend} disabled={sending || !msg.trim()}
                className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Send size={13} /> {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Delete user modal ───────────────────────────────────────────────────
function DeleteUserModal({
  user, onConfirm, onClose,
}: { user: FirebaseUser; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [confirm,  setConfirm]  = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState('')
  const match = user.name.trim().toLowerCase()

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch {
      setError('Failed to delete. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <Trash2 size={16} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Delete Account</p>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-red-700">This action cannot be undone.</p>
            <p className="text-xs text-red-600 leading-relaxed">
              <strong>{user.name}</strong>'s app access will be revoked immediately. They will not be able to log in.
            </p>
          </div>

          {/* Confirmation input */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">
              Type <span className="font-bold text-gray-700">{user.name}</span> to confirm
            </label>
            <input
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition"
              placeholder={user.name}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirm.trim().toLowerCase() === match && handleDelete()}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirm.trim().toLowerCase() !== match || deleting}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40 flex items-center justify-center gap-1.5">
            <Trash2 size={13} />
            {deleting ? 'Deleting…' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit role modal ─────────────────────────────────────────────────────
function EditRoleModal({
  userName, currentRole, onSave, onClose,
}: { userName: string; currentRole: UserRole; onSave: (role: UserRole) => Promise<void>; onClose: () => void }) {
  const [role,   setRole]   = useState<UserRole>(currentRole)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(role)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">Edit Role — {userName}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X size={15} className="text-gray-500" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">Select the new role. The user must log in using the matching tab after this change.</p>
        <div className="space-y-2 mb-6">
          {ROLE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setRole(opt.value)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition text-sm font-medium',
                role === opt.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}>
              <span>{opt.label}</span>
              {role === opt.value && <Check size={15} className="text-primary" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving || role === currentRole}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create User modal ───────────────────────────────────────────────────
function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' as UserRole, designation: '', department: '' })
  const [showPw,  setShowPw]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState('')

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      setError('Name, email and a password of at least 6 characters are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      // Create Firebase Auth user via secondary app (keeps admin signed in)
      const { user } = await createUserWithEmailAndPassword(authSecondary, form.email.trim(), form.password)
      // Sign secondary auth out immediately
      await authSecondary.signOut()
      // Write Firestore profile
      await setDoc(doc(db, 'users', user.uid), {
        name:        form.name.trim(),
        email:       form.email.trim().toLowerCase(),
        role:        form.role,
        designation: form.designation.trim(),
        department:  form.department.trim(),
      })
      setSuccess(true)
      setTimeout(onClose, 1400)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/email-already-in-use') setError('That email is already registered.')
      else if (code === 'auth/weak-password')   setError('Password must be at least 6 characters.')
      else setError('Failed to create account. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
              <UserPlus size={16} className="text-primary" />
            </div>
            <h2 className="font-bold text-gray-800">Create New Account</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Check size={22} className="text-green-600" />
            </div>
            <p className="text-sm font-semibold text-green-700">Account created successfully!</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Full Name *</label>
                <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Role *</label>
                <select className={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Email Address *</label>
              <input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@cabcallexperts.com" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Password *</label>
              <div className="relative">
                <input className={cn(inp, 'pr-10')} type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Designation</label>
                <input className={inp} value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Dispatcher" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Department</label>
                <input className={inp} value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Operations" />
              </div>
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                <UserPlus size={14} /> {saving ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Access Levels panel ─────────────────────────────────────────────────
function AccessLevels() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { users, loading, updateUserRole, sendNotification, deleteUserRecord } = useFirebaseUsers()

  const [editTarget,     setEditTarget]     = useState<{ id: string; name: string; role: UserRole } | null>(null)
  const [notifyTarget,   setNotifyTarget]   = useState<{ id: string; name: string } | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<FirebaseUser | null>(null)
  const [showCreate,     setShowCreate]     = useState(false)
  const [resetSent,      setResetSent]      = useState<string | null>(null)
  const [addToCompany,   setAddToCompany]   = useState<FirebaseUser | null>(null)
  const [addSuccess,     setAddSuccess]     = useState<string | null>(null)

  const handleResetPassword = async (email: string, uid: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
      setResetSent(uid)
      setTimeout(() => setResetSent(null), 3000)
    } catch { /* ignore */ }
  }

  const handleAddToCompany = async (data: Omit<FirebaseEmployee, 'id'>) => {
    if (!addToCompany) return
    const col = await addStaffByRole(addToCompany.role, data)
    const label = col ? COLLECTION_LABELS[col] : 'Company'
    setAddSuccess(`${addToCompany.name} added to ${label} records`)
    setAddToCompany(null)
    setTimeout(() => setAddSuccess(null), 4000)
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
          <Shield size={20} className="text-red-400" />
        </div>
        <p className="text-sm font-semibold text-gray-600">Admin access required</p>
        <p className="text-xs text-gray-400">Only admins can manage access levels.</p>
      </div>
    )
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-secondary">Access Levels</h3>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition">
            <UserPlus size={13} /> Create Account
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-5">Manage each user's login role. Changes take effect immediately — the user must log in using the correct tab.</p>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">No users found in database.</div>
        ) : (
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 bg-gray-50 grid grid-cols-[1fr_1fr_120px_180px] gap-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <span>Name</span>
              <span>Designation</span>
              <span>Role</span>
              <span className="text-right">Actions</span>
            </div>
            {/* Rows */}
            {users.map(u => (
              <div key={u.id}
                className="px-4 py-3 grid grid-cols-[1fr_1fr_120px_180px] gap-3 items-center border-t border-gray-50 hover:bg-gray-50/50 transition">
                <div>
                  <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <p className="text-xs text-gray-500 truncate">{u.designation || u.department || '—'}</p>
                <div><RoleBadge role={u.role} /></div>
                <div className="flex items-center gap-1.5 justify-end">
                  {u.id !== currentUser?.id && (
                    <>
                      <button
                        onClick={() => setEditTarget({ id: u.id, name: u.name, role: u.role })}
                        title="Edit role"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 transition text-gray-500">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setNotifyTarget({ id: u.id, name: u.name })}
                        title="Send notification"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-100 transition text-blue-500">
                        <Send size={13} />
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.email, u.id)}
                        title="Send password reset email"
                        className={cn(
                          'w-7 h-7 flex items-center justify-center rounded-lg transition',
                          resetSent === u.id
                            ? 'bg-green-100 text-green-600'
                            : 'hover:bg-amber-100 text-amber-500'
                        )}>
                        {resetSent === u.id ? <Check size={13} /> : <Shield size={13} />}
                      </button>
                      {roleToCollection(u.role) && (
                        <button
                          onClick={() => setAddToCompany(u)}
                          title={`Add to ${COLLECTION_LABELS[roleToCollection(u.role)!]} records`}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-100 transition text-green-600">
                          <Building2 size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Delete account"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 transition text-red-400 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  {u.id === currentUser?.id && (
                    <span className="text-[10px] text-gray-300 font-medium">You</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editTarget && (
        <EditRoleModal
          userName={editTarget.name}
          currentRole={editTarget.role}
          onSave={role => updateUserRole(editTarget.id, role)}
          onClose={() => setEditTarget(null)}
        />
      )}

      {notifyTarget && (
        <NotifyModal
          userName={notifyTarget.name}
          onSend={msg => sendNotification(notifyTarget.id, msg)}
          onClose={() => setNotifyTarget(null)}
        />
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}

      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onConfirm={() => deleteUserRecord(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {addToCompany && roleToCollection(addToCompany.role) && (
        <AddEditEmployeeModal
          employee={{
            id:             '',
            name:           addToCompany.name,
            email:          addToCompany.email,
            phone:          '',
            employeeId:     '',
            jobTitle:       addToCompany.designation ?? '',
            department:     addToCompany.department  ?? '',
            employmentType: 'full_time',
            status:         'active',
            startDate:      '',
          } as FirebaseEmployee}
          tableLabel={COLLECTION_LABELS[roleToCollection(addToCompany.role)!]}
          onSave={handleAddToCompany}
          onClose={() => setAddToCompany(null)}
        />
      )}

      {addSuccess && (
        <div className="fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white bg-green-600 flex items-center gap-2">
          ✓ {addSuccess} added to company records
        </div>
      )}
    </>
  )
}

// ── Organizations panel ─────────────────────────────────────────────────
function OrganizationsPanel() {
  const dispatch   = useAppDispatch()
  const currentOrg = useAppSelector(s => s.org.currentOrg)
  const { orgs, loading, addOrg, updateOrg, deleteOrg } = useFirebaseOrgs()

  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Org | null>(null)
  const [name,      setName]      = useState('')
  const [apiKey,    setApiKey]    = useState('')
  const [showKey,   setShowKey]   = useState(false)
  const [saving,    setSaving]    = useState(false)

  const openAdd = () => {
    setEditing(null); setName(''); setApiKey(''); setShowKey(false); setShowModal(true)
  }

  const openEdit = (org: Org) => {
    setEditing(org); setName(org.name); setApiKey(org.rotaApiKey); setShowKey(false); setShowModal(true)
  }

  const handleSave = async () => {
    if (!name.trim() || !apiKey.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateOrg(editing.id, { name: name.trim(), rotaApiKey: apiKey.trim() })
        if (currentOrg?.id === editing.id) {
          dispatch(setCurrentOrg({ ...editing, name: name.trim(), rotaApiKey: apiKey.trim() }))
        }
      } else {
        await addOrg(name.trim(), apiKey.trim())
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (org: Org) => {
    if (!confirm(`Delete organization "${org.name}"? This cannot be undone.`)) return
    await deleteOrg(org.id)
    if (currentOrg?.id === org.id) dispatch(setCurrentOrg(null))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-secondary">Organizations</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Add additional organizations with their own RotaCloud accounts.
            Switch between them from the top-right menu.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition"
        >
          <Plus size={13} /> Add Organization
        </button>
      </div>

      {/* Default org */}
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-xl border',
        !currentOrg ? 'border-primary/30 bg-primary/5' : 'border-gray-100 bg-gray-50'
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-secondary">CabCall Experts</p>
          <p className="text-[11px] text-gray-400">Default · API key in Vercel environment variables</p>
        </div>
        {!currentOrg
          ? <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-semibold shrink-0">Active</span>
          : <button onClick={() => dispatch(setCurrentOrg(null))} className="text-[10px] text-primary hover:underline font-semibold shrink-0">Switch to this</button>
        }
      </div>

      {/* Additional orgs */}
      {loading ? (
        <div className="text-xs text-gray-400 text-center py-4">Loading…</div>
      ) : orgs.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">No additional organizations yet.</p>
      ) : (
        orgs.map(org => (
          <div key={org.id} className={cn(
            'flex items-center gap-3 p-3 rounded-xl border',
            currentOrg?.id === org.id ? 'border-primary/30 bg-primary/5' : 'border-gray-100 bg-gray-50'
          )}>
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <Building2 size={15} className="text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-secondary">{org.name}</p>
              <p className="text-[11px] text-gray-400 font-mono truncate">
                {'•'.repeat(Math.min(org.rotaApiKey.length, 28))}
              </p>
            </div>
            {currentOrg?.id === org.id
              ? <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-semibold shrink-0">Active</span>
              : <button onClick={() => dispatch(setCurrentOrg(org))} className="text-[10px] text-primary hover:underline font-semibold shrink-0">Switch to this</button>
            }
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => openEdit(org)} className="p-1 rounded hover:bg-gray-200 text-gray-400 transition">
                <Pencil size={12} />
              </button>
              <button onClick={() => handleDelete(org)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-secondary">
                {editing ? 'Edit Organization' : 'Add Organization'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="label">Organization Name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div>
              <label className="label">RotaCloud API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="input pr-9"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="rc_live_…"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Stored in Firestore and accessible only to admins.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !apiKey.trim()}
                className="flex-1 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── RotaCloud Integration panel ─────────────────────────────────────────
interface MatchResult {
  rotaUser: RotaUser
  firestoreId: string | null   // matched Firestore employee ID
  firebaseName: string | null
  method: 'email' | 'none'
}

function RotacloudPanel() {
  const { employees } = useFirebaseEmployees()
  const [status,    setStatus]    = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [syncing,   setSyncing]   = useState(false)
  const [results,   setResults]   = useState<MatchResult[] | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [errorMsg,  setErrorMsg]  = useState('')

  const testConnection = async () => {
    setStatus('testing')
    setErrorMsg('')
    try {
      const users = await fetchRotaUsers()
      setStatus(Array.isArray(users) && users.length > 0 ? 'ok' : 'error')
    } catch (e) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Connection failed')
    }
  }

  const syncEmployees = async () => {
    setSyncing(true)
    setErrorMsg('')
    setSaved(false)
    try {
      const rotaUsers = await fetchRotaUsers()
      const active = rotaUsers.filter(u => !u.deleted)
      const emailToFirestore: Record<string, { id: string; name: string }> = {}
      employees.forEach(e => {
        if (e.email) emailToFirestore[e.email.toLowerCase().trim()] = { id: e.id, name: e.name }
      })

      const matched: MatchResult[] = active.map(ru => {
        const email = ru.email?.toLowerCase().trim() ?? ''
        const match = emailToFirestore[email] ?? null
        return {
          rotaUser:     ru,
          firestoreId:  match?.id   ?? null,
          firebaseName: match?.name ?? null,
          method:       match ? 'email' : 'none',
        }
      })
      // Show unmatched last
      matched.sort((a, b) => (a.firestoreId ? 0 : 1) - (b.firestoreId ? 0 : 1))
      setResults(matched)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const saveLinks = async () => {
    if (!results) return
    setSaving(true)
    try {
      const batch = writeBatch(db)
      results.forEach(r => {
        if (r.firestoreId) {
          batch.update(doc(db, 'employees', r.firestoreId), { rotacloudId: r.rotaUser.id })
        }
      })
      await batch.commit()
      setSaved(true)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const linked   = results?.filter(r => r.firestoreId).length ?? 0
  const unlinked = results?.filter(r => !r.firestoreId).length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-secondary">RotaCloud Integration</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Connect your RotaCloud account to sync attendance, shifts, and employee records.
          The API key is stored in Vercel environment variables — it never reaches the browser.
        </p>
      </div>

      {/* Status banner */}
      <div className={cn(
        'rounded-xl px-4 py-3 flex items-start gap-3 text-sm',
        status === 'ok'      ? 'bg-green-50 border border-green-200'  :
        status === 'error'   ? 'bg-red-50 border border-red-200'      :
        status === 'testing' ? 'bg-blue-50 border border-blue-200'    :
        'bg-gray-50 border border-gray-200'
      )}>
        {status === 'ok'      && <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />}
        {status === 'error'   && <AlertCircle  size={16} className="text-red-500   shrink-0 mt-0.5" />}
        {status === 'testing' && <RefreshCw    size={16} className="text-blue-500  shrink-0 mt-0.5 animate-spin" />}
        {status === 'idle'    && <Link         size={16} className="text-gray-400  shrink-0 mt-0.5" />}
        <div className="flex-1">
          <p className={cn('font-semibold text-xs',
            status === 'ok'    ? 'text-green-700' :
            status === 'error' ? 'text-red-600'   :
            'text-gray-600'
          )}>
            {status === 'ok'      ? 'Connected to RotaCloud' :
             status === 'error'   ? `Connection failed${errorMsg ? ` — ${errorMsg}` : ''}` :
             status === 'testing' ? 'Testing connection…' :
             'Not tested yet'}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Set <code className="bg-gray-100 px-1 rounded">ROTACLOUD_API_KEY</code> in Vercel → Project Settings → Environment Variables, then redeploy.
          </p>
        </div>
        <button
          onClick={testConnection}
          disabled={status === 'testing'}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-white transition disabled:opacity-50 bg-white">
          Test Connection
        </button>
      </div>

      {/* Employee linking */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-secondary">Employee Linking</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Matches RotaCloud employees to your HR records by email so attendance data maps to the correct employee.
            </p>
          </div>
          <button
            onClick={syncEmployees}
            disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition disabled:opacity-50">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Fetching…' : 'Fetch & Match'}
          </button>
        </div>

        {results && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'RotaCloud Staff', val: results.length,        color: 'text-secondary'   },
                { label: 'Linked',          val: linked,                color: 'text-green-600'   },
                { label: 'Unmatched',       val: unlinked,              color: 'text-amber-600'   },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <p className={cn('text-2xl font-bold', s.color)}>{s.val}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Results table */}
            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px]">RotaCloud Name</th>
                    <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px]">Email</th>
                    <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px]">HR Record</th>
                    <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map(r => (
                    <tr key={r.rotaUser.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-2.5 font-medium text-secondary">{rotaUserName(r.rotaUser)}</td>
                      <td className="px-4 py-2.5 text-gray-500 truncate max-w-[180px]">{r.rotaUser.email}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.firebaseName ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5">
                        {r.firestoreId ? (
                          <span className="flex items-center gap-1 text-green-700 font-semibold">
                            <CheckCircle2 size={11} /> Linked
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 font-semibold">
                            <Unlink size={11} /> No match
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Unmatched employees won't have attendance auto-filled in payroll. Ensure emails match in both systems.
              </p>
              <button
                onClick={saveLinks}
                disabled={saving || linked === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50">
                {saved ? <><CheckCircle2 size={13} /> Saved!</> : <><Save size={13} /> Save {linked} Links</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Settings page ──────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState('general')

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="page-header">Settings</h2>
        <p className="page-sub">System configuration and administration</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Sidebar */}
        <div className="card p-2 sm:w-48 shrink-0 h-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                tab === t.key ? 'bg-primary text-white font-medium' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <t.Icon size={15} className="shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 card p-6 space-y-6">

          {tab === 'general' && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-secondary mb-4">Organisation Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['Company Name',    'CabCallExperts'],
                    ['Legal Name',      'CabCallExperts Ltd'],
                    ['Company Website', 'www.cabcallexperts.com'],
                    ['HR Email',        'hr@cabcallexperts.com'],
                    ['Financial Year',  'April – March'],
                    ['Working Hours',   '37.5 hrs/week'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <label className="label">{label}</label>
                      <input className="input text-sm" defaultValue={value} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-secondary mb-4">Leave Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['Annual Leave Entitlement', '28 days'],
                    ['Carry-over Limit',         '5 days'],
                    ['Sick Leave (paid)',         '10 days/year'],
                    ['Notice Period',            '4 weeks'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <label className="label">{label}</label>
                      <input className="input text-sm" defaultValue={value} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-secondary">Security & Authentication</h3>
              {[
                { label: 'Require 2FA for Admins',   desc: 'Admin accounts must use two-factor authentication',  checked: true  },
                { label: 'Session Timeout (30 mins)', desc: 'Auto-logout after 30 minutes of inactivity',         checked: true  },
                { label: 'Password Complexity',       desc: 'Require min 8 chars, upper, lower, number',          checked: true  },
                { label: 'Login Attempt Limit',       desc: 'Lock account after 5 failed attempts',               checked: false },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-secondary">{s.label}</p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${s.checked ? 'bg-primary justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="w-4 h-4 rounded-full bg-white shadow" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-secondary">Notification Preferences</h3>
              {[
                { label: 'Leave request submitted',       checked: true  },
                { label: 'Leave approved / declined',     checked: true  },
                { label: 'Performance review due',        checked: true  },
                { label: 'Contract expiry (30 days)',     checked: true  },
                { label: 'Right-to-work expiry (14 days)',checked: true  },
                { label: 'Probation review due',          checked: true  },
                { label: 'New employee added',            checked: false },
                { label: 'Disciplinary case opened',      checked: true  },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-secondary">{n.label}</p>
                  <div className={`w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${n.checked ? 'bg-primary justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="w-4 h-4 rounded-full bg-white shadow" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'data' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-secondary">Data & GDPR Compliance</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-800 font-medium mb-1">UK GDPR Compliance Active</p>
                <p className="text-xs text-blue-700">All employee data is encrypted at rest and in transit. Audit logs are retained for 7 years per UK employment law.</p>
              </div>
              {[
                { label: 'Data Retention Policy', value: '7 years (UK employment law)' },
                { label: 'Backup Frequency',      value: 'Daily, 30-day retention'     },
                { label: 'Encryption Standard',   value: 'AES-256 at rest · TLS 1.3'  },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-sm font-medium text-secondary">{value}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'appearance' && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
                <Palette size={20} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-secondary">Coming Soon</p>
              <p className="text-xs text-gray-400">Appearance settings are in development.</p>
            </div>
          )}

          {tab === 'access'       && <AccessLevels />}
          {tab === 'integrations' && (
            <div className="space-y-8">
              <OrganizationsPanel />
              <div className="border-t border-gray-100 pt-6">
                <RotacloudPanel />
              </div>
            </div>
          )}

          {tab !== 'access' && tab !== 'integrations' && tab !== 'appearance' && (
            <div className="pt-2 flex justify-end">
              <button className="btn-primary text-sm gap-2"><Save size={14} /> Save Changes</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
