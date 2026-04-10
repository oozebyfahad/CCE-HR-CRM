import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { UserPlus, FileText, CheckCircle2, Megaphone, ClipboardList, AlertTriangle } from 'lucide-react'
import { KPICard } from '../../components/common/KPICard'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import {
  headcountTrend, departmentData, employmentTypeData,
  weeklyAttendance, mockLeaveRequests, mockNotifications,
} from '../../utils/mockData'
import { LEAVE_TYPE_LABELS } from '../../utils/constants'

// ── KPIs ──────────────────────────────────────────────────────────────
const KPI_DATA = [
  { label: 'Total Headcount',     value: '247', sub: '+3 this month',    subColor: '#10B981', accentColor: '#2E86C1' },
  { label: 'New Joiners',         value: '8',   sub: 'This month',       subColor: '#10B981', accentColor: '#10B981' },
  { label: 'On Leave Today',      value: '12',  sub: 'View calendar',    subColor: '#F59E0B', accentColor: '#F59E0B' },
  { label: 'Open Vacancies',      value: '5',   sub: '3 urgent',         subColor: '#EF4444', accentColor: '#8B5CF6' },
  { label: 'Pending Approvals',   value: '14',  sub: 'Needs action',     subColor: '#EF4444', accentColor: '#EF4444' },
  { label: 'Probation Due',       value: '6',   sub: 'Next 30 days',     subColor: '#F59E0B', accentColor: '#F97316' },
  { label: 'Expiring Contracts',  value: '3',   sub: 'Within 60 days',   subColor: '#EF4444', accentColor: '#EC4899' },
  { label: 'Overdue Reviews',     value: '2',   sub: 'Past due date',    subColor: '#EF4444', accentColor: '#EF4444' },
]

// ── Attendance stats ──────────────────────────────────────────────────
const ATTEND_TODAY = [
  { label: 'Present',  value: 198, color: '#10B981' },
  { label: 'On Leave', value: 12,  color: '#2E86C1' },
  { label: 'Absent',   value: 8,   color: '#EF4444' },
  { label: 'Late',     value: 29,  color: '#F59E0B' },
]
const TOTAL = ATTEND_TODAY.reduce((s, a) => s + a.value, 0)

// ── Activity feed ─────────────────────────────────────────────────────
const ACTIVITY = [
  { msg: 'New hire added: James Mitchell',         time: '2m ago',  color: '#10B981' },
  { msg: 'Leave approved: Sarah Chen (3 days)',    time: '15m ago', color: '#2E86C1' },
  { msg: 'Review overdue: Tom Baker',              time: '1h ago',  color: '#EF4444' },
  { msg: 'Document uploaded: A. Patel contract',  time: '3h ago',  color: '#8B5CF6' },
  { msg: 'Probation end due: Emma Wilson (7d)',    time: '5h ago',  color: '#F59E0B' },
]

// ── Performance snapshot ──────────────────────────────────────────────
const PERF_ITEMS = [
  { label: 'Reviews Done', value: '87%',        color: '#10B981' },
  { label: 'Goals Met',    value: '72%',        color: '#F59E0B' },
  { label: 'On PIPs',      value: '4 staff',    color: '#EF4444' },
  { label: 'Top Performer',value: 'J. Mitchell', color: '#2E86C1' },
]

export default function HRDashboard() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5">

      {/* ── System alert banner ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 font-medium">
          3 right-to-work documents expiring in 14 days &nbsp;•&nbsp; 2 overdue probation reviews &nbsp;•&nbsp; DBS check required: J. Mitchell
        </p>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {KPI_DATA.map(k => (
          <KPICard key={k.label} {...k} onClick={() => {}} />
        ))}
      </div>

      {/* ── Charts row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Headcount trend */}
        <div className="card p-5 lg:col-span-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Headcount Trend</p>
              <p className="text-xs text-gray-400">Rolling 12 months</p>
            </div>
            <button onClick={() => navigate('/reports')} className="text-xs text-primary hover:underline">View report →</button>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={headcountTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2E86C1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2E86C1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[210, 255]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="count" stroke="#2E86C1" strokeWidth={2} fill="url(#grad)" dot={{ r: 3, fill: '#2E86C1' }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Department doughnut */}
        <div className="card p-5 lg:col-span-3">
          <p className="text-sm font-semibold text-secondary mb-1">By Department</p>
          <p className="text-xs text-gray-400 mb-3">Active headcount</p>
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={departmentData} innerRadius={30} outerRadius={48} dataKey="value" paddingAngle={2}>
                  {departmentData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 flex-1">
              {departmentData.map(d => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-gray-500">{d.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-secondary">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Employment types */}
        <div className="card p-5 lg:col-span-3">
          <p className="text-sm font-semibold text-secondary mb-1">Employment Types</p>
          <p className="text-xs text-gray-400 mb-4">Current workforce</p>
          <div className="space-y-3">
            {employmentTypeData.map(e => (
              <div key={e.type}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-500">{e.type}</span>
                  <span className="text-xs font-semibold text-secondary">{e.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${e.pct * 100}%`, backgroundColor: e.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Weekly attendance bar ─────────────────────────────────────── */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-secondary mb-4">Weekly Attendance Overview</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={weeklyAttendance} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barSize={16} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="present" name="Present" fill="#2E86C1" radius={[4,4,0,0]} />
            <Bar dataKey="absent"  name="Absent"  fill="#EF4444" radius={[4,4,0,0]} />
            <Bar dataKey="late"    name="Late"    fill="#F59E0B" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Bottom row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Today's Attendance */}
        <div className="card p-5 lg:col-span-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Today's Attendance</p>
              <p className="text-xs text-gray-400">Thu 10 Apr 2026</p>
            </div>
            <button onClick={() => navigate('/attendance')} className="text-xs text-primary hover:underline">Details →</button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {ATTEND_TODAY.map(a => (
              <div key={a.label} className="rounded-xl p-2.5 text-center" style={{ backgroundColor: `${a.color}12` }}>
                <p className="text-xl font-bold" style={{ color: a.color }}>{a.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{a.label}</p>
              </div>
            ))}
          </div>

          {/* Stacked bar */}
          <div className="flex h-2 rounded-full overflow-hidden mb-2">
            {ATTEND_TODAY.map(a => (
              <div key={a.label} style={{ width: `${(a.value / TOTAL) * 100}%`, backgroundColor: a.color }} />
            ))}
          </div>
          <p className="text-xs font-medium text-secondary">Attendance Rate: <span className="text-green-600">80.2%</span> <span className="text-gray-400 font-normal">▲ +1.3% vs last week</span></p>

          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-xs font-semibold text-secondary mb-2">Late Arrivals Today</p>
            {[['J. Mitchell','09:22'],['A. Hussain','09:31'],['N. Reeves','09:47']].map(([n,t]) => (
              <div key={n} className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-600">{n}</span>
                <span className="text-xs font-medium text-amber-600">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Requests */}
        <div className="card p-5 lg:col-span-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Leave Requests</p>
              <p className="text-xs text-gray-400">Pending approval</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">4</span>
              <button onClick={() => navigate('/leave')} className="text-xs text-primary hover:underline">All →</button>
            </div>
          </div>

          <div className="space-y-2.5">
            {mockLeaveRequests.filter(l => l.status === 'pending').map(lr => (
              <div key={lr.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={lr.employeeName} size="xs" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-secondary truncate">{lr.employeeName}</p>
                    <p className="text-[10px] text-gray-400">{lr.days}d · {LEAVE_TYPE_LABELS[lr.type]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors">✓</button>
                  <button className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors">✗</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance + Activity */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Performance */}
          <div className="card p-5 flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-secondary">Performance</p>
                <p className="text-xs text-gray-400">Q1 2026 review cycle</p>
              </div>
              <button onClick={() => navigate('/performance')} className="text-xs text-primary hover:underline">Details →</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary-50 flex flex-col items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary leading-none">7.8</span>
                <span className="text-[9px] text-gray-400">/10</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1">
                {PERF_ITEMS.map(p => (
                  <div key={p.label}>
                    <p className="text-[10px] text-gray-400">{p.label}</p>
                    <p className="text-xs font-bold" style={{ color: p.color }}>{p.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div className="card p-5 flex-1">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-semibold text-secondary">Recent Activity</p>
              <span className="text-xs text-primary hover:underline cursor-pointer">View all →</span>
            </div>
            <div className="space-y-2.5">
              {ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: a.color }} />
                  <div>
                    <p className="text-xs text-secondary leading-snug">{a.msg}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-secondary">Quick Actions</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: '+ Add Employee',    color: 'btn-primary',  path: '/employees'   },
              { label: '📋 Post Vacancy',   color: 'btn-outline',  path: '/recruitment' },
              { label: '✓ Approve Requests',color: 'btn-success',  path: '/leave'       },
              { label: '📊 Reports',        color: 'btn-outline',  path: '/reports'     },
            ].map(q => (
              <button key={q.label} onClick={() => navigate(q.path)} className={`${q.color} text-xs`}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
