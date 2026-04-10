import { Badge, statusVariant } from '../../components/common/Badge'
import { mockVacancies, mockApplicants } from '../../utils/mockData'
import { EMPLOYMENT_TYPE_LABELS } from '../../utils/constants'
import { Plus, Users } from 'lucide-react'

const STAGE_LABELS: Record<string, string> = { applied:'Applied', screening:'Screening', interview:'Interview', offer:'Offer Made', hired:'Hired', rejected:'Rejected' }
const STAGE_COLORS: Record<string, string> = { applied:'neutral', screening:'info', interview:'primary', offer:'warning', hired:'success', rejected:'danger' }

export default function Recruitment() {
  const openVacancies = mockVacancies.filter(v => v.stage === 'open')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Recruitment</h2>
          <p className="page-sub">{openVacancies.length} open vacancies · {mockApplicants.length} active applicants</p>
        </div>
        <button className="btn-primary text-sm gap-2"><Plus size={14}/> Post Vacancy</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Open Roles',   value: openVacancies.length,                          color:'#2E86C1' },
          { label:'Applications', value: mockApplicants.length,                         color:'#10B981' },
          { label:'Interviews',   value: mockApplicants.filter(a=>a.stage==='interview').length, color:'#F59E0B' },
          { label:'Offers Out',   value: mockApplicants.filter(a=>a.stage==='offer').length,     color:'#8B5CF6' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Vacancies */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-secondary">Active Vacancies</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Role','Department','Type','Salary','Posted','Closing','Applications','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mockVacancies.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-secondary">{v.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{v.department}</td>
                  <td className="px-4 py-3"><Badge variant="neutral" size="xs">{EMPLOYMENT_TYPE_LABELS[v.type]}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{v.salary}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(v.postedDate).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(v.closingDate).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5"><Users size={12} className="text-gray-400"/><span className="text-sm font-medium text-secondary">{v.applications}</span></div>
                  </td>
                  <td className="px-4 py-3"><Badge variant={v.stage === 'open' ? 'success' : 'neutral'} size="xs" dot>{v.stage}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Applicants pipeline */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-secondary">Applicant Pipeline</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Applicant','Role','Applied','Stage','Score'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mockApplicants.map(a => {
                const vacancy = mockVacancies.find(v => v.id === a.vacancyId)
                return (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-secondary">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{vacancy?.title ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(a.appliedDate).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STAGE_COLORS[a.stage] as any} size="xs">{STAGE_LABELS[a.stage]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {a.score ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width:`${a.score}%` }} />
                          </div>
                          <span className="text-xs font-medium text-secondary">{a.score}%</span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
