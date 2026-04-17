import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { AlertTriangle, Star, Clock, CalendarDays, Briefcase, Users, X, CheckCircle2 } from 'lucide-react'
import { KPICard } from '../../components/common/KPICard'
import { Avatar } from '../../components/common/Avatar'
import {
  headcountTrend, departmentData, employmentTypeData,
  weeklyAttendance, mockLeaveRequests,
} from '../../utils/mockData'
import { LEAVE_TYPE_LABELS } from '../../utils/constants'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useFirebaseTimesheets, fmt12, toYMD } from '../../hooks/useFirebaseTimesheets'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'

// ── Admin / HR KPIs ───────────────────────────────────────────────────
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

const ATTEND_TODAY = [
  { label: 'Present',  value: 198, color: '#10B981' },
  { label: 'On Leave', value: 12,  color: '#2E86C1' },
  { label: 'Absent',   value: 8,   color: '#EF4444' },
  { label: 'Late',     value: 29,  color: '#F59E0B' },
]
const TOTAL = ATTEND_TODAY.reduce((s, a) => s + a.value, 0)

const ACTIVITY = [
  { msg: 'New hire added: James Mitchell',         time: '2m ago',  color: '#10B981' },
  { msg: 'Leave approved: Sarah Chen (3 days)',    time: '15m ago', color: '#2E86C1' },
  { msg: 'Review overdue: Tom Baker',              time: '1h ago',  color: '#EF4444' },
  { msg: 'Document uploaded: A. Patel contract',  time: '3h ago',  color: '#8B5CF6' },
  { msg: 'Probation end due: Emma Wilson (7d)',    time: '5h ago',  color: '#F59E0B' },
]

const PERF_ITEMS = [
  { label: 'Reviews Done', value: '87%',         color: '#10B981' },
  { label: 'Goals Met',    value: '72%',         color: '#F59E0B' },
  { label: 'On PIPs',      value: '4 staff',     color: '#EF4444' },
  { label: 'Top Performer',value: 'J. Mitchell', color: '#2E86C1' },
]

// ── Team Lead mock data ───────────────────────────────────────────────
const TEAM_MEMBERS = [
  { name: 'Sarah Chen',     role: 'Dispatcher',   status: 'present', score: 8.4 },
  { name: 'James Mitchell', role: 'Call Handler',  status: 'present', score: 9.1 },
  { name: 'Aisha Hussain',  role: 'Dispatcher',   status: 'late',    score: 7.6 },
  { name: 'Tom Baker',      role: 'Call Handler',  status: 'absent',  score: 6.8 },
  { name: 'Emma Wilson',    role: 'Coordinator',   status: 'leave',   score: 8.0 },
]

const TEAM_ATTEND_STATS = [
  { label: 'Present', value: 3, color: '#10B981' },
  { label: 'Late',    value: 1, color: '#F59E0B' },
  { label: 'Absent',  value: 1, color: '#EF4444' },
  { label: 'On Leave',value: 1, color: '#2E86C1' },
]

const TEAM_PERF_TREND = [
  { week: 'W1', avg: 7.2 }, { week: 'W2', avg: 7.8 }, { week: 'W3', avg: 7.5 },
  { week: 'W4', avg: 8.1 }, { week: 'W5', avg: 8.3 }, { week: 'W6', avg: 8.0 },
]

// ── Employee mock data ────────────────────────────────────────────────
const MY_ATTEND = [
  { label: 'Present',  value: 18, color: '#10B981' },
  { label: 'Absent',   value: 1,  color: '#EF4444' },
  { label: 'Late',     value: 3,  color: '#F59E0B' },
  { label: 'On Leave', value: 2,  color: '#2E86C1' },
]
const MY_ATTEND_WEEK = [
  { day: 'Mon', me: 1 }, { day: 'Tue', me: 1 }, { day: 'Wed', me: 0 },
  { day: 'Thu', me: 1 }, { day: 'Fri', me: 1 },
]

// ─────────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    present: 'bg-green-500',
    late:    'bg-amber-500',
    absent:  'bg-red-500',
    leave:   'bg-blue-500',
  }
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] ?? 'bg-gray-300'}`} />
}

// ── Admin / HR dashboard ──────────────────────────────────────────────
function AdminDashboard() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 font-medium">
          3 right-to-work documents expiring in 14 days &nbsp;•&nbsp; 2 overdue probation reviews &nbsp;•&nbsp; DBS check required: J. Mitchell
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {KPI_DATA.map(k => <KPICard key={k.label} {...k} onClick={() => {}} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card p-5 lg:col-span-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Today's Attendance</p>
              <p className="text-xs text-gray-400">Live overview</p>
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
          <div className="flex h-2 rounded-full overflow-hidden mb-2">
            {ATTEND_TODAY.map(a => (
              <div key={a.label} style={{ width: `${(a.value / TOTAL) * 100}%`, backgroundColor: a.color }} />
            ))}
          </div>
          <p className="text-xs font-medium text-secondary">Rate: <span className="text-green-600">80.2%</span> <span className="text-gray-400 font-normal">▲ +1.3% vs last week</span></p>
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

        <div className="lg:col-span-4 flex flex-col gap-4">
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
          <div className="card p-5 flex-1">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-semibold text-secondary">Recent Activity</p>
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

      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-secondary">Quick Actions</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: '+ Add Employee',     color: 'btn-primary', path: '/employees'   },
              { label: '📋 Post Vacancy',    color: 'btn-outline', path: '/recruitment' },
              { label: '✓ Approve Requests', color: 'btn-success', path: '/leave'       },
              { label: '📊 Reports',         color: 'btn-outline', path: '/reports'     },
            ].map(q => (
              <button key={q.label} onClick={() => navigate(q.path)} className={`${q.color} text-xs`}>{q.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Team Lead dashboard ───────────────────────────────────────────────
function TeamLeadDashboard({ name }: { name: string }) {
  const navigate = useNavigate()
  const teamTotal = TEAM_MEMBERS.length
  const present   = TEAM_MEMBERS.filter(m => m.status === 'present').length
  const avgScore  = (TEAM_MEMBERS.reduce((s, m) => s + m.score, 0) / teamTotal).toFixed(1)
  const onLeave   = TEAM_MEMBERS.filter(m => m.status === 'leave').length

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-800 rounded-2xl px-6 py-5 text-white">
        <p className="text-sm opacity-80">Welcome back,</p>
        <p className="text-xl font-bold mt-0.5">{name}</p>
        <p className="text-xs opacity-70 mt-1">Here's how your team is doing today.</p>
      </div>

      {/* Team KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Team Size',    value: teamTotal, sub: 'Total members',  color: '#2E86C1', bg: '#2E86C112' },
          { label: 'Present Today',value: present,   sub: `${teamTotal - present} away`, color: '#10B981', bg: '#10B98112' },
          { label: 'On Leave',     value: onLeave,   sub: 'This week',      color: '#F59E0B', bg: '#F59E0B12' },
          { label: 'Avg Score',    value: avgScore,  sub: 'Team performance',color: '#8B5CF6', bg: '#8B5CF612' },
        ].map(k => (
          <div key={k.label} className="card p-4 flex flex-col gap-1" style={{ borderLeft: `3px solid ${k.color}` }}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{k.label}</p>
            <p className="text-2xl font-bold text-secondary">{k.value}</p>
            <p className="text-[10px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Team members status */}
        <div className="card p-5 lg:col-span-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Team Members</p>
              <p className="text-xs text-gray-400">Today's status</p>
            </div>
            <button onClick={() => navigate('/attendance')} className="text-xs text-primary hover:underline">Attendance →</button>
          </div>
          <div className="space-y-2.5">
            {TEAM_MEMBERS.map(m => (
              <div key={m.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.name} size="xs" />
                  <div>
                    <p className="text-xs font-medium text-secondary">{m.name}</p>
                    <p className="text-[10px] text-gray-400">{m.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">{m.score}/10</span>
                  <StatusDot status={m.status} />
                  <span className="text-[10px] capitalize text-gray-400 w-14 text-right">{m.status === 'leave' ? 'On Leave' : m.status}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Attendance breakdown */}
          <div className="mt-4 pt-4 border-t border-gray-50">
            <div className="flex items-center gap-3 mb-2">
              {TEAM_ATTEND_STATS.map(s => (
                <div key={s.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] text-gray-500">{s.label}: <strong>{s.value}</strong></span>
                </div>
              ))}
            </div>
            <div className="flex h-2 rounded-full overflow-hidden">
              {TEAM_ATTEND_STATS.map(s => (
                <div key={s.label} style={{ width: `${(s.value / teamTotal) * 100}%`, backgroundColor: s.color }} />
              ))}
            </div>
          </div>
        </div>

        {/* Team performance trend */}
        <div className="card p-5 lg:col-span-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Team Performance</p>
              <p className="text-xs text-gray-400">6-week avg score trend</p>
            </div>
            <button onClick={() => navigate('/performance')} className="text-xs text-primary hover:underline">Full view →</button>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={TEAM_PERF_TREND} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[6, 10]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="avg" name="Avg Score" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4, fill: '#8B5CF6' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leave requests for team */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Leave Requests</p>
              <p className="text-xs text-gray-400">From your team</p>
            </div>
            <button onClick={() => navigate('/leave')} className="text-xs text-primary hover:underline">All →</button>
          </div>
          <div className="space-y-3">
            {mockLeaveRequests.filter(l => l.status === 'pending').slice(0, 3).map(lr => (
              <div key={lr.id} className="pb-2.5 border-b border-gray-50 last:border-0">
                <p className="text-xs font-medium text-secondary truncate">{lr.employeeName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{lr.days}d · {LEAVE_TYPE_LABELS[lr.type]}</p>
                <div className="flex gap-1 mt-1.5">
                  <button className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors">Approve</button>
                  <button className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-secondary">Quick Actions</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: '📋 Review Performance', path: '/performance' },
              { label: '📅 Approve Leave',       path: '/leave'       },
              { label: '📊 View Attendance',     path: '/attendance'  },
            ].map(q => (
              <button key={q.label} onClick={() => navigate(q.path)} className="btn-outline text-xs">{q.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Leave request modal ───────────────────────────────────────────────
const LEAVE_TYPES = [
  { v: 'annual',     l: 'Annual Leave'      },
  { v: 'sick',       l: 'Sick Leave'        },
  { v: 'toil',       l: 'TOIL'             },
  { v: 'unpaid',     l: 'Unpaid Leave'      },
  { v: 'maternity',  l: 'Maternity Leave'   },
  { v: 'paternity',  l: 'Paternity Leave'   },
  { v: 'compassionate', l: 'Compassionate'  },
]

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-800'

function LeaveRequestModal({ employeeName, employeeId, onClose }: {
  employeeName: string
  employeeId: string
  onClose: () => void
}) {
  const [type,      setType]      = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [reason,    setReason]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [done,      setDone]      = useState(false)

  const dayCount = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1)
    : 0

  const handleSubmit = async () => {
    if (!startDate || !endDate) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'leave_requests'), {
        employeeId,
        employeeName,
        type,
        startDate,
        endDate,
        days: dayCount,
        reason,
        status: 'pending',
        submittedAt: serverTimestamp(),
      })
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <CalendarDays size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Apply for Leave</p>
              <p className="text-xs text-gray-400">{employeeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400">
            <X size={15} />
          </button>
        </div>

        {done ? (
          /* Success state */
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <p className="text-base font-bold text-secondary">Request Submitted</p>
            <p className="text-xs text-gray-400">Your leave request has been sent for approval. You'll be notified once it's reviewed.</p>
            <button onClick={onClose} className="btn-primary text-sm mt-2 px-6">Done</button>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Leave Type</label>
                <select value={type} onChange={e => setType(e.target.value)} className={inp}>
                  {LEAVE_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]} className={inp} />
                </div>
              </div>

              {dayCount > 0 && (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
                  <span className="text-xs text-gray-500 font-medium">Duration</span>
                  <span className="text-sm font-bold text-primary">{dayCount} day{dayCount !== 1 ? 's' : ''}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Reason <span className="text-gray-300 normal-case font-normal">(optional)</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  rows={3} placeholder="Brief reason for leave…"
                  className={`${inp} resize-none`} />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <button onClick={onClose} className="btn-outline text-sm px-4">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={saving || !startDate || !endDate}
                className="btn-primary text-sm px-6 disabled:opacity-50">
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Circular ring SVG ────────────────────────────────────────────────
function Ring({ progress, color, size = 130, stroke = 11 }: { progress: number; color: string; size?: number; stroke?: number }) {
  const r      = (size - stroke * 2) / 2
  const cx     = size / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - Math.min(1, Math.max(0, progress)) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  )
}

// ── Mini calendar ─────────────────────────────────────────────────────
function MiniCalendar() {
  const today      = new Date()
  const year       = today.getFullYear()
  const month      = today.getMonth()
  const monthName  = today.toLocaleDateString('en-GB', { month: 'long' })
  const daysInMo   = new Date(year, month + 1, 0).getDate()
  const startDay   = new Date(year, month, 1).getDay()
  const DAY_HEADS  = ['S','M','T','W','T','F','S']

  return (
    <div>
      <p className="text-xs font-bold text-secondary text-center mb-2">{monthName} {year}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DAY_HEADS.map((d, i) => (
          <span key={i} className="text-[9px] text-gray-400 font-semibold">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {Array(startDay).fill(null).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: daysInMo }, (_, i) => i + 1).map(d => (
          <button key={d}
            className={`w-full aspect-square text-[10px] rounded-full flex items-center justify-center mx-auto transition-colors
              ${d === today.getDate() ? 'bg-primary text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Employee dashboard ────────────────────────────────────────────────
function EmployeeDashboard({ name }: { name: string }) {
  const navigate    = useNavigate()
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees } = useFirebaseEmployees()
  const [liveTime,    setLiveTime]    = useState(new Date())
  const [clockingIn,  setClockingIn]  = useState(false)
  const [leaveModal,  setLeaveModal]  = useState(false)

  const myEmployee = employees.find(e => e.email === currentUser?.email)

  const {
    entries, currentlyClockedIn, clockIn, clockOut,
  } = useFirebaseTimesheets(myEmployee?.id ?? '')

  // Tick every second for live timer
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Today's totals
  const todayYMD     = toYMD(new Date())
  const todayEntries = entries.filter(e => e.date === todayYMD)
  const loggedHours  = todayEntries.filter(e => !e.clockedIn).reduce((s, e) => s + e.hours, 0)

  // Live duration (logged + current session)
  let liveHours = loggedHours
  if (currentlyClockedIn?.startTime) {
    const [sh, sm] = currentlyClockedIn.startTime.split(':').map(Number)
    const diffM    = liveTime.getHours() * 60 + liveTime.getMinutes() - sh * 60 - sm
    liveHours     += Math.max(0, diffM / 60)
  }

  const TARGET = 8
  const ringPct = Math.min(1, liveHours / TARGET)
  const hrs  = Math.floor(liveHours)
  const mins = Math.floor((liveHours - hrs) * 60)
  const secs = currentlyClockedIn ? liveTime.getSeconds() : 0
  const liveStr = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`

  const firstIn  = todayEntries.length > 0 ? todayEntries[todayEntries.length - 1]?.startTime : undefined
  const lastOut  = todayEntries.find(e => e.endTime && !e.clockedIn)?.endTime
  const punchIn  = currentlyClockedIn?.startTime ?? firstIn
  const punchOut = lastOut

  const greeting = (() => {
    const h = liveTime.getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  })()
  const firstName = name.split(' ')[0]

  const handleClockIn = async () => {
    setClockingIn(true)
    try { await clockIn() } finally { setClockingIn(false) }
  }

  // Leave totals (mock — same as before)
  const leaveUsed  = 8
  const leaveTotal = 20
  const leaveLeft  = leaveTotal - leaveUsed

  const QUICK_STATUS = [
    {
      icon: Briefcase, label: 'Project',
      sub: 'Customer Service Operations',
      note: '', noteColor: '',
    },
    {
      icon: CalendarDays, label: 'Leave',
      sub: 'Annual leave · 12 days left',
      note: 'Active', noteColor: 'text-green-600',
    },
    {
      icon: Star, label: 'Holiday',
      sub: 'Next public holiday',
      note: 'Good Friday · 18 Apr', noteColor: 'text-primary',
    },
    {
      icon: Users, label: 'Team',
      sub: 'Team standup at 09:30',
      note: 'Today', noteColor: 'text-amber-600',
    },
  ]

  return (
    <div className="space-y-4">

      {/* ── Row 1: Attendance | Greeting | Calendar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Attendance ring card */}
        <div className="lg:col-span-3 card p-5 flex flex-col items-center gap-4">
          <p className="text-sm font-bold text-secondary self-start">Attendance</p>

          {/* Ring */}
          <div className="relative flex items-center justify-center">
            <Ring progress={ringPct} color="#2E86C1" size={140} stroke={12} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-bold text-secondary font-mono leading-tight">{liveStr}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Working Hours</p>
            </div>
            {/* dot on ring end */}
            {ringPct > 0 && (
              <div className="absolute w-3 h-3 rounded-full bg-primary border-2 border-white shadow"
                style={{
                  top: `calc(50% - ${Math.sin((ringPct * 2 * Math.PI) - Math.PI / 2) * 58}px - 6px)`,
                  left: `calc(50% + ${Math.cos((ringPct * 2 * Math.PI) - Math.PI / 2) * 58}px - 6px)`,
                }} />
            )}
          </div>

          {/* Punch times */}
          <div className="w-full bg-secondary rounded-xl px-4 py-3 flex justify-between items-center">
            <div className="text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-medium">Punch in</p>
              <p className="text-sm font-bold text-white mt-0.5">{punchIn ? fmt12(punchIn) : '--:--'}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-medium">Punch out</p>
              <p className="text-sm font-bold text-white mt-0.5">{punchOut ? fmt12(punchOut) : '--:--'}</p>
            </div>
          </div>

          {/* Clock in/out button */}
          {currentlyClockedIn ? (
            <button
              onClick={() => clockOut(currentlyClockedIn.id, currentlyClockedIn.startTime!)}
              className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2">
              <Clock size={14} /> Punch Out
            </button>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={clockingIn}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
              <Clock size={14} /> {clockingIn ? 'Clocking in…' : 'Punch In'}
            </button>
          )}
        </div>

        {/* Greeting card */}
        <div className="lg:col-span-5 card overflow-hidden relative flex flex-col justify-between p-6" style={{ minHeight: 220 }}>
          {/* Background decoration */}
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-5 bg-primary" />
          <div className="absolute -right-4 top-8 w-28 h-28 rounded-full opacity-[0.07] bg-primary" />

          <div>
            <p className="text-sm text-gray-400">Hi, {firstName}</p>
            <p className="text-2xl font-bold text-secondary mt-0.5">{greeting}</p>
            <p className="text-xs text-gray-400 mt-1">
              {currentlyClockedIn
                ? `You've been working for ${liveStr} today.`
                : liveHours > 0
                  ? `You logged ${String(hrs).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m today.`
                  : "Don't forget to punch in when you start work."}
            </p>
          </div>

          {/* Illustration placeholder */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-4xl">💻</span>
              </div>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {currentlyClockedIn ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Clocked In
              </span>
            ) : (
              <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">Not Clocked In</span>
            )}
            <span className="text-xs font-semibold bg-blue-50 text-primary px-3 py-1 rounded-full">
              {leaveLeft} leave days left
            </span>
          </div>
        </div>

        {/* Calendar card */}
        <div className="lg:col-span-4 card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-secondary">Calendar</p>
            <button onClick={() => navigate('/leave')} className="text-xs text-primary hover:underline">Leave →</button>
          </div>
          <MiniCalendar />
          <div className="flex gap-1.5 mt-3 flex-wrap">
            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">At work</span>
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">On leave</span>
            <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full cursor-pointer hover:bg-gray-200 transition"
              onClick={() => navigate('/leave')}>+ Request</span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Quick status | Leave stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Quick status 2×2 */}
        <div className="lg:col-span-8 grid grid-cols-2 gap-4">
          <p className="col-span-2 text-sm font-bold text-secondary -mb-1">Quick status</p>
          {QUICK_STATUS.map(({ icon: Icon, label, sub, note, noteColor }) => (
            <div key={label} className="card p-4 flex items-start gap-3 overflow-hidden relative">
              {/* decorative circle */}
              <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full opacity-[0.08] bg-primary" />
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={15} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-secondary">{label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</p>
                {note && <p className={`text-[11px] font-semibold mt-0.5 ${noteColor}`}>{note}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Leave stats */}
        <div className="lg:col-span-4 card p-5 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between">
            <p className="text-sm font-bold text-secondary">Leave stats</p>
          </div>

          {/* Leave ring */}
          <div className="relative flex items-center justify-center">
            <Ring progress={leaveLeft / leaveTotal} color="#2E86C1" size={110} stroke={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold text-secondary leading-tight">{leaveLeft}</p>
              <p className="text-[10px] text-gray-400">Days left</p>
            </div>
          </div>

          <p className="text-xl font-bold text-secondary">{leaveLeft}/{leaveTotal}</p>

          <button
            onClick={() => setLeaveModal(true)}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl transition">
            Apply for leave
          </button>
        </div>
      </div>

      {/* Leave request modal */}
      {leaveModal && (
        <LeaveRequestModal
          employeeName={name}
          employeeId={myEmployee?.id ?? ''}
          onClose={() => setLeaveModal(false)}
        />
      )}
    </div>
  )
}

// ── Root export — picks dashboard by role ─────────────────────────────
export default function HRDashboard() {
  const user = useAppSelector(s => s.auth.user)
  const role = user?.role
  const name = user?.name ?? 'User'

  if (role === 'team_lead') return <TeamLeadDashboard name={name} />
  if (role === 'employee')  return <EmployeeDashboard  name={name} />
  return <AdminDashboard />   // admin and hr both see the full dashboard
}
