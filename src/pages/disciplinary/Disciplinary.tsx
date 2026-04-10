import { useState } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { mockDisciplinary } from '../../utils/mockData'

const TYPE_LABELS: Record<string, string> = {
  verbal_warning: 'Verbal Warning', written_warning: 'Written Warning',
  final_warning: 'Final Warning', suspension: 'Suspension', dismissal: 'Dismissal',
}
const TYPE_COLORS: Record<string, string> = {
  verbal_warning: 'warning', written_warning: 'orange', final_warning: 'danger',
  suspension: 'danger', dismissal: 'danger',
}

export default function Disciplinary() {
  const [cases, setCases] = useState(mockDisciplinary)

  const open = cases.filter(c => c.status === 'open').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Disciplinary & Grievance</h2>
          <p className="page-sub">{open} open cases</p>
        </div>
        <button className="btn-primary text-sm gap-2"><Shield size={14}/> Log Incident</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Open Cases',    value: cases.filter(c=>c.status==='open').length,     color:'#EF4444' },
          { label:'Resolved',      value: cases.filter(c=>c.status==='resolved').length, color:'#10B981' },
          { label:'Under Appeal',  value: cases.filter(c=>c.status==='appealed').length, color:'#F59E0B' },
          { label:'This Month',    value: 2,                                              color:'#2E86C1' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Important note */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          All disciplinary records are confidential and access-restricted per RBAC policy. These logs are retained for 7 years per UK employment law. Every action here is captured in the audit trail.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-secondary">Case Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Employee','Dept','Type','Date','Reason','Issued By','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cases.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={c.employeeName} size="xs" />
                      <span className="text-sm font-medium text-secondary">{c.employeeName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.department}</td>
                  <td className="px-4 py-3">
                    <Badge variant={TYPE_COLORS[c.type] as any} size="xs">{TYPE_LABELS[c.type]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(c.date).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{c.reason}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.issuedBy}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(c.status)} size="xs" dot>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
