import { useState, useEffect } from 'react'
import { CalendarDays, Plus, CheckCircle2, X, RefreshCw, TrendingDown } from 'lucide-react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import {
  fetchRotaLeaveTypes, fetchRotaLeave,
  type RotaLeaveType, type RotaLeave,
} from '../../services/rotacloud'
import type { LeaveType } from '../../types'

// ── Leave type colours cycling ────────────────────────────────────────
const TYPE_COLORS = [
  { bar: '#2E86C1', bg: 'bg-blue-50',    text: 'text-blue-700',    num: 'text-blue-800'   },
  { bar: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-700', num: 'text-emerald-800'},
  { bar: '#F59E0B', bg: 'bg-amber-50',   text: 'text-amber-700',   num: 'text-amber-800'  },
  { bar: '#8B5CF6', bg: 'bg-violet-50',  text: 'text-violet-700',  num: 'text-violet-800' },
  { bar: '#EF4444', bg: 'bg-red-50',     text: 'text-red-700',     num: 'text-red-800'    },
  { bar: '#EC4899', bg: 'bg-pink-50',    text: 'text-pink-700',    num: 'text-pink-800'   },
]

const STATUS_PILL: Record<string, string> = {
  approved:  'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  declined:  'bg-red-100   text-red-600',
  cancelled: 'bg-gray-100  text-gray-400',
}

const PORTAL_LEAVE_TYPES = [
  { v: 'annual',        l: 'Annual Leave'    },
  { v: 'sick',          l: 'Sick Leave'      },
  { v: 'toil',          l: 'TOIL'            },
  { v: 'unpaid',        l: 'Unpaid Leave'    },
  { v: 'maternity',     l: 'Maternity Leave' },
  { v: 'paternity',     l: 'Paternity Leave' },
  { v: 'compassionate', l: 'Compassionate'   },
]

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-800'

function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Apply modal ───────────────────────────────────────────────────────
function ApplyModal({ name, employeeId, onClose }: { name: string; employeeId: string; onClose: () => void }) {
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
                  {PORTAL_LEAVE_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
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

// ── Main page ─────────────────────────────────────────────────────────
export default function MyLeave() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees } = useFirebaseEmployees()
  const [modal,  setModal]  = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'declined'>('all')

  const myEmployee = employees.find(e => e.email === currentUser?.email)
  const rcId       = myEmployee?.rotacloudId ? Number(myEmployee.rotacloudId) : null

  const [rcLeaveTypes, setRcLeaveTypes] = useState<RotaLeaveType[]>([])
  const [rcLeave,      setRcLeave]      = useState<RotaLeave[]>([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    if (!rcId) return
    setLoading(true)
    setError('')
    Promise.allSettled([fetchRotaLeaveTypes(), fetchRotaLeave(rcId)])
      .then(([typesR, leaveR]) => {
        if (typesR.status === 'fulfilled') setRcLeaveTypes(typesR.value)
        if (leaveR.status === 'fulfilled')
          setRcLeave(leaveR.value.filter(l => l.status !== 'cancelled'))
        else if (typesR.status === 'rejected' && leaveR.status === 'rejected')
          setError('Could not load RotaCloud leave data.')
        setLoading(false)
      })
  }, [rcId])

  // ── Derived values ───────────────────────────────────────────────────
  const typeMap = new Map(rcLeaveTypes.map(t => [t.id, t]))

  // Approved days used per leave type
  const usedByType = new Map<number, number>()
  rcLeave.filter(l => l.status === 'approved').forEach(l =>
    usedByType.set(l.leave_type, (usedByType.get(l.leave_type) ?? 0) + (l.days ?? 0))
  )

  const totalApproved = rcLeave.filter(l => l.status === 'approved').reduce((s, l) => s + (l.days ?? 0), 0)
  const totalPending  = rcLeave.filter(l => l.status === 'pending').reduce((s, l)  => s + (l.days ?? 0), 0)

  const filtered = filter === 'all'
    ? rcLeave
    : rcLeave.filter(l => l.status === filter)

  const sortedLeave = [...filtered].sort((a, b) => b.start_date.localeCompare(a.start_date))

  // ── Not linked to RotaCloud ──────────────────────────────────────────
  if (!rcId) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-secondary">My Leave</h1>
            <p className="text-sm text-gray-400 mt-0.5">Leave balances and history</p>
          </div>
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Apply for Leave
          </button>
        </div>
        <div className="card p-10 text-center">
          <CalendarDays size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">Not linked to RotaCloud</p>
          <p className="text-xs text-gray-400 mt-1">Ask HR to link your account in Settings → RotaCloud Integration.</p>
        </div>
        {modal && (
          <ApplyModal name={currentUser?.name ?? ''} employeeId={myEmployee?.id ?? ''} onClose={() => setModal(false)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">My Leave</h1>
          <p className="text-sm text-gray-400 mt-0.5">Balances and history from RotaCloud</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Apply for Leave
        </button>
      </div>

      {loading ? (
        <div className="card p-10 flex items-center justify-center gap-2 text-gray-400 text-sm">
          <RefreshCw size={15} className="animate-spin" /> Loading leave data…
        </div>
      ) : error ? (
        <div className="card p-6 text-sm text-red-500 text-center">{error}</div>
      ) : (
        <>
          {/* ── Summary bar ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Days Approved', value: totalApproved, bg: 'bg-green-50',  num: 'text-green-700'  },
              { label: 'Days Pending',  value: totalPending,  bg: 'bg-amber-50',  num: 'text-amber-700'  },
              { label: 'Total Records', value: rcLeave.length, bg: 'bg-blue-50',  num: 'text-primary'    },
            ].map(s => (
              <div key={s.label} className={`card p-4 ${s.bg} text-center`}>
                <p className={`text-3xl font-bold tabular-nums ${s.num}`}>{s.value}</p>
                <p className="text-[11px] text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Leave balance per type ── */}
          {rcLeaveTypes.length > 0 && (
            <div className="card p-5">
              <p className="text-sm font-bold text-secondary mb-4">Leave Balances</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rcLeaveTypes.map((lt, i) => {
                  const col       = TYPE_COLORS[i % TYPE_COLORS.length]
                  const used      = usedByType.get(lt.id) ?? 0
                  const hasLimit  = (lt.allowance ?? 0) > 0
                  const total     = lt.allowance ?? 0
                  const remaining = hasLimit ? Math.max(0, total - used) : null
                  const pct       = hasLimit ? Math.min(100, (used / total) * 100) : 0

                  return (
                    <div key={lt.id} className={`${col.bg} rounded-xl p-4`}>
                      <div className="flex items-start justify-between mb-3">
                        <p className={`text-sm font-bold ${col.text}`}>{lt.name}</p>
                        {remaining !== null && (
                          <div className="text-right">
                            <p className={`text-xl font-bold tabular-nums ${col.num}`}>{remaining}</p>
                            <p className="text-[10px] text-gray-500">remaining</p>
                          </div>
                        )}
                      </div>

                      {hasLimit ? (
                        <>
                          <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: col.bar }} />
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-500">
                            <span>{used} used</span>
                            <span>{total} total</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <TrendingDown size={11} />
                          <span>{used} day{used !== 1 ? 's' : ''} used · no fixed limit</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Leave history ── */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 flex-wrap gap-3">
              <p className="text-sm font-bold text-secondary">Leave History</p>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'pending', 'approved', 'declined'] as const).map(f => {
                  const count = f === 'all' ? rcLeave.length : rcLeave.filter(l => l.status === f).length
                  return (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors capitalize flex items-center gap-1
                        ${filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {f}
                      {count > 0 && (
                        <span className={`text-[10px] font-bold px-1 rounded-full ${filter === f ? 'bg-white/20' : 'bg-gray-200 text-gray-600'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {sortedLeave.length === 0 ? (
              <div className="p-10 text-center">
                <CalendarDays size={28} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  {filter === 'all' ? 'No leave records in RotaCloud.' : `No ${filter} leave records.`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sortedLeave.map(l => {
                  const lt      = typeMap.get(l.leave_type)
                  const col     = TYPE_COLORS[(rcLeaveTypes.findIndex(t => t.id === l.leave_type)) % TYPE_COLORS.length]
                  const pill    = STATUS_PILL[l.status] ?? STATUS_PILL.pending
                  const isSame  = l.start_date === l.end_date
                  return (
                    <div key={l.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: col.bar + '20' }}>
                        <CalendarDays size={15} style={{ color: col.bar }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-secondary">
                          {lt?.name ?? `Leave Type ${l.leave_type}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmtDate(l.start_date)}
                          {!isSame && ` → ${fmtDate(l.end_date)}`}
                          {' · '}
                          <strong className="text-secondary">{l.days}</strong> day{l.days !== 1 ? 's' : ''}
                        </p>
                        {l.notes && (
                          <p className="text-[11px] text-gray-400 italic mt-0.5">"{l.notes}"</p>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize shrink-0 ${pill}`}>
                        {l.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

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
