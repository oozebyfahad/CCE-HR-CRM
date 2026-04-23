import { useState } from 'react'
import { FileText, CalendarDays, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useMyEmployee } from '../../hooks/useMyEmployee'
import { useFirebaseLeave } from '../../hooks/useFirebaseLeave'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:        'Annual Leave',
  sick:          'Sick Leave',
  toil:          'TOIL',
  unpaid:        'Unpaid Leave',
  maternity:     'Maternity Leave',
  paternity:     'Paternity Leave',
  compassionate: 'Compassionate',
}

const STATUS_STYLE: Record<string, { border: string; bg: string; text: string }> = {
  pending:   { border: 'border-amber-200', bg: 'bg-amber-50',  text: 'text-amber-700'  },
  approved:  { border: 'border-green-200', bg: 'bg-green-50',  text: 'text-green-700'  },
  declined:  { border: 'border-red-200',   bg: 'bg-red-50',    text: 'text-red-700'    },
  cancelled: { border: 'border-gray-200',  bg: 'bg-gray-50',   text: 'text-gray-500'   },
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <AlertCircle  size={16} className="text-amber-500"  />,
  approved:  <CheckCircle  size={16} className="text-green-500"  />,
  declined:  <XCircle      size={16} className="text-red-500"    />,
  cancelled: <XCircle      size={16} className="text-gray-400"   />,
}

type FilterType = 'all' | 'pending' | 'approved' | 'declined'

export default function MyRequests() {
  const { employee: myEmployee } = useMyEmployee()
  const { requests: allLeave } = useFirebaseLeave()
  const [filter, setFilter] = useState<FilterType>('all')

  const myLeave    = allLeave.filter(r => r.employeeId === myEmployee?.id)

  const requests = myLeave.map(lr => ({
    id:       lr.id,
    type:     'leave' as const,
    title:    LEAVE_TYPE_LABELS[lr.type] ?? lr.type,
    subtitle: `${lr.startDate} → ${lr.endDate} · ${lr.days} day${lr.days !== 1 ? 's' : ''}`,
    status:   lr.status,
    reason:   lr.reason,
    meta:     lr.approvedBy ? `Reviewed by ${lr.approvedBy}` : undefined,
  }))

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const counts = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    declined: requests.filter(r => r.status === 'declined').length,
  }

  return (
    <div className="space-y-5 max-w-3xl">

      <div>
        <h1 className="text-xl font-bold text-secondary">My Requests</h1>
        <p className="text-sm text-gray-400 mt-0.5">All your submitted requests and their current status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { l: 'Total',    v: counts.all,      c: 'text-secondary',  bg: ''               },
          { l: 'Pending',  v: counts.pending,  c: 'text-amber-600',  bg: 'bg-amber-50'    },
          { l: 'Approved', v: counts.approved, c: 'text-green-600',  bg: 'bg-green-50'    },
          { l: 'Declined', v: counts.declined, c: 'text-red-500',    bg: 'bg-red-50'      },
        ] as const).map(s => (
          <div key={s.l} className={`card p-4 ${s.bg}`}>
            <p className="text-xs text-gray-500 font-medium">{s.l}</p>
            <p className={`text-2xl font-bold mt-1 ${s.c} tabular-nums`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 flex-wrap gap-3">
          <p className="text-sm font-bold text-secondary">Request History</p>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'pending', 'approved', 'declined'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors capitalize
                  ${filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {f}
                {f !== 'all' && counts[f] > 0 && (
                  <span className="ml-1 opacity-70">{counts[f]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-400">No requests found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(r => {
              const sc = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
              return (
                <div key={r.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <CalendarDays size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-secondary">{r.title}</p>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${sc.border} ${sc.bg} ${sc.text}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 tabular-nums">{r.subtitle}</p>
                    {r.reason && (
                      <p className="text-xs text-gray-500 mt-1 italic">"{r.reason}"</p>
                    )}
                    {r.meta && (
                      <p className="text-[10px] text-gray-400 mt-1">{r.meta}</p>
                    )}
                  </div>
                  <div className="shrink-0 mt-0.5">
                    {STATUS_ICON[r.status]}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
