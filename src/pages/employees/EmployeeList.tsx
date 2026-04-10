import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Plus, Download } from 'lucide-react'
import { useAppSelector } from '../../store'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS } from '../../utils/constants'

const DEPARTMENTS = ['All', 'Operations', 'Customer Service', 'Dispatch', 'Admin', 'Management']

export default function EmployeeList() {
  const navigate   = useNavigate()
  const employees  = useAppSelector(s => s.employees.employees)
  const [search,   setSearch]   = useState('')
  const [dept,     setDept]     = useState('All')
  const [empType,  setEmpType]  = useState('All')

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeId.toLowerCase().includes(search.toLowerCase()) || e.jobTitle.toLowerCase().includes(search.toLowerCase())
    const matchDept   = dept === 'All' || e.department === dept
    const matchType   = empType === 'All' || e.employmentType === empType
    return matchSearch && matchDept && matchType
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Employee Directory</h2>
          <p className="page-sub">{employees.length} employees across {DEPARTMENTS.length - 1} departments</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline text-sm gap-2"><Download size={14} /> Export</button>
          <button onClick={() => {}} className="btn-primary text-sm gap-2"><Plus size={14} /> Add Employee</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, ID, or job title..." className="input pl-9 text-sm" />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="input w-auto text-sm">
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={empType} onChange={e => setEmpType(e.target.value)} className="input w-auto text-sm">
          <option value="All">All Types</option>
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <p className="text-xs text-gray-400">{filtered.length} results</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee', 'ID', 'Department', 'Job Title', 'Type', 'Start Date', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-primary-50/30 transition-colors cursor-pointer" onClick={() => navigate(`/employees/${e.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-secondary">{e.name}</p>
                        <p className="text-xs text-gray-400">{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{e.employeeId}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{e.department}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{e.jobTitle}</td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral" size="xs">{EMPLOYMENT_TYPE_LABELS[e.employmentType]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.startDate).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(e.status)} size="xs" dot>{STATUS_LABELS[e.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-primary hover:underline font-medium" onClick={ev => { ev.stopPropagation(); navigate(`/employees/${e.id}`) }}>View →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">Showing {filtered.length} of {employees.length} employees</p>
          <div className="flex gap-1">
            <button className="btn-ghost text-xs px-2 py-1">← Prev</button>
            <button className="btn-primary text-xs px-2 py-1">1</button>
            <button className="btn-ghost text-xs px-2 py-1">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
