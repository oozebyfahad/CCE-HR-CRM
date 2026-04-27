import { useState, useEffect } from 'react'
import {
  Timer, Plus, X, CheckCircle2, Clock, XCircle, TrendingUp, Zap,
} from 'lucide-react'
import {
  collection, addDoc, query, where, onSnapshot,
  serverTimestamp, orderBy,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAppSelector } from '../../store'
import { useMyEmployee } from '../../hooks/useMyEmployee'
import { useCurrency } from '../../context/CurrencyContext'
import { createNotification } from '../../components/common/NotificationBell'

interface OvertimeRequest {
  id: string
  employeeId: string
  employeeName: string
  date: string
  hours: number
  reason: string
  status: 'pending' | 'approved' | 'declined'
  submittedAt: { seconds: number } | null
  approvedBy?: string
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock        },
  approved: { label: 'Approved', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  declined: { label: 'Declined', bg: 'bg-red-100',   text: 'text-red-700',   icon: XCircle      },
}

const inp = 'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 bg-white text-gray-800 transition-all'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'

function fmtDate(ts: { seconds: number } | null) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyOvertime() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employee: myEmployee } = useMyEmployee(currentUser?.email)
  const { fmt } = useCurrency()

  const [requests, setRequests] = useState<OvertimeRequest[]>([])
  const [modal,    setModal]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)
  const [form, setForm] = useState({ date: '', hours: '1', reason: '' })

  useEffect(() => {
    if (!myEmployee) return
    const q = query(
      collection(db, 'overtime_requests'),
      where('employeeId', '==', myEmployee.id),
      orderBy('submittedAt', 'desc'),
    )
    return onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as OvertimeRequest)))
    })
  }, [myEmployee?.id])

  const approvedHours = requests.filter(r => r.status === 'approved').reduce((s, r) => s + r.hours, 0)
  const pendingHours  = requests.filter(r => r.status === 'pending').reduce((s, r) => s + r.hours, 0)
  const overtimeRate  = myEmployee?.overtimeRate ?? 0
  const estimatedPay  = overtimeRate ? approvedHours * overtimeRate : null

  const submit = async () => {
    if (!myEmployee || !form.date || !form.hours || !form.reason) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'overtime_requests'), {
        employeeId:   myEmployee.id,
        employeeName: myEmployee.name,
        date:         form.date,
        hours:        Number(form.hours),
        reason:       form.reason,
        status:       'pending',
        submittedAt:  serverTimestamp(),
      })
      await createNotification(
        currentUser!.email,
        'Overtime Request Submitted',
        `${form.hours}h overtime on ${form.date} sent to HR for approval.`,
        'overtime',
        '/my-overtime',
      )
      setDone(true)
      setForm({ date: '', hours: '1', reason: '' })
    } finally { setSaving(false) }
  }

  const openModal = () => { setDone(false); setModal(true) }

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #1a0f00 0%, #1a1200 60%, #0f1629 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.4), transparent 65%)' }} />
        <div className="absolute bottom-0 left-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.2), transparent 65%)' }} />

        <div className="relative flex items-start justify-between flex-wrap gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 px-3 py-1 rounded-full mb-4">
              <Timer size={12} className="text-orange-400" />
              <span className="text-orange-300 text-[11px] font-semibold tracking-wide">OVERTIME REQUESTS</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">My Overtime</h1>
            <p className="text-white/50 text-sm mt-2 max-w-sm">
              Request approval for overtime hours before or after working them.
            </p>
          </div>
          <button onClick={openModal}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-orange-500/25"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
            <Plus size={16} /> Request Overtime
          </button>
        </div>

        <div className="relative mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Requests', value: String(requests.length),    color: '#FDA4AF' },
            { label: 'Approved Hours', value: `${approvedHours}h`,         color: '#86EFAC' },
            { label: 'Pending Hours',  value: `${pendingHours}h`,          color: '#FDE68A' },
            { label: 'Est. Pay',       value: estimatedPay ? fmt(estimatedPay) : '—', color: '#6EE7B7' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-1">{s.label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-secondary">Overtime History</p>
            <p className="text-xs text-gray-400 mt-0.5">{requests.length} total requests</p>
          </div>
          {approvedHours > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
              <TrendingUp size={12} /> {approvedHours}h approved
            </div>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap size={24} className="text-orange-300" />
            </div>
            <p className="text-sm font-semibold text-secondary">No overtime requests</p>
            <p className="text-xs text-gray-400 mt-1">Submit a request to track your overtime hours.</p>
            <button onClick={openModal} className="mt-4 btn-primary text-sm px-5">Request Overtime</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map(r => {
              const cfg = STATUS_CONFIG[r.status]
              const StatusIcon = cfg.icon
              return (
                <div key={r.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                    <Timer size={20} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-secondary">{r.date}</p>
                      <span className="text-gray-300">·</span>
                      <p className="text-xs font-semibold text-orange-600">{r.hours}h overtime</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{r.reason}</p>
                    {r.approvedBy && <p className="text-[10px] text-gray-400 mt-0.5">by {r.approvedBy}</p>}
                    <p className="text-[10px] text-gray-300 mt-1">Submitted {fmtDate(r.submittedAt)}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 ${cfg.bg} ${cfg.text}`}>
                    <StatusIcon size={11} />
                    {cfg.label}
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

            <div className="relative px-6 py-5 text-white overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1a0f00, #0f1629)' }}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.45), transparent 65%)' }} />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Timer size={16} className="text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Request Overtime</p>
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
                <p className="text-xs text-gray-400 mt-1.5">Your overtime request has been sent to HR for approval.</p>
                <button onClick={() => setModal(false)} className="mt-5 btn-primary px-8">Done</button>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Date</label>
                      <input type="date" value={form.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        max={new Date().toISOString().split('T')[0]}
                        className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Hours</label>
                      <select value={form.hours}
                        onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                        className={inp}>
                        {[0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8].map(h => (
                          <option key={h} value={h}>{h}h</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {overtimeRate > 0 && form.hours && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-orange-700 font-medium">Estimated pay</span>
                      <span className="text-sm font-bold text-orange-800">
                        {fmt(Number(form.hours) * overtimeRate)}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className={lbl}>Reason / Task Completed</label>
                    <textarea value={form.reason}
                      onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                      rows={3} placeholder="Describe the work done during overtime…"
                      className={`${inp} resize-none`} />
                  </div>
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={submit} disabled={saving || !form.date || !form.reason}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
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
