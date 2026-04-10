import { useAppSelector } from '../../store'
import { Download, Link2 } from 'lucide-react'
import { EMPLOYMENT_TYPE_LABELS } from '../../utils/constants'
import { Badge } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'

export default function Payroll() {
  const employees = useAppSelector(s => s.employees.employees)

  const totalPayroll = employees.reduce((s, e) => s + (e.salary / 12), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Payroll Summary</h2>
          <p className="page-sub">Read-only summary view — full processing via integrated payroll system</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline text-sm gap-2"><Link2 size={14}/> Sync Payroll</button>
          <button className="btn-outline text-sm gap-2"><Download size={14}/> Export P60s</button>
        </div>
      </div>

      {/* Integration notice */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Link2 size={15} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800">
          This module shows payroll summaries synced from your integrated payroll provider (Sage / Xero / QuickBooks). Full payroll processing is managed externally. Payslips are accessible to employees via their self-service portal.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Monthly Payroll', value: `£${Math.round(totalPayroll).toLocaleString()}`, color:'#2E86C1' },
          { label:'Annual Payroll',  value: `£${Math.round(totalPayroll*12).toLocaleString()}`, color:'#10B981' },
          { label:'Avg Salary',      value: `£${Math.round(employees.reduce((s,e)=>s+e.salary,0)/employees.length).toLocaleString()}`, color:'#F59E0B' },
          { label:'On Payroll',      value: employees.filter(e=>e.status==='active').length, color:'#8B5CF6' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Salary overview table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-secondary">Salary Overview</p>
          <p className="text-xs text-gray-400">Displaying annual salary bands · Not individual payslips</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee','Department','Job Title','Type','Annual Salary','Monthly Est.'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.filter(e => e.status === 'active').map(e => (
                <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.name} size="xs" />
                      <span className="text-sm font-medium text-secondary">{e.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{e.department}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{e.jobTitle}</td>
                  <td className="px-4 py-3"><Badge variant="neutral" size="xs">{EMPLOYMENT_TYPE_LABELS[e.employmentType]}</Badge></td>
                  <td className="px-4 py-3 text-sm font-medium text-secondary">£{e.salary.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">£{Math.round(e.salary/12).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
