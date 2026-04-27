import { useState, useEffect } from 'react'
import {
  HandCoins, Plus, X, CheckCircle2, Clock, XCircle,
  TrendingUp, Wallet, AlertCircle,
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

interface AdvanceRequest {
  id: string
  employeeId: string
  employeeName: string
  amount: number
  reason: string
  repaymentMonths: number
  status: 'pending' | 'approved' | 'declined'
  submittedAt: { seconds: number } | null
  approvedBy?: string
  notes?: string
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: Clock,         bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  approved: { label: 'Approved', icon: CheckCircle2,  bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  declined: { label: 'Declined', icon: XCircle,       bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
}

const inp = 'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-white text-gray-800 transition-all'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'

function fmtDate(ts: { seconds: number } | null) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyAdvance() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employee: myEmployee } = useMyEmployee(currentUser?.email)
  const { fmt } = useCurrency()

  const [requests, setRequests] = useState<AdvanceRequest[]>([])
  const [modal,    setModal]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)
  const [form, setForm] = useState({ amount: '', reason: '', repaymentMonths: '3' })

  useEffect(() => {
    if (!myEmployee) return
    const q = query(
      collection(db, 'advance_requests'),
      where('employeeId', '==', myEmployee.id),
      orderBy('submittedAt', 'desc'),
    )
    return onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdvanceRequest)))
    })
  }, [myEmployee?.id])

  const pending  = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const totalApproved = approved.reduce((s, r) => s + r.amount, 0)

  const submit = async () => {
    if (!myEmployee || !form.amount || !form.reason) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'advance_requests'), {
        employeeId:      myEmployee.id,
        employeeName:    myEmployee.name,
        amount:          Number(form.amount),
        reason:          form.reason,
        repaymentMonths: Number(form.repaymentMonths),
        status:          'pending',
        submittedAt:     serverTimestamp(),
      })
      await createNotification(
        currentUser!.email,
        'Advance Request Submitted',
        `Your request for ${fmt(Number(form.amount))} has been sent to HR.`,
        'advance',
        '/my-advance',
      )
      setDone(true)
      setForm({ amount: '', reason: '', repaymentMonths: '3' })
    } finally { setSaving(false) }
  }

  const openModal = () => { setDone(false); setModal(true) }

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1230 50%, #0f1629 100%)' }}>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.35), transparent 65%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent 65%)' }} />

        <div className="relative flex items-start justify-between flex-wrap gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-full mb-4">
              <HandCoins size={12} className="text-amber-400" />
              <span className="text-amber-300 text-[11px] font-semibold tracking-wide">SALARY ADVANCE</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">My Advances</h1>
            <p className="text-white/50 text-sm mt-2 max-w-sm">
              Request salary advances and track repayment. HR reviews within 2 business days.
            </p>
          </div>
          <button onClick={openModal}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-amber-500/25"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <Plus size={16} /> Request Advance
          </button>
        </div>

        {/* Stats */}
        <div className="relative mt-8 grid grid-cols-3 gap-3">
          {[
            { label: 'Total Requested', value: fmt(requests.reduce((s, r) => s + r.amount, 0)), icon: Wallet,      color: '#F59E0B' },
            { label: 'Total Approved',  value: fmt(totalApproved),                               icon: CheckCircle2, color: '#10B981' },
            { label: 'Pending Review',  value: String(pending.length),                           icon: Clock,        color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={13} style={{ color: s.color }} />
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium">{s.label}</p>
              </div>
              <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Repayment Info Banner ── */}
      {approved.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <TrendingUp size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Repayment Active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              You have {approved.length} approved advance(s) totalling {fmt(totalApproved)}.
              Repayments are deducted automatically from your monthly payslip.
            </p>
          </div>
        </div>
      )}

      {/* ── History ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-secondary">Request History</p>
            <p className="text-xs text-gray-400 mt-0.5">{requests.length} total requests</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <HandCoins size={24} className="text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-secondary">No advances yet</p>
            <p className="text-xs text-gray-400 mt-1">Your advance requests will appear here.</p>
            <button onClick={openModal} className="mt-4 btn-primary text-sm px-5">
              Request Advance
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map(r => {
              const cfg = STATUS_CONFIG[r.status]
              const StatusIcon = cfg.icon
              return (
                <div key={r.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                    <HandCoins size={20} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-secondary">{fmt(r.amount)}</p>
                      <span className="text-gray-300">·</span>
                      <p className="text-xs text-gray-400">{r.repaymentMonths} month repayment</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{r.reason}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{fmtDate(r.submittedAt)}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${cfg.bg} ${cfg.text}`}>
                    <StatusIcon size={11} />
                    {cfg.label}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Modal header */}
            <div className="relative px-6 py-5 text-white overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1a1230, #0f1629)' }}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.4), transparent 65%)' }} />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <HandCoins size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Request Advance</p>
                    <p className="text-[11px] text-white/50">{myEmployee?.name}</p>
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
                <p className="text-base font-bold text-secondary">Request Submitted!</p>
                <p className="text-xs text-gray-400 mt-1.5">HR will review your advance request within 2 business days.</p>
                <button onClick={() => setModal(false)} className="mt-5 btn-primary px-8">Done</button>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-5">
                  <div>
                    <label className={lbl}>Advance Amount (PKR)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">Rs</span>
                      <input type="number" value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        className={`${inp} pl-10`} placeholder="e.g. 25000" min="1000" />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">Minimum Rs 1,000 · Maximum 1 month salary</p>
                  </div>

                  <div>
                    <label className={lbl}>Repayment Period</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['1','2','3','6'].map(m => (
                        <button key={m} onClick={() => setForm(f => ({ ...f, repaymentMonths: m }))}
                          className={`py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                            form.repaymentMonths === m
                              ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300'
                          }`}>
                          {m}mo
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Reason for Advance</label>
                    <textarea value={form.reason}
                      onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                      rows={3} placeholder="Briefly explain why you need this advance…"
                      className={`${inp} resize-none`} />
                  </div>

                  {form.amount && form.repaymentMonths && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-amber-700 font-medium">Monthly deduction</span>
                      <span className="text-sm font-bold text-amber-800">
                        {fmt(Math.ceil(Number(form.amount) / Number(form.repaymentMonths)))} / month
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-[11px] text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="mt-0.5 shrink-0 text-gray-400" />
                    Approval is subject to company policy and outstanding balances.
                  </div>
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  <button onClick={() => setModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={submit} disabled={saving || !form.amount || !form.reason}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 shadow-lg hover:shadow-amber-200"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
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
