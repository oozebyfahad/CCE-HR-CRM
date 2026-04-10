import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Building2, User, Edit } from 'lucide-react'
import { useAppSelector } from '../../store'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS } from '../../utils/constants'
import { mockReviews, mockEnrolments, mockLeaveRequests } from '../../utils/mockData'

export default function EmployeeProfile() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const emp      = useAppSelector(s => s.employees.employees.find(e => e.id === id))

  if (!emp) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-gray-500">Employee not found.</p>
      <button onClick={() => navigate('/employees')} className="btn-primary text-sm">← Back to Directory</button>
    </div>
  )

  const reviews  = mockReviews.filter(r => r.employeeId === emp.employeeId)
  const training = mockEnrolments.filter(t => t.employeeId === emp.employeeId)
  const leaves   = mockLeaveRequests.filter(l => l.employeeId === emp.employeeId)

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Back */}
      <button onClick={() => navigate('/employees')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-secondary transition-colors">
        <ArrowLeft size={15} /> Back to Directory
      </button>

      {/* Profile header */}
      <div className="card p-6 flex flex-wrap items-start gap-6">
        <Avatar name={emp.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-secondary">{emp.name}</h2>
            <Badge variant={statusVariant(emp.status)} dot>{STATUS_LABELS[emp.status]}</Badge>
            {emp.probationStatus === 'in_probation' && <Badge variant="warning" size="xs">In Probation</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{emp.jobTitle} · {emp.department}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{emp.employeeId}</p>
          <div className="flex flex-wrap gap-4 mt-3">
            {[[Mail, emp.email], [Phone, emp.phone], [Building2, emp.department], [User, `Reports to: ${emp.manager}`]].map(([Icon, val], i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                {/* @ts-ignore */}
                <Icon size={12} className="text-gray-400" />
                <span>{val as string}</span>
              </div>
            ))}
          </div>
        </div>
        <button className="btn-outline text-sm gap-2"><Edit size={14} /> Edit Profile</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Employment details */}
        <div className="card p-5">
          <p className="section-title">Employment Details</p>
          <dl className="space-y-2.5">
            {[
              ['Employment Type',  EMPLOYMENT_TYPE_LABELS[emp.employmentType]],
              ['Contract Type',    emp.contractType?.replace('_', ' ') ?? '—'],
              ['Start Date',       new Date(emp.startDate).toLocaleDateString('en-GB')],
              ['Contract End',     emp.contractEndDate ? new Date(emp.contractEndDate).toLocaleDateString('en-GB') : 'N/A'],
              ['Probation Status', emp.probationStatus?.replace('_', ' ') ?? '—'],
              ['Probation End',    emp.probationEndDate ? new Date(emp.probationEndDate).toLocaleDateString('en-GB') : 'N/A'],
              ['Salary Band',      `£${emp.salary.toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-2">
                <dt className="text-xs text-gray-400 shrink-0">{k}</dt>
                <dd className="text-xs font-medium text-secondary text-right capitalize">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Leave summary */}
        <div className="card p-5">
          <p className="section-title">Leave History</p>
          {leaves.length === 0 ? (
            <p className="text-xs text-gray-400">No leave records found.</p>
          ) : (
            <div className="space-y-2">
              {leaves.map(l => (
                <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-secondary capitalize">{l.type} leave</p>
                    <p className="text-[10px] text-gray-400">{new Date(l.startDate).toLocaleDateString('en-GB')} · {l.days}d</p>
                  </div>
                  <Badge variant={statusVariant(l.status)} size="xs">{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Training */}
        <div className="card p-5">
          <p className="section-title">Training Record</p>
          {training.length === 0 ? (
            <p className="text-xs text-gray-400">No training records found.</p>
          ) : (
            <div className="space-y-2">
              {training.map(t => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-secondary">{t.courseTitle}</p>
                    <p className="text-[10px] text-gray-400">{t.enrolledDate}</p>
                  </div>
                  <Badge variant={statusVariant(t.status)} size="xs">{t.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance */}
        <div className="card p-5 lg:col-span-3">
          <p className="section-title">Performance Reviews</p>
          {reviews.length === 0 ? (
            <p className="text-xs text-gray-400">No reviews on record.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map(r => (
                <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-secondary">{r.reviewPeriod}</p>
                      <p className="text-xs text-gray-400">Reviewer: {r.reviewerName} · {new Date(r.reviewDate).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">{r.score}</span>
                      <span className="text-xs text-gray-400">/10</span>
                      <Badge variant={statusVariant(r.status)} size="xs">{r.status}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {r.goals.map(g => (
                      <div key={g.id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-xs text-secondary">{g.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${g.progress}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0">{g.progress}%</span>
                          </div>
                        </div>
                        <Badge variant={statusVariant(g.status)} size="xs">{g.status.replace('_',' ')}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
