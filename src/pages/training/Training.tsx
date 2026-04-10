import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { mockCourses, mockEnrolments } from '../../utils/mockData'
import { BookOpen, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

export default function Training() {
  const completed  = mockEnrolments.filter(e => e.status === 'completed').length
  const overdue    = mockEnrolments.filter(e => e.status === 'overdue').length
  const inProgress = mockEnrolments.filter(e => e.status === 'in_progress').length
  const mandatory  = mockCourses.filter(c => c.mandatory).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Training & Development</h2>
          <p className="page-sub">{mockCourses.length} courses · {mandatory} mandatory</p>
        </div>
        <button className="btn-primary text-sm">+ Add Course</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Completed',  value: completed,  Icon: CheckCircle2,  color:'#10B981' },
          { label:'In Progress',value: inProgress, Icon: Clock,          color:'#2E86C1' },
          { label:'Overdue',    value: overdue,    Icon: AlertTriangle,  color:'#EF4444' },
          { label:'Mandatory',  value: mandatory,  Icon: BookOpen,       color:'#F59E0B' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor:`${s.color}15` }}>
              <s.Icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-secondary">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Course catalogue */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-secondary">Course Catalogue</p>
          </div>
          <div className="divide-y divide-gray-50">
            {mockCourses.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-secondary">{c.title}</p>
                    {c.mandatory && <Badge variant="danger" size="xs">Mandatory</Badge>}
                  </div>
                  <p className="text-xs text-gray-400">{c.category} · {c.duration} · {c.provider}</p>
                </div>
                <button className="btn-outline text-xs px-2 py-1">Enrol</button>
              </div>
            ))}
          </div>
        </div>

        {/* Enrolments */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-secondary">Recent Enrolments</p>
          </div>
          <div className="divide-y divide-gray-50">
            {mockEnrolments.map(e => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={e.employeeName} size="xs" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">{e.employeeName}</p>
                    <p className="text-xs text-gray-400 truncate">{e.courseTitle}</p>
                    {e.expiryDate && <p className="text-[10px] text-amber-600">Expires: {new Date(e.expiryDate).toLocaleDateString('en-GB')}</p>}
                  </div>
                </div>
                <Badge variant={statusVariant(e.status)} size="xs">{e.status.replace('_',' ')}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
