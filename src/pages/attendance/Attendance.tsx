import { useState } from 'react'
import { Download, Search } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { mockAttendance, weeklyAttendance } from '../../utils/mockData'

const STATUS_LABELS: Record<string, string> = { present:'Present', absent:'Absent', late:'Late', on_leave:'On Leave', early_departure:'Early Departure' }

export default function Attendance() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const filtered = mockAttendance.filter(r => {
    const matchSearch = !search || r.employeeName.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || r.status === filter
    return matchSearch && matchFilter
  })

  const counts = { present: 0, absent: 0, late: 0, on_leave: 0 }
  mockAttendance.forEach(r => { if (r.status in counts) counts[r.status as keyof typeof counts]++ })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Attendance Tracking</h2>
          <p className="page-sub">Thursday, 10 April 2026</p>
        </div>
        <button className="btn-outline text-sm gap-2"><Download size={14}/> Export CSV</button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Present',  value: counts.present,  color:'#10B981' },
          { label:'Absent',   value: counts.absent,   color:'#EF4444' },
          { label:'Late',     value: counts.late,     color:'#F59E0B' },
          { label:'On Leave', value: counts.on_leave, color:'#2E86C1' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor:`${s.color}15` }}>
              <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-secondary">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-secondary mb-4">Weekly Overview</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weeklyAttendance} barSize={14} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="present" name="Present" fill="#2E86C1" radius={[3,3,0,0]} />
            <Bar dataKey="absent"  name="Absent"  fill="#EF4444" radius={[3,3,0,0]} />
            <Bar dataKey="late"    name="Late"    fill="#F59E0B" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..." className="input pl-9 text-sm" />
          </div>
          <select value={filter} onChange={e=>setFilter(e.target.value)} className="input w-auto text-sm">
            <option value="All">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee','Department','Clock In','Clock Out','Hours','Overtime','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.employeeName} size="xs" />
                      <span className="text-sm font-medium text-secondary">{r.employeeName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.department}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{r.clockIn ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{r.clockOut ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.hoursWorked > 0 ? `${r.hoursWorked}h` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.overtime > 0 ? <span className="text-amber-600 font-medium">+{r.overtime}h</span> : '—'}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant(r.status)} size="xs" dot>{STATUS_LABELS[r.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
