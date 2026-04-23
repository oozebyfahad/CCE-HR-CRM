import { useState, useEffect } from 'react'
import {
  ShieldAlert, Plus, X, CheckCircle2, Clock, Eye,
  AlertTriangle, Lock, MessageSquare,
} from 'lucide-react'
import {
  collection, addDoc, query, where, onSnapshot,
  serverTimestamp, orderBy,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useMyEmployee } from '../../hooks/useMyEmployee'
import { createNotification } from '../../components/common/NotificationBell'

interface GrievanceItem {
  id: string
  employeeId: string
  employeeName: string
  category: string
  subject: string
  description: string
  isAnonymous: boolean
  status: 'submitted' | 'under_review' | 'resolved' | 'closed'
  submittedAt: { seconds: number } | null
  hrNotes?: string
}

const STATUS_CONFIG = {
  submitted:    { label: 'Submitted',    bg: 'bg-blue-100',   text: 'text-blue-700',   icon: Clock         },
  under_review: { label: 'Under Review', bg: 'bg-amber-100',  text: 'text-amber-700',  icon: Eye           },
  resolved:     { label: 'Resolved',     bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2  },
  closed:       { label: 'Closed',       bg: 'bg-gray-100',   text: 'text-gray-600',   icon: X             },
}

const CATEGORIES = [
  'Workplace Harassment',
  'Discrimination',
  'Unfair Treatment',
  'Safety Concern',
  'Policy Violation',
  'Management Conduct',
  'Colleague Conduct',
  'Payroll Issue',
  'Working Conditions',
  'Other',
]

const inp = 'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 bg-white text-gray-800 transition-all'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'

function fmtDate(ts: { seconds: number } | null) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Grievance() {
  const { employee: myEmployee } = useMyEmployee()

  const [grievances, setGrievances] = useState<GrievanceItem[]>([])
  const [modal,      setModal]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [done,       setDone]       = useState(false)
  const [form, setForm] = useState({
    category: '', subject: '', description: '', isAnonymous: false,
  })

  useEffect(() => {
    if (!myEmployee) return
    const q = query(
      collection(db, 'grievances'),
      where('employeeId', '==', myEmployee.id),
      orderBy('submittedAt', 'desc'),
    )
    return onSnapshot(q, snap => {
      setGrievances(snap.docs.map(d => ({ id: d.id, ...d.data() } as GrievanceItem)))
    })
  }, [myEmployee?.id])

  const submit = async () => {
    if (!myEmployee || !form.category || !form.subject || !form.description) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'grievances'), {
        employeeId:   myEmployee.id,
        employeeName: form.isAnonymous ? 'Anonymous' : myEmployee.name,
        category:     form.category,
        subject:      form.subject,
        description:  form.description,
        isAnonymous:  form.isAnonymous,
        status:       'submitted',
        submittedAt:  serverTimestamp(),
      })
      if (!form.isAnonymous) {
        await createNotification(
          myEmployee?.email ?? '',
          'Grievance Submitted',
          'Your grievance has been received. HR will review it confidentially.',
          'grievance',
          '/grievance',
        )
      }
      setDone(true)
      setForm({ category: '', subject: '', description: '', isAnonymous: false })
    } finally { setSaving(false) }
  }

  const openModal = () => { setDone(false); setModal(true) }

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #1a0a14 0%, #1E1018 60%, #0f1629 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.35), transparent 65%)' }} />
        <div className="absolute bottom-0 left-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent 65%)' }} />

        <div className="relative flex items-start justify-between flex-wrap gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 px-3 py-1 rounded-full mb-4">
              <ShieldAlert size={12} className="text-rose-400" />
              <span className="text-rose-300 text-[11px] font-semibold tracking-wide">GRIEVANCE PORTAL</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">File a Grievance</h1>
            <p className="text-white/50 text-sm mt-2 max-w-sm">
              All grievances are handled confidentially. You may submit anonymously.
            </p>
          </div>
          <button onClick={openModal}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-rose-500/20"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #E11D48)' }}>
            <Plus size={16} /> File Grievance
          </button>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Total Filed',    value: String(grievances.length)                                          },
            { label: 'Under Review',   value: String(grievances.filter(g => g.status === 'under_review').length) },
            { label: 'Resolved',       value: String(grievances.filter(g => g.status === 'resolved').length)     },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Confidentiality notice */}
      <div className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-2xl px-5 py-4">
        <Lock size={16} className="text-purple-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-purple-800">Strictly Confidential</p>
          <p className="text-xs text-purple-700 mt-0.5">
            Your grievance is only seen by HR and senior management. Retaliation of any kind is strictly prohibited.
          </p>
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-secondary">My Grievances</p>
          <p className="text-xs text-gray-400 mt-0.5">{grievances.length} total submissions</p>
        </div>

        {grievances.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={24} className="text-rose-300" />
            </div>
            <p className="text-sm font-semibold text-secondary">No grievances filed</p>
            <p className="text-xs text-gray-400 mt-1">Use this channel if you have a workplace concern.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {grievances.map(g => {
              const cfg = STATUS_CONFIG[g.status]
              const StatusIcon = cfg.icon
              return (
                <div key={g.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center shrink-0">
                      {g.isAnonymous
                        ? <Lock size={16} className="text-rose-500" />
                        : <MessageSquare size={16} className="text-rose-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-secondary">{g.subject}</p>
                        {g.isAnonymous && (
                          <span className="text-[9px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">ANONYMOUS</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{g.category}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{g.description}</p>
                      {g.hrNotes && (
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <p className="text-[11px] font-semibold text-blue-700">HR Response</p>
                          <p className="text-[11px] text-blue-600 mt-0.5">{g.hrNotes}</p>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-300 mt-2">{fmtDate(g.submittedAt)}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 ${cfg.bg} ${cfg.text}`}>
                      <StatusIcon size={11} />
                      {cfg.label}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

            <div className="relative px-6 py-5 text-white overflow-hidden shrink-0"
              style={{ background: 'linear-gradient(135deg, #1a0a14, #0f1629)' }}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.4), transparent 65%)' }} />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-rose-500/20 rounded-xl flex items-center justify-center">
                    <ShieldAlert size={16} className="text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">File a Grievance</p>
                    <p className="text-[11px] text-white/50">Strictly confidential</p>
                  </div>
                </div>
                <button onClick={() => setModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/60 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {done ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <p className="text-base font-bold text-secondary">Grievance Submitted</p>
                <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">
                  HR will review your submission confidentially and respond within 5 business days.
                </p>
                <button onClick={() => setModal(false)} className="mt-5 btn-primary px-8">Done</button>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-5 overflow-y-auto flex-1">

                  <label className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer hover:bg-purple-100 transition-colors">
                    <input type="checkbox" checked={form.isAnonymous}
                      onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.checked }))}
                      className="w-4 h-4 accent-purple-600" />
                    <div>
                      <p className="text-sm font-semibold text-purple-800 flex items-center gap-1.5">
                        <Lock size={13} /> Submit Anonymously
                      </p>
                      <p className="text-[11px] text-purple-600 mt-0.5">Your name will not be visible to HR</p>
                    </div>
                  </label>

                  <div>
                    <label className={lbl}>Category</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className={inp}>
                      <option value="">— Select category —</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className={lbl}>Subject</label>
                    <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      className={inp} placeholder="Brief subject line" />
                  </div>

                  <div>
                    <label className={lbl}>Description</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={5} placeholder="Describe the issue in detail — include dates, names (if relevant), and what outcome you seek…"
                      className={`${inp} resize-none`} />
                  </div>

                  <div className="flex items-start gap-2 text-[11px] text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    Filing a false grievance may result in disciplinary action.
                  </div>
                </div>

                <div className="px-6 pb-6 flex gap-3 shrink-0">
                  <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={submit} disabled={saving || !form.category || !form.subject || !form.description}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #F43F5E, #E11D48)' }}>
                    {saving ? 'Submitting…' : 'Submit Grievance'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
