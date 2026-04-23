import { useState } from 'react'
import { CalendarDays, Plus, CheckCircle2, X } from 'lucide-react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAppSelector } from '../../store'
import { useMyEmployee } from '../../hooks/useMyEmployee'
import { useFirebaseLeave } from '../../hooks/useFirebaseLeave'
import type { LeaveType } from '../../types'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:        'Annual Leave',
  sick:          'Sick Leave',
  toil:          'TOIL',
  unpaid:        'Unpaid Leave',
  maternity:     'Maternity Leave',
  paternity:     'Paternity Leave',
  compassionate: 'Compassionate',
}

const LEAVE_TYPES = Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => ({ v, l }))

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending:   { bg: 'bg-amber-100', text: 'text-amber-700'  },
  approved:  { bg: 'bg-green-100', text: 'text-green-700'  },
  declined:  { bg: 'bg-red-100',   text: 'text-red-700'    },
  cancelled: { bg: 'bg-gray-100',  text: 'text-gray-500'   },
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-800'

function ApplyModal({
  name, employeeId, onClose,
}: { name: string; employeeId: string; onClose: () => void }) {
  const [type,      setType]      = useState<LeaveType>('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [reason,    setReason]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [done,      setDone]      = useState(false)

  const dayCount = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1)
    : 0

  const submit = async () => {
    if (!startDate || !endDate) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'leave_requests'), {
        employeeId, employeeName: name, type, startDate, endDate,
        days: dayCount, reason, status: 'pending', submittedAt: serverTimestamp(),
      })
      setDone(true)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <CalendarDays size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Apply for Leave</p>
              <p className="text-xs text-gray-400">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        {done ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <p className="text-base font-bold text-secondary">Request Submitted</p>
            <p className="text-xs text-gray-400">Your leave request has been sent for approval.</p>
            <button onClick={onClose} className="btn-primary text-sm mt-2 px-6">Done</button>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Leave Type</label>
                <select value={type} onChange={e => setType(e.target.value as LeaveType)} className={inp}>
                  {LEAVE_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]} className={inp} />
                </div>
              </div>
              {dayCount > 0 && (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
                  <span className="text-xs text-gray-500 font-medium">Duration</span>
                  <span className="text-sm font-bold text-primary">{dayCount} day{dayCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Reason <span className="text-gray-300 normal-case font-normal">(optional)</span>
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  rows={3} placeholder="Brief reason…" className={`${inp} resize-none`} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <button onClick={onClose} className="btn-outline text-sm px-4">Cancel</button>
              <button onClick={submit} disabled={saving || !startDate || !endDate}
                className="btn-primary text-sm px-6 disabled:opacity-50">
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MyLeave() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employee: myEmployee } = useMyEmployee()
  const { requests: allLeave } = useFirebaseLeave()
  const [modal,  setModal]  = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'declined'>('all')
  const myLeave    = allLeave.filter(r => r.employeeId === myEmployee?.id)

  const annualUsed = myLeave.filter(r => r.type === 'annual' && r.status === 'approved').reduce((s, r) => s + r.days, 0)
  const sickUsed   = myLeave.filter(r => r.type === 'sick'   && r.status === 'approved').reduce((s, r) => s + r.days, 0)
  const toilUsed   = myLeave.filter(r => r.type === 'toil'   && r.status === 'approved').reduce((s, r) => s + r.days, 0)
  const otherUsed  = myLeave.filter(r => r.status === 'approved' && !['sick','annual','toil'].includes(r.type)).reduce((s, r) => s + r.days, 0)
  const LEAVE_TOTAL = 10
  const totalUsed   = myLeave.filter(r => r.status === 'approved').reduce((s, r) => s + r.days, 0)
  const remaining   = Math.max(0, LEAVE_TOTAL - totalUsed)

  const filtered = filter === 'all' ? myLeave : myLeave.filter(r => r.status === filter)

  const BREAKDOWN = [
    { label: 'Sick',   used: sickUsed,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Annual', used: annualUsed, color: 'text-primary',      bg: 'bg-blue-50'    },
    { label: 'TOIL',   used: toilUsed,   color: 'text-amber-600',   bg: 'bg-amber-50'   },
    { label: 'Other',  used: otherUsed,  color: 'text-purple-600',  bg: 'bg-purple-50'  },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">My Leave</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your leave requests and balances</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Apply for Leave
        </button>
      </div>

      {/* Combined leave balance card */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-secondary">Leave Allowance</p>
            <p className="text-xs text-gray-400 mt-0.5">{LEAVE_TOTAL} days total · Any leave type</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-primary tabular-nums">{remaining}</span>
            <p className="text-xs text-gray-400 mt-0.5">days remaining</p>
          </div>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (totalUsed / LEAVE_TOTAL) * 100)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mb-5">
          <span>{totalUsed} days used</span>
          <span>{LEAVE_TOTAL} days total</span>
        </div>
        <div className="grid grid-cols-4 gap-2 border-t border-gray-100 pt-4">
          {BREAKDOWN.map(b => (
            <div key={b.label} className={`${b.bg} rounded-xl p-3 text-center`}>
              <p className={`text-xl font-bold ${b.color} tabular-nums`}>{b.used}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{b.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* History table */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 flex-wrap gap-3">
          <p className="text-sm font-bold text-secondary">Leave History</p>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'pending', 'approved', 'declined'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors capitalize
                  ${filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CalendarDays size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-400 mb-3">No leave requests found.</p>
            <button onClick={() => setModal(true)} className="btn-primary text-sm px-5">Apply for Leave</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(lr => {
              const sc = STATUS_STYLE[lr.status] ?? STATUS_STYLE.pending
              return (
                <div key={lr.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <CalendarDays size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary">
                      {LEAVE_TYPE_LABELS[lr.type] ?? lr.type}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {lr.startDate} → {lr.endDate}
                      {' · '}<strong className="text-secondary">{lr.days}</strong> day{lr.days !== 1 ? 's' : ''}
                      {lr.reason && ` · "${lr.reason}"`}
                    </p>
                    {lr.approvedBy && (
                      <p className="text-[10px] text-gray-400 mt-0.5">by {lr.approvedBy}</p>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize shrink-0 ${sc.bg} ${sc.text}`}>
                    {lr.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <ApplyModal
          name={currentUser?.name ?? ''}
          employeeId={myEmployee?.id ?? ''}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}
