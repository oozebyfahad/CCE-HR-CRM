import { useState } from 'react'
import { GraduationCap, CheckCircle2, Clock, AlertTriangle, Award, BookOpen, ExternalLink, Shield } from 'lucide-react'
import { mockCourses, mockEnrolments } from '../../utils/mockData'
import { useAppSelector } from '../../store'
import { useMyEmployee } from '../../hooks/useMyEmployee'

const STATUS_CONFIG = {
  completed:   { label: 'Completed',   bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2,  dot: 'bg-emerald-500' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Clock,         dot: 'bg-blue-500'    },
  overdue:     { label: 'Overdue',     bg: 'bg-red-100',     text: 'text-red-700',     icon: AlertTriangle, dot: 'bg-red-500'     },
  enrolled:    { label: 'Enrolled',    bg: 'bg-purple-100',  text: 'text-purple-700',  icon: BookOpen,      dot: 'bg-purple-500'  },
  not_started: { label: 'Not Started', bg: 'bg-gray-100',    text: 'text-gray-600',    icon: Clock,         dot: 'bg-gray-400'    },
}

const CATEGORY_COLORS: Record<string, string> = {
  'Health & Safety': '#EF4444',
  'Compliance':      '#8B5CF6',
  'Skills':          '#2E86C1',
  'Systems':         '#10B981',
  'Wellbeing':       '#F59E0B',
}

export default function MyTraining() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employee: myEmployee } = useMyEmployee(currentUser?.email)

  const [filter, setFilter] = useState<'all' | 'mandatory' | 'completed' | 'overdue'>('all')

  const myEnrolments = mockEnrolments.filter(e => e.employeeName === myEmployee?.name || e.employeeId === myEmployee?.employeeId)

  const allCourses = mockCourses.map(course => {
    const enrolment = myEnrolments.find(e => e.courseId === course.id)
    return { ...course, enrolment }
  })

  const filtered = allCourses.filter(c => {
    if (filter === 'mandatory')  return c.mandatory
    if (filter === 'completed')  return c.enrolment?.status === 'completed'
    if (filter === 'overdue')    return c.enrolment?.status === 'overdue'
    return true
  })

  const completedCount = allCourses.filter(c => c.enrolment?.status === 'completed').length
  const overdueCount   = allCourses.filter(c => c.enrolment?.status === 'overdue').length
  const mandatoryDone  = allCourses.filter(c => c.mandatory && c.enrolment?.status === 'completed').length
  const mandatoryTotal = allCourses.filter(c => c.mandatory).length
  const overallPct     = allCourses.length ? Math.round((completedCount / allCourses.length) * 100) : 0

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #0f1a0f 0%, #0a1a14 50%, #0f1629 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.4), transparent 65%)' }} />
        <div className="absolute bottom-0 left-8 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 65%)' }} />

        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full mb-4">
              <GraduationCap size={12} className="text-emerald-400" />
              <span className="text-emerald-300 text-[11px] font-semibold tracking-wide">TRAINING & DEVELOPMENT</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">My Training</h1>
            <p className="text-white/50 text-sm mt-2">Complete mandatory courses and develop your skills.</p>
          </div>

          {/* Overall progress ring */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
            <div className="relative w-16 h-16">
              <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                <circle cx="32" cy="32" r="24" fill="none" stroke="#10B981" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - overallPct / 100)}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{overallPct}%</span>
              </div>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wide">Overall Progress</p>
              <p className="text-white font-bold mt-0.5">{completedCount} / {allCourses.length} courses</p>
              {overdueCount > 0 && (
                <p className="text-red-400 text-[11px] mt-1 font-medium">{overdueCount} overdue</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="relative mt-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Completed',         value: String(completedCount),              color: '#10B981' },
            { label: 'Mandatory Done',    value: `${mandatoryDone}/${mandatoryTotal}`, color: '#F59E0B' },
            { label: 'Overdue',           value: String(overdueCount),                color: overdueCount > 0 ? '#EF4444' : '#6B7280' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Overdue Training</p>
            <p className="text-xs text-red-700 mt-0.5">
              You have {overdueCount} overdue course(s). Please complete them as soon as possible.
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([['all','All Courses'], ['mandatory','Mandatory'], ['completed','Completed'], ['overdue','Overdue']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              filter === v ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* Course cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map(course => {
          const enrol  = course.enrolment
          const status = (enrol?.status ?? 'not_started') as keyof typeof STATUS_CONFIG
          const cfg    = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
          const StatusIcon = cfg.icon
          const catColor   = CATEGORY_COLORS[course.category] ?? '#6B7280'

          return (
            <div key={course.id}
              className="card p-5 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group">
              {/* Top */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                  style={{ background: `${catColor}18`, color: catColor }}>
                  <GraduationCap size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-bold text-secondary leading-tight">{course.title}</p>
                    {course.mandatory && (
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full shrink-0">MANDATORY</span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium mt-1" style={{ color: catColor }}>{course.category}</p>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-4">
                <span className="flex items-center gap-1"><Clock size={10} /> {course.duration}</span>
                <span>·</span>
                <span>{course.provider}</span>
              </div>

              {/* Progress bar for in_progress */}
              {enrol && enrol.status === 'in_progress' && (
                <div className="mb-4">
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '45%' }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">In progress — enrolled {enrol.enrolledDate}</p>
                </div>
              )}

              {enrol?.completedDate && (
                <div className="mb-4 flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  <Award size={12} />
                  Completed {enrol.completedDate}
                  {enrol.score && <span className="ml-auto font-bold">{enrol.score}%</span>}
                </div>
              )}

              {enrol?.expiryDate && (
                <div className="mb-4 text-[10px] text-gray-400 flex items-center gap-1">
                  <Shield size={10} className="text-gray-300" />
                  Certificate expires: {enrol.expiryDate}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                  <StatusIcon size={11} />
                  {cfg.label}
                </div>
                {enrol?.status === 'completed' && (
                  <button className="flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold">
                    <ExternalLink size={11} /> Certificate
                  </button>
                )}
                {(!enrol || enrol.status === 'not_started') && (
                  <button className="text-[11px] text-primary hover:underline font-semibold">Enrol →</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
