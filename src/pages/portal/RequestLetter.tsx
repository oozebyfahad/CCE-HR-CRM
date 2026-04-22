import { useState, useEffect } from 'react'
import {
  ScrollText, Plus, X, CheckCircle2, Clock, XCircle,
  Briefcase, CreditCard, Globe, FileCheck,
} from 'lucide-react'
import {
  collection, addDoc, query, where, onSnapshot,
  serverTimestamp, orderBy,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { createNotification } from '../../components/common/NotificationBell'

interface LetterRequest {
  id: string
  employeeId: string
  employeeName: string
  letterType: string
  purpose: string
  addressedTo?: string
  status: 'pending' | 'approved' | 'declined'
  submittedAt: { seconds: number } | null
  approvedBy?: string
  letterUrl?: string
}

const LETTER_TYPES = [
  { id: 'experience',     label: 'Experience Letter',       icon: Briefcase,  desc: 'Confirms your employment duration and role',         color: '#2E86C1', bg: '#EBF5FB' },
  { id: 'salary',         label: 'Salary Certificate',      icon: CreditCard, desc: 'Confirms your current salary and benefits',          color: '#10B981', bg: '#E7F9F1' },
  { id: 'noc',            label: 'No Objection Certificate',icon: Globe,      desc: 'Company has no objection to stated purpose',        color: '#8B5CF6', bg: '#F0ECFF' },
  { id: 'employment',     label: 'Employment Verification',  icon: FileCheck,  desc: 'Verifies your current employment status',           color: '#F59E0B', bg: '#FEF8E7' },
]

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', bg: 'bg-amber-100',  text: 'text-amber-700',  icon: Clock        },
  approved: { label: 'Ready',          bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2 },
  declined: { label: 'Declined',       bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle      },
}

const inp = 'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white text-gray-800 transition-all'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'

function fmtDate(ts: { seconds: number } | null) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RequestLetter() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees } = useFirebaseEmployees()
  const myEmployee = employees.find(e => e.email === currentUser?.email)

  const [requests, setRequests] = useState<LetterRequest[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [modal,    setModal]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)
  const [form, setForm] = useState({ purpose: '', addressedTo: '' })

  useEffect(() => {
    if (!myEmployee) return
    const q = query(
      collection(db, 'letter_requests'),
      where('employeeId', '==', myEmployee.id),
      orderBy('submittedAt', 'desc'),
    )
    return onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LetterRequest)))
    })
  }, [myEmployee?.id])

  const openModal = (typeId: string) => {
    setSelected(typeId); setDone(false)
    setForm({ purpose: '', addressedTo: '' }); setModal(true)
  }

  const submit = async () => {
    if (!myEmployee || !selected || !form.purpose) return
    setSaving(true)
    try {
      const letterType = LETTER_TYPES.find(t => t.id === selected)!
      await addDoc(collection(db, 'letter_requests'), {
        employeeId:   myEmployee.id,
        employeeName: myEmployee.name,
        letterType:   letterType.label,
        purpose:      form.purpose,
        addressedTo:  form.addressedTo || null,
        status:       'pending',
        submittedAt:  serverTimestamp(),
      })
      await createNotification(
        currentUser!.email,
        'Letter Request Submitted',
        `Your ${letterType.label} request is being processed. Allow 3–5 business days.`,
        'letter',
        '/request-letter',
      )
      setDone(true)
    } finally { setSaving(false) }
  }

  const selectedType = LETTER_TYPES.find(t => t.id === selected)

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #111828 60%, #0f1a14 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 65%)' }} />
        <div className="absolute bottom-0 left-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.2), transparent 65%)' }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full mb-4">
            <ScrollText size={12} className="text-indigo-400" />
            <span className="text-indigo-300 text-[11px] font-semibold tracking-wide">LETTER REQUESTS</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Request a Letter</h1>
          <p className="text-white/50 text-sm mt-2">Request official company letters for any personal or professional purpose. Ready in 3–5 business days.</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Total Requests', value: String(requests.length) },
              { label: 'Pending',        value: String(requests.filter(r => r.status === 'pending').length) },
              { label: 'Ready',          value: String(requests.filter(r => r.status === 'approved').length) },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Letter type cards */}
      <div>
        <p className="text-sm font-bold text-secondary mb-4">Choose Letter Type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LETTER_TYPES.map(type => {
            const Icon = type.icon
            return (
              <button key={type.id} onClick={() => openModal(type.id)}
                className="card p-5 text-left hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: type.bg, color: type.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-secondary group-hover:text-primary transition-colors">{type.label}</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{type.desc}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-50">
                  <span className="text-[11px] text-gray-400">3–5 business days</span>
                  <span className="text-xs font-bold text-primary group-hover:underline">Request →</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* History */}
      {requests.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-secondary">Request History</p>
          </div>
          <div className="divide-y divide-gray-50">
            {requests.map(r => {
              const cfg = STATUS_CONFIG[r.status]
              const StatusIcon = cfg.icon
              const typeInfo = LETTER_TYPES.find(t => t.label === r.letterType)
              const Icon = typeInfo?.icon ?? ScrollText
              return (
                <div key={r.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: typeInfo?.bg ?? '#F3F4F6', color: typeInfo?.color ?? '#6B7280' }}>
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-secondary">{r.letterType}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{r.purpose}</p>
                    {r.addressedTo && <p className="text-[10px] text-gray-300 mt-0.5">To: {r.addressedTo}</p>}
                    <p className="text-[10px] text-gray-300 mt-1">{fmtDate(r.submittedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === 'approved' && r.letterUrl && (
                      <a href={r.letterUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1">
                        Download
                      </a>
                    )}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                      <StatusIcon size={11} />
                      {cfg.label}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && selectedType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

            <div className="relative px-6 py-5 text-white overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0a0f1a, #111828)' }}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full"
                style={{ background: `radial-gradient(circle, ${selectedType.color}50, transparent 65%)` }} />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: selectedType.bg, color: selectedType.color }}>
                    <selectedType.icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{selectedType.label}</p>
                    <p className="text-[11px] text-white/50">{myEmployee?.name}</p>
                  </div>
                </div>
                <button onClick={() => setModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/60">
                  <X size={16} />
                </button>
              </div>
            </div>

            {done ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <p className="text-base font-bold text-secondary">Request Submitted!</p>
                <p className="text-xs text-gray-400 mt-1.5">Your {selectedType.label} will be ready in 3–5 business days.</p>
                <button onClick={() => setModal(false)} className="mt-5 btn-primary px-8">Done</button>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-5">
                  <div>
                    <label className={lbl}>Purpose / Reason</label>
                    <textarea value={form.purpose}
                      onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                      rows={3} placeholder="e.g. Required for visa application, bank loan…"
                      className={`${inp} resize-none`} />
                  </div>
                  <div>
                    <label className={lbl}>Addressed To <span className="text-gray-300 normal-case font-normal">(optional)</span></label>
                    <input value={form.addressedTo}
                      onChange={e => setForm(f => ({ ...f, addressedTo: e.target.value }))}
                      className={inp} placeholder="e.g. Embassy of UAE, HBL Bank…" />
                  </div>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                  <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={submit} disabled={saving || !form.purpose}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${selectedType.color}, ${selectedType.color}cc)` }}>
                    {saving ? 'Submitting…' : 'Submit Request'}
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
