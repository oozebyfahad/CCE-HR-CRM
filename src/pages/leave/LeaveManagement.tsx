import { useState } from 'react'
import { CheckCircle2, XCircle, Search, Clock } from 'lucide-react'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { LEAVE_TYPE_LABELS } from '../../utils/constants'
import { useFirebaseLeave } from '../../hooks/useFirebaseLeave'
import { useAppSelector } from '../../store'
import { cn } from '../../utils/cn'

type Tab = 'pending' | 'approved' | 'declined' | 'all'

export default function LeaveManagement() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { requests, loading, approveRequest, declineRequest } = useFirebaseLeave()

  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [search,    setSearch]    = useState('')

  const shown = requests.filter(r => {
    const matchTab    = activeTab === 'all' || r.status === activeTab
    const matchSearch = !search || r.employeeName?.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const pendingCount  = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const declinedCount = requests.filter(r => r.status === 'declined').length

  // Compute approved days per leave type from real data
  const approvedRequests = requests.filter(r => r.status === 'approved')
  const daysByType = (type: string) =>
    approvedRequests.filter(r => r.type === type).reduce((s, r) => s + (r.days ?? 0), 0)

  const SUMMARY = [
    { type: 'annual',      label: 'Annual Leave', color: '#2E86C1' },
    { type: 'sick',        label: 'Sick Leave',   color: '#EF4444' },
    { type: 'toil',        label: 'TOIL',         color: '#F59E0B' },
    { type: 'unpaid',      label: 'Unpaid Leave', color: '#8B5CF6' },
  ]

  const TABS = [
    { key: 'pending'  as Tab, label: 'Pending',  count: pendingCount  },
    { key: 'approved' as Tab, label: 'Approved', count: approvedCount },
    { key: 'declined' as Tab, label: 'Declined', count: declinedCount },
    { key: 'all'      as Tab, label: 'All',      count: requests.length },
  ]

  const handleApprove = (id: string) =>
    approveRequest(id, currentUser?.name ?? 'HR Manager')

  const handleDecline = (id: string) =>
    declineRequest(id, currentUser?.name ?? 'HR Manager')

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return d }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Leave Management</h2>
          <p className="page-sub">{pendingCount} request{pendingCount !== 1 ? 's' : ''} awaiting approval</p>
        </div>
      </div>

      {/* Summary cards — computed from real Firebase data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SUMMARY.map(s => {
          const used = daysByType(s.type)
          return (
            <div key={s.type} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <span className="text-sm font-bold" style={{ color: s.color }}>{used}</span>
              </div>
              <p className="text-[10px] text-gray-400">{used} approved day{used !== 1 ? 's' : ''} this year</p>
            </div>
          )
        })}
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">

        {/* Tabs + search */}
        <div className="px-4 pt-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-0">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-secondary'
                )}>
                {t.label}
                {t.count > 0 && (
                  <span className={cn(
                    'ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    activeTab === t.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                  )}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search employee…" className="input pl-8 text-sm w-48" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee', 'Type', 'Dates', 'Days', 'Reason', 'Status', 'Actioned By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">

              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                      <Clock size={14} className="animate-spin" /> Loading requests…
                    </div>
                  </td>
                </tr>
              )}

              {!loading && shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    {activeTab === 'pending' ? 'No pending requests — all caught up.' : 'No records found.'}
                  </td>
                </tr>
              )}

              {!loading && shown.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">

                  {/* Employee */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.employeeName ?? '?'} size="xs" />
                      <p className="text-sm font-medium text-secondary">{r.employeeName}</p>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <Badge variant="neutral" size="xs">
                      {LEAVE_TYPE_LABELS[r.type] ?? r.type}
                    </Badge>
                  </td>

                  {/* Dates */}
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                  </td>

                  {/* Days */}
                  <td className="px-4 py-3 text-sm font-semibold text-secondary">{r.days}d</td>

                  {/* Reason */}
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate" title={r.reason}>
                    {r.reason || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(r.status)} size="xs" dot>{r.status}</Badge>
                  </td>

                  {/* Actioned by */}
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {r.approvedBy ?? <span className="text-gray-300">—</span>}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleApprove(r.id)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors">
                          <CheckCircle2 size={11} /> Approve
                        </button>
                        <button onClick={() => handleDecline(r.id)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors">
                          <XCircle size={11} /> Decline
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && shown.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30">
            <p className="text-xs text-gray-400">Showing {shown.length} of {requests.length} requests</p>
          </div>
        )}
      </div>
    </div>
  )
}
