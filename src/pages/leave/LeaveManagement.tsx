import { useState } from 'react'
import { CheckCircle2, XCircle, Search } from 'lucide-react'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { mockLeaveRequests } from '../../utils/mockData'
import { LEAVE_TYPE_LABELS } from '../../utils/constants'
import type { LeaveRequest } from '../../types'

export default function LeaveManagement() {
  const [requests, setRequests] = useState(mockLeaveRequests)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'declined'>('pending')
  const [search, setSearch] = useState('')

  const shown = requests.filter(r => {
    const matchTab    = activeTab === 'all' || r.status === activeTab
    const matchSearch = !search || r.employeeName.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const approve = (id: string) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const, approvedBy: 'HR Manager', approvedDate: new Date().toISOString().split('T')[0] } : r))
  const decline = (id: string) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'declined' as const } : r))

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const TABS = [
    { key: 'pending',  label: 'Pending',  count: requests.filter(r => r.status==='pending').length  },
    { key: 'approved', label: 'Approved', count: requests.filter(r => r.status==='approved').length },
    { key: 'declined', label: 'Declined', count: requests.filter(r => r.status==='declined').length },
    { key: 'all',      label: 'All',      count: requests.length },
  ] as const

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Leave Management</h2>
          <p className="page-sub">{pendingCount} requests awaiting approval</p>
        </div>
        <button className="btn-primary text-sm">+ New Leave Request</button>
      </div>

      {/* Leave balance cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { type:'Annual Leave',      used:45,  total:280, color:'#2E86C1' },
          { type:'Sick Leave',        used:12,  total:60,  color:'#EF4444' },
          { type:'TOIL',              used:8,   total:30,  color:'#F59E0B' },
          { type:'Unpaid Leave',      used:3,   total:0,   color:'#8B5CF6' },
        ].map(b => (
          <div key={b.type} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">{b.type}</p>
              <span className="text-sm font-bold" style={{ color: b.color }}>{b.used}</span>
            </div>
            {b.total > 0 && (
              <>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full" style={{ width:`${(b.used/b.total)*100}%`, backgroundColor: b.color }} />
                </div>
                <p className="text-[10px] text-gray-400">{b.used} of {b.total} days used this year</p>
              </>
            )}
            {b.total === 0 && <p className="text-[10px] text-gray-400">{b.used} days taken this year</p>}
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="card overflow-hidden">
        <div className="px-4 pt-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-0">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-secondary'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab===t.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="input pl-8 text-sm w-44" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee','Dept','Type','Dates','Days','Status','Approved By','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.employeeName} size="xs" />
                      <div>
                        <p className="text-sm font-medium text-secondary">{r.employeeName}</p>
                        {r.reason && <p className="text-[10px] text-gray-400">{r.reason}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.department}</td>
                  <td className="px-4 py-3"><Badge variant="neutral" size="xs">{LEAVE_TYPE_LABELS[r.type]}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {new Date(r.startDate).toLocaleDateString('en-GB')} – {new Date(r.endDate).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-secondary">{r.days}d</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant(r.status)} size="xs" dot>{r.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.approvedBy ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button onClick={() => approve(r.id)} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors">
                          <CheckCircle2 size={11}/> Approve
                        </button>
                        <button onClick={() => decline(r.id)} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors">
                          <XCircle size={11}/> Decline
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
