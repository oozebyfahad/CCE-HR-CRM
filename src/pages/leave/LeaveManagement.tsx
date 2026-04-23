import { useState, useMemo } from 'react'
import {
  CheckCircle2, XCircle, Search, Clock, Plus,
  CalendarDays, Users, ClipboardCheck, Ban, X, ChevronDown,
} from 'lucide-react'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { LEAVE_TYPE_LABELS, DEPARTMENTS } from '../../utils/constants'
import { useFirebaseLeave, type NewLeaveRequest } from '../../hooks/useFirebaseLeave'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useAppSelector } from '../../store'
import { cn } from '../../utils/cn'
import type { LeaveType } from '../../types'

// ── helpers ───────────────────────────────────────────────────────────
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function workingDaysBetween(from: string, to: string): number {
  if (!from || !to) return 0
  const start = new Date(from)
  const end   = new Date(to)
  if (end < start) return 0
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

const LEAVE_COLORS: Record<string, string> = {
  annual:         '#2E86C1',
  public_holiday: '#F59E0B',
  sick:           '#EF4444',
  casual:         '#8B5CF6',
  unpaid:         '#9CA3AF',
  maternity:      '#EC4899',
  paternity:      '#6366F1',
  compassionate:  '#D97706',
  toil:           '#10B981',
}

type StatusTab = 'pending' | 'approved' | 'declined' | 'all'

// ── Log Leave Modal ───────────────────────────────────────────────────
function LogLeaveModal({
  onClose,
  onSave,
  loggedBy,
}: {
  onClose: () => void
  onSave:  (data: NewLeaveRequest) => Promise<void>
  loggedBy: string
}) {
  const { employees } = useFirebaseEmployees()
  const [empSearch, setEmpSearch]   = useState('')
  const [empOpen,   setEmpOpen]     = useState(false)
  const [form, setForm] = useState<{
    employeeId:   string
    employeeName: string
    department:   string
    type:         LeaveType
    startDate:    string
    endDate:      string
    reason:       string
    status:       'pending' | 'approved'
  }>({
    employeeId:   '',
    employeeName: '',
    department:   '',
    type:         'annual',
    startDate:    '',
    endDate:      '',
    reason:       '',
    status:       'approved',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const days = workingDaysBetween(form.startDate, form.endDate)

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase())
  )

  const selectEmp = (e: typeof employees[number]) => {
    setForm(f => ({ ...f, employeeId: e.id, employeeName: e.name, department: e.department ?? '' }))
    setEmpOpen(false)
    setEmpSearch('')
  }

  const handleSubmit = async () => {
    if (!form.employeeId)  return setError('Please select an employee.')
    if (!form.startDate)   return setError('Please set a start date.')
    if (!form.endDate)     return setError('Please set an end date.')
    if (days <= 0)         return setError('End date must be after start date.')
    setError('')
    setSaving(true)
    try {
      await onSave({ ...form, days, loggedBy })
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-secondary">Log Leave Request</h3>
            <p className="text-xs text-gray-400 mt-0.5">Record leave on behalf of an employee</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* Employee picker */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-semibold text-gray-600">Employee</label>
            <div
              onClick={() => setEmpOpen(v => !v)}
              className={cn(field, 'flex items-center justify-between cursor-pointer select-none',
                !form.employeeName && 'text-gray-400'
              )}>
              <span>{form.employeeName || 'Select employee…'}</span>
              <ChevronDown size={14} className={cn('text-gray-400 transition-transform', empOpen && 'rotate-180')} />
            </div>
            {empOpen && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      autoFocus
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      placeholder="Search…"
                      className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <ul className="max-h-48 overflow-y-auto">
                  {filteredEmps.length === 0 && (
                    <li className="px-4 py-3 text-xs text-gray-400 text-center">No employees found</li>
                  )}
                  {filteredEmps.map(e => (
                    <li
                      key={e.id}
                      onClick={() => selectEmp(e)}
                      className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                        {e.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-secondary">{e.name}</p>
                        <p className="text-[10px] text-gray-400">{e.department} · {e.jobTitle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Leave type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">Leave Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as LeaveType }))} className={field}>
              {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Start Date</label>
              <input type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className={field} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">End Date</label>
              <input type="date" value={form.endDate} min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className={field} />
            </div>
          </div>

          {/* Days badge */}
          {form.startDate && form.endDate && days > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg">
              <CalendarDays size={13} className="text-primary" />
              <p className="text-xs font-semibold text-primary">{days} working day{days !== 1 ? 's' : ''}</p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={2}
              placeholder="Brief reason for the leave…"
              className={cn(field, 'resize-none')}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">Log as</label>
            <div className="flex gap-2">
              {(['approved', 'pending'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-semibold border transition',
                    form.status === s
                      ? s === 'approved'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  )}>
                  {s === 'approved' ? 'Approved' : 'Pending Review'}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Log Leave'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function LeaveManagement() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { requests, loading, addRequest, approveRequest, declineRequest } = useFirebaseLeave()

  const [activeTab,  setActiveTab]  = useState<StatusTab>('pending')
  const [search,     setSearch]     = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showModal,  setShowModal]  = useState(false)

  const shown = useMemo(() => requests.filter(r => {
    const matchTab  = activeTab === 'all' || r.status === activeTab
    const matchSrch = !search || r.employeeName?.toLowerCase().includes(search.toLowerCase())
    const matchDept = deptFilter === 'All' || r.department === deptFilter
    const matchType = typeFilter === 'all' || r.type === typeFilter
    return matchTab && matchSrch && matchDept && matchType
  }), [requests, activeTab, search, deptFilter, typeFilter])

  const pendingCount  = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const declinedCount = requests.filter(r => r.status === 'declined').length

  const approvedRequests = requests.filter(r => r.status === 'approved')
  const daysByType = (type: string) =>
    approvedRequests.filter(r => r.type === type).reduce((s, r) => s + (r.days ?? 0), 0)

  const SUMMARY = [
    { type: 'annual',         label: 'Annual Leave',    color: LEAVE_COLORS.annual         },
    { type: 'public_holiday', label: 'Public Holidays', color: LEAVE_COLORS.public_holiday },
    { type: 'sick',           label: 'Sick Leave',      color: LEAVE_COLORS.sick           },
    { type: 'casual',         label: 'Casual Leave',    color: LEAVE_COLORS.casual         },
    { type: 'unpaid',         label: 'Unpaid Leave',    color: LEAVE_COLORS.unpaid         },
  ]

  const TABS = [
    { key: 'pending'  as StatusTab, label: 'Pending',  Icon: Clock,          count: pendingCount  },
    { key: 'approved' as StatusTab, label: 'Approved', Icon: ClipboardCheck, count: approvedCount },
    { key: 'declined' as StatusTab, label: 'Declined', Icon: Ban,            count: declinedCount },
    { key: 'all'      as StatusTab, label: 'All',      Icon: Users,          count: requests.length },
  ]

  const handleApprove = (id: string) => approveRequest(id, currentUser?.name ?? 'HR Manager')
  const handleDecline = (id: string) => declineRequest(id, currentUser?.name ?? 'HR Manager')

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Leave Management</h2>
          <p className="page-sub">
            {pendingCount > 0
              ? `${pendingCount} request${pendingCount !== 1 ? 's' : ''} awaiting approval`
              : 'All requests reviewed'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition shadow-sm">
          <Plus size={15} /> Log Leave
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SUMMARY.map(s => {
          const used = daysByType(s.type)
          return (
            <div key={s.type} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <span className="text-xl font-bold" style={{ color: s.color }}>{used}</span>
              </div>
              <p className="text-[10px] text-gray-400">{used} approved day{used !== 1 ? 's' : ''} this year</p>
            </div>
          )
        })}
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">

        {/* Status tabs */}
        <div className="px-4 pt-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-0">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-secondary'
                )}>
                <t.Icon size={13} />
                {t.label}
                {t.count > 0 && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    activeTab === t.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                  )}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
              <option value="All">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
              <option value="all">All Types</option>
              {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search employee…" className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee', 'Department', 'Type', 'Dates', 'Days', 'Reason', 'Status', 'By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">

              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                      <Clock size={14} className="animate-spin" /> Loading requests…
                    </div>
                  </td>
                </tr>
              )}

              {!loading && shown.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-300">
                      <CalendarDays size={32} strokeWidth={1.2} />
                      <p className="text-sm text-gray-400">
                        {activeTab === 'pending' ? 'No pending requests — all caught up.' : 'No records match your filters.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && shown.map(r => {
                const typeColor = LEAVE_COLORS[r.type] ?? '#9CA3AF'
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={r.employeeName ?? '?'} size="xs" />
                        <p className="text-sm font-medium text-secondary whitespace-nowrap">{r.employeeName}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.department || '—'}</td>

                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: `${typeColor}18`, color: typeColor }}>
                        {LEAVE_TYPE_LABELS[r.type] ?? r.type}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                    </td>

                    <td className="px-4 py-3 text-sm font-bold text-secondary">{r.days}d</td>

                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate" title={r.reason}>
                      {r.reason || <span className="text-gray-300">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(r.status)} size="xs" dot>{r.status}</Badge>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {(r as any).approvedBy ?? (r as any).declinedBy ?? (r as any).loggedBy ?? <span className="text-gray-300">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      {r.status === 'pending' ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleApprove(r.id)}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors whitespace-nowrap">
                            <CheckCircle2 size={11} /> Approve
                          </button>
                          <button onClick={() => handleDecline(r.id)}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors whitespace-nowrap">
                            <XCircle size={11} /> Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && shown.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
            <p className="text-xs text-gray-400">Showing {shown.length} of {requests.length} requests</p>
            {(deptFilter !== 'All' || typeFilter !== 'all' || search) && (
              <button
                onClick={() => { setDeptFilter('All'); setTypeFilter('all'); setSearch('') }}
                className="text-xs text-primary hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <LogLeaveModal
          onClose={() => setShowModal(false)}
          onSave={addRequest}
          loggedBy={currentUser?.name ?? 'HR Manager'}
        />
      )}
    </div>
  )
}
