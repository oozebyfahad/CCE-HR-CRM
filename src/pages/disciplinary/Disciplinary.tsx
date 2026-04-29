import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import {
  Shield, AlertTriangle, Plus, X, Check, Send,
  MoreVertical, CheckCircle, Download, Trash2,
} from 'lucide-react'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useAppSelector } from '../../store'
import { createNotification } from '../../components/common/NotificationBell'
import { cn } from '../../utils/cn'
import * as XLSX from 'xlsx'

// ── Types ─────────────────────────────────────────────────────────────

export interface DisciplinaryCase {
  id: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  department: string
  caseType: 'verbal_warning' | 'written_warning' | 'final_warning' | 'suspension' | 'dismissal'
  date: string
  reason: string
  notes?: string
  issuedBy: string
  status: 'open' | 'resolved' | 'appealed'
  sentToPortal: boolean
  createdAt?: unknown
}

// ── Config ────────────────────────────────────────────────────────────

const CASE_TYPES = [
  { value: 'verbal_warning',  label: 'Verbal Warning'  },
  { value: 'written_warning', label: 'Written Warning' },
  { value: 'final_warning',   label: 'Final Warning'   },
  { value: 'suspension',      label: 'Suspension'      },
  { value: 'dismissal',       label: 'Dismissal'       },
] as const

const TYPE_STYLE: Record<string, string> = {
  verbal_warning:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  written_warning: 'bg-orange-100 text-orange-700 border-orange-200',
  final_warning:   'bg-red-100    text-red-700    border-red-200',
  suspension:      'bg-red-100    text-red-700    border-red-200',
  dismissal:       'bg-gray-900   text-white      border-gray-900',
}

const TYPE_LABEL: Record<string, string> = {
  verbal_warning:  'Verbal Warning',
  written_warning: 'Written Warning',
  final_warning:   'Final Warning',
  suspension:      'Suspension',
  dismissal:       'Dismissal',
}

const STATUS_STYLE: Record<string, string> = {
  open:     'bg-red-50    text-red-600    border-red-200',
  resolved: 'bg-green-50  text-green-700  border-green-200',
  appealed: 'bg-amber-50  text-amber-700  border-amber-200',
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-800 placeholder-gray-400'

// ── Register Case Modal ───────────────────────────────────────────────

function RegisterCaseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { employees }  = useFirebaseEmployees()
  const currentUser    = useAppSelector(s => s.auth.user)
  const active         = employees.filter(e => !e.status || e.status === 'active')

  const today = new Date().toISOString().slice(0, 10)
  const [empId,        setEmpId]        = useState('')
  const [caseType,     setCaseType]     = useState<DisciplinaryCase['caseType']>('verbal_warning')
  const [date,         setDate]         = useState(today)
  const [reason,       setReason]       = useState('')
  const [notes,        setNotes]        = useState('')
  const [sendPortal,   setSendPortal]   = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const emp = active.find(e => e.id === empId)

  const handleSave = async () => {
    if (!emp || !reason.trim()) { setError('Select an employee and enter a reason.'); return }
    setSaving(true)
    setError('')
    try {
      await addDoc(collection(db, 'disciplinary'), {
        employeeId:    emp.id,
        employeeName:  emp.name,
        employeeEmail: emp.email ?? '',
        department:    emp.department ?? '',
        caseType,
        date,
        reason:        reason.trim(),
        notes:         notes.trim() || null,
        issuedBy:      currentUser?.name ?? 'HR',
        status:        'open',
        sentToPortal:  sendPortal,
        createdAt:     serverTimestamp(),
      })
      if (sendPortal && emp.email) {
        await createNotification(
          emp.email,
          'Disciplinary Notice',
          `A ${TYPE_LABEL[caseType]} has been issued against you. Please review the details in your portal.`,
          'discipline',
          '/my-disciplinary',
        )
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save case.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <Shield size={16} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Register Disciplinary Case</p>
              <p className="text-xs text-gray-400 mt-0.5">All records are confidential and audit-logged</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Employee */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Employee *</label>
            <select className={inp} value={empId} onChange={e => setEmpId(e.target.value)}>
              <option value="">Select employee…</option>
              {active.map(e => (
                <option key={e.id} value={e.id}>{e.name} — {e.department ?? 'No dept'}</option>
              ))}
            </select>
          </div>

          {/* Case type + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Case Type *</label>
              <select className={inp} value={caseType} onChange={e => setCaseType(e.target.value as DisciplinaryCase['caseType'])}>
                {CASE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Date *</label>
              <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Reason / Description *</label>
            <textarea
              rows={3}
              className={inp + ' resize-none'}
              placeholder="Describe the incident or conduct issue…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Internal Notes <span className="text-gray-300 font-normal normal-case">(optional)</span></label>
            <textarea
              rows={2}
              className={inp + ' resize-none'}
              placeholder="Any additional notes for HR records only…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Send to portal toggle */}
          <label className={cn(
            'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
            sendPortal ? 'border-primary/40 bg-primary/5' : 'border-gray-200 bg-gray-50 hover:bg-gray-100',
          )}>
            <input
              type="checkbox"
              checked={sendPortal}
              onChange={e => setSendPortal(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <div>
              <p className="text-sm font-semibold text-secondary flex items-center gap-1.5">
                <Send size={13} className="text-primary" /> Send to Employee Portal
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                The employee will receive a notification in their portal and can view the case details at <span className="font-mono">/my-disciplinary</span>.
              </p>
            </div>
          </label>

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center shrink-0 bg-gray-50/50">
          <button onClick={onClose} className="btn-outline text-sm px-4">Cancel</button>
          <button onClick={handleSave} disabled={saving || !empId || !reason.trim()}
            className="btn-primary text-sm px-6 disabled:opacity-50 flex items-center gap-2">
            {saving ? 'Saving…' : sendPortal ? <><Send size={13} /> Save & Notify Employee</> : <><Check size={13} /> Save Case</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function Disciplinary() {
  const [cases,        setCases]       = useState<DisciplinaryCase[]>([])
  const [loading,      setLoading]     = useState(true)
  const [showForm,     setShowForm]    = useState(false)
  const [actionId,     setActionId]    = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DisciplinaryCase | null>(null)
  const [deleteStep,   setDeleteStep]  = useState(1)

  useEffect(() => {
    const q = query(collection(db, 'disciplinary'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setCases(snap.docs.map(d => ({ id: d.id, ...d.data() } as DisciplinaryCase)))
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const sendToPortal = async (c: DisciplinaryCase) => {
    await updateDoc(doc(db, 'disciplinary', c.id), { sentToPortal: true })
    if (c.employeeEmail) {
      await createNotification(
        c.employeeEmail,
        'Disciplinary Notice',
        `A ${TYPE_LABEL[c.caseType]} has been issued against you. Please review in your portal.`,
        'discipline',
        '/my-disciplinary',
      )
    }
    setActionId(null)
  }

  const resolve = async (id: string) => {
    await updateDoc(doc(db, 'disciplinary', id), { status: 'resolved' })
    setActionId(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    await deleteDoc(doc(db, 'disciplinary', deleteTarget.id))
    setDeleteTarget(null)
    setDeleteStep(1)
  }

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Employee','Department','Case Type','Date','Reason','Notes','Issued By','Status','Sent to Portal'],
      ...cases.map(c => [
        c.employeeName, c.department, TYPE_LABEL[c.caseType],
        c.date, c.reason, c.notes ?? '',
        c.issuedBy, c.status, c.sentToPortal ? 'Yes' : 'No',
      ]),
    ])
    ws['!cols'] = [28,18,18,12,36,24,16,12,14].map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, 'Disciplinary')
    XLSX.writeFile(wb, `CCE_Disciplinary_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const thisMonth = new Date().toISOString().slice(0, 7)
  const stats = [
    { label: 'Open Cases',    value: cases.filter(c => c.status === 'open').length,     color: '#EF4444' },
    { label: 'Resolved',      value: cases.filter(c => c.status === 'resolved').length, color: '#10B981' },
    { label: 'Under Appeal',  value: cases.filter(c => c.status === 'appealed').length, color: '#F59E0B' },
    { label: 'This Month',    value: cases.filter(c => c.date?.startsWith(thisMonth)).length, color: '#2E86C1' },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Disciplinary</h2>
          <p className="page-sub">
            {loading ? 'Loading…' : `${cases.filter(c => c.status === 'open').length} open case${cases.filter(c => c.status === 'open').length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          {cases.length > 0 && (
            <button onClick={exportExcel} className="btn-outline text-xs px-3 flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
              <Download size={13} /> Export
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} /> Register Case
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Confidentiality notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          All disciplinary records are confidential and access-restricted. Records are retained for 7 years.
          Sending a case to the employee portal notifies them via their notification bell.
        </p>
      </div>

      {/* Case register */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-secondary">Case Register</p>
          <p className="text-xs text-gray-400">{cases.length} total record{cases.length !== 1 ? 's' : ''}</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Shield size={40} className="text-gray-200 mx-auto" />
            <p className="text-sm font-semibold text-gray-400">No disciplinary cases on record</p>
            <p className="text-xs text-gray-400">Use <span className="font-semibold">Register Case</span> to log an incident.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm mx-auto flex items-center gap-2 mt-2">
              <Plus size={14} /> Register First Case
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Employee','Dept','Case Type','Date','Reason','Issued By','Status','Portal',''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cases.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-secondary">{c.employeeName}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.department || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', TYPE_STYLE[c.caseType])}>
                        {TYPE_LABEL[c.caseType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {c.date ? new Date(c.date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[220px]">
                      <p className="truncate" title={c.reason}>{c.reason}</p>
                      {c.notes && <p className="text-[10px] text-gray-400 mt-0.5 truncate italic" title={c.notes}>{c.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{c.issuedBy}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize', STATUS_STYLE[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.sentToPortal ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                          <CheckCircle size={11} /> Sent
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">Not sent</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() => setActionId(actionId === c.id ? null : c.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
                          <MoreVertical size={13} />
                        </button>
                        {actionId === c.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-100 rounded-xl shadow-xl w-44 py-1">
                            {!c.sentToPortal && (
                              <button onClick={() => sendToPortal(c)}
                                className="w-full text-left px-4 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                                <Send size={11} /> Send to Portal
                              </button>
                            )}
                            {c.status === 'open' && (
                              <button onClick={() => resolve(c.id)}
                                className="w-full text-left px-4 py-2 text-xs text-green-600 hover:bg-green-50 flex items-center gap-2">
                                <CheckCircle size={11} /> Mark Resolved
                              </button>
                            )}
                            <button onClick={() => { setDeleteTarget(c); setDeleteStep(1); setActionId(null) }}
                              className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 size={11} /> Delete Case
                            </button>
                            <button onClick={() => setActionId(null)}
                              className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 flex items-center gap-2">
                              <X size={11} /> Close
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Close dropdown on outside click */}
      {actionId && (
        <div className="fixed inset-0 z-10" onClick={() => setActionId(null)} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-red-600" />
              </div>
              {deleteStep === 1 ? (
                <>
                  <p className="text-sm font-bold text-secondary">Delete Disciplinary Case?</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    This will permanently remove the <span className="font-semibold">{TYPE_LABEL[deleteTarget.caseType]}</span> issued to <span className="font-semibold">{deleteTarget.employeeName}</span> and it will no longer be visible in their portal.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-red-600">Final Confirmation</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Are you absolutely sure? This cannot be undone.
                  </p>
                </>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteStep(1) }}
                className="flex-1 btn-outline text-sm py-2"
              >
                Cancel
              </button>
              {deleteStep === 1 ? (
                <button
                  onClick={() => setDeleteStep(2)}
                  className="flex-1 py-2 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  Delete
                </button>
              ) : (
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2 text-sm font-semibold rounded-xl bg-red-700 hover:bg-red-800 text-white transition-colors"
                >
                  Yes, Delete Permanently
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <RegisterCaseModal
          onClose={() => setShowForm(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
