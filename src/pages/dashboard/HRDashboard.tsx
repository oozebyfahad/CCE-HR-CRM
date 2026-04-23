import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import EmployeePortalDashboard from '../portal/EmployeeDashboard'
import {
  LineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Star, Clock, CalendarDays, Briefcase, Users, X, CheckCircle2,
  Calendar, Check, Award, TrendingUp, TrendingDown, UserCheck,
  UserMinus, Activity, ArrowUpRight, Zap, AlertTriangle, Gift, Trophy,
} from 'lucide-react'
import { Avatar } from '../../components/common/Avatar'
import { LEAVE_TYPE_LABELS } from '../../utils/constants'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useFirebaseTimesheets, fmt12, toYMD } from '../../hooks/useFirebaseTimesheets'
import { useFirebaseLeave } from '../../hooks/useFirebaseLeave'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import {
  fetchRotaShifts, fetchRotaAttendance,
  type RotaShift, type RotaAttendance,
} from '../../services/rotacloud'
import { unixToHHMM } from '../../hooks/useRotaAttendance'

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

// ── Admin dashboard helpers ───────────────────────────────────────────

function Donut({
  pct, size = 70, stroke = 7, color = '#10B981', track = 'rgba(255,255,255,0.1)',
  children,
}: {
  pct: number; size?: number; stroke?: number; color?: string; track?: string;
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - Math.max(0, Math.min(100, pct)) / 100 * c
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
}

function InitialAvatar({ name, hue = 210, size = 32 }: { name: string; hue?: number; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div
      className="flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size, height: size, borderRadius: size,
        background: `oklch(0.86 0.08 ${hue})`,
        color: `oklch(0.32 0.08 ${hue})`,
        fontSize: size * 0.38,
      }}
    >{initials}</div>
  )
}

const hueFor = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

// ── Admin / HR dashboard ──────────────────────────────────────────────
function AdminDashboard() {
  const navigate    = useNavigate()
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees } = useFirebaseEmployees()
  const { requests: leaveRequests, approveRequest, declineRequest } = useFirebaseLeave()

  const today    = new Date()
  const todayStr = toYMD(today)
  const firstName = (currentUser?.name ?? 'there').split(' ')[0]

  type ShiftEmp = { name: string; jobTitle: string; dept: string; since: string; isClockedIn: boolean }
  const [shiftEmps,    setShiftEmps]    = useState<ShiftEmp[]>([])
  const [hrMarkedToday, setHrMarkedToday] = useState<{ status: string }[]>([])

  useEffect(() => {
    if (!employees.length) return
    const now        = Math.floor(Date.now() / 1000)
    const todayStart = Math.floor(new Date(todayStr + 'T00:00:00').getTime() / 1000)
    const todayEnd   = Math.floor(new Date(todayStr + 'T23:59:59').getTime() / 1000)

    Promise.all([
      fetchRotaShifts(todayStart, todayEnd),
      fetchRotaAttendance(todayStart, todayEnd),
    ]).then(([shifts, attendance]) => {
      const rotaShifts     = shifts     as RotaShift[]
      const rotaAttendance = attendance as RotaAttendance[]

      // Active shifts right now
      const activeShifts = rotaShifts.filter(s =>
        !s.deleted && s.published && !s.open &&
        s.start_time <= now && s.end_time >= now
      )

      // Who is actually clocked in
      const clockedInMap = new Map<number, RotaAttendance>()
      rotaAttendance
        .filter(a => !a.deleted && a.in_time_clocked && !a.out_time_clocked)
        .forEach(a => clockedInMap.set(a.user, a))

      const items: ShiftEmp[] = activeShifts
        .map(s => {
          const emp     = employees.find(e => e.rotacloudId === s.user)
          if (!emp) return null
          const attRec  = clockedInMap.get(s.user)
          const hhmm    = attRec?.in_time_clocked ? unixToHHMM(attRec.in_time_clocked) : undefined
          return {
            name:        emp.name,
            jobTitle:    emp.jobTitle,
            dept:        emp.department ?? '',
            since:       hhmm ? fmt12(hhmm) : '',
            isClockedIn: !!attRec,
          }
        })
        .filter((x): x is ShiftEmp => x !== null)

      setShiftEmps(items)

      // Late / absent derived from RotaCloud attendance
      const lateRecs   = rotaAttendance.filter(a => !a.deleted && a.minutes_late > 30 && a.hours > 0)
      const nowMinus30 = now - 30 * 60
      const absentRecs = activeShifts.filter(s => s.start_time < nowMinus30 && !clockedInMap.has(s.user))
      setHrMarkedToday([
        ...lateRecs.map(  () => ({ status: 'late'   })),
        ...absentRecs.map(() => ({ status: 'absent' })),
      ])
    }).catch(() => {})
  }, [todayStr, employees.length])

  // ── Derived ──────────────────────────────────────────────────────────
  const activeEmps     = employees.filter(e => e.status === 'active')
  const activeTotal    = activeEmps.length
  const departed       = employees.filter(e => e.status === 'terminated' || e.status === 'resigned').length
  const totalEver      = employees.length || 1
  const retentionRate  = Math.round((activeTotal / totalEver) * 100)

  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const prevMonthDate  = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthStart = prevMonthDate.toISOString().slice(0, 10)
  const prevMonthEnd   = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10)
  const newJoiners     = employees.filter(e => e.startDate >= thisMonthStart).length
  const prevJoiners    = employees.filter(e => e.startDate >= prevMonthStart && e.startDate <= prevMonthEnd).length
  const joinerDelta    = newJoiners - prevJoiners

  const onLeaveToday   = leaveRequests.filter(r =>
    r.status === 'approved' && r.startDate <= todayStr && r.endDate >= todayStr
  ).length
  const pendingList      = leaveRequests.filter(r => r.status === 'pending')
  const pendingApprovals = pendingList.length
  const recentLeave      = leaveRequests.filter(r => r.status === 'approved').slice(0, 3)

  const hrLate   = hrMarkedToday.filter(r => r.status === 'late').length
  const hrAbsent = hrMarkedToday.filter(r => r.status === 'absent').length

  // Headcount trend (12 months) for chart
  const headcountTrend = Array.from({ length: 12 }, (_, i) => {
    const d        = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    const label    = d.toLocaleDateString('en-GB', { month: 'short' })
    return {
      m: label,
      active: employees.filter(e => e.startDate && e.startDate <= monthEnd && (e.status === 'active' || e.startDate <= monthEnd)).length,
    }
  })
  const ytdDelta = headcountTrend[headcountTrend.length - 1].active - headcountTrend[0].active

  // Department breakdown
  const DEPT_COLORS = ['#2E86C1','#10B981','#8B5CF6','#F59E0B','#EC4899','#F97316','#06B6D4']
  const deptMap = new Map<string, number>()
  activeEmps.forEach(e => { if (e.department) deptMap.set(e.department, (deptMap.get(e.department) ?? 0) + 1) })
  const departments = Array.from(deptMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({ name, count, color: DEPT_COLORS[i % DEPT_COLORS.length] }))
  const totalDeptCount = departments.reduce((s, d) => s + d.count, 0) || 1

  // ── People Alerts (next 14 days) ─────────────────────────────────────
  const ALERT_WINDOW = 14
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const certExpiring = activeEmps
    .filter(e => e.characterCertificateExpiry)
    .map(e => {
      const expiry    = new Date(e.characterCertificateExpiry!)
      const daysUntil = Math.round((expiry.getTime() - todayMidnight.getTime()) / 86400000)
      return { emp: e, daysUntil }
    })
    .filter(x => x.daysUntil >= 0 && x.daysUntil <= ALERT_WINDOW)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const getAnnualEvents = (field: 'dob' | 'startDate') =>
    activeEmps
      .filter(e => e[field])
      .map(e => {
        const raw        = e[field] as string
        const [yr, mm, dd] = raw.split('-').map(Number)
        let candidate    = new Date(todayMidnight.getFullYear(), mm - 1, dd)
        if (candidate < todayMidnight) candidate = new Date(todayMidnight.getFullYear() + 1, mm - 1, dd)
        const daysUntil  = Math.round((candidate.getTime() - todayMidnight.getTime()) / 86400000)
        const yearCount  = candidate.getFullYear() - yr
        return { emp: e, daysUntil, yearCount }
      })
      .filter(x => x.daysUntil >= 0 && x.daysUntil <= ALERT_WINDOW)
      .sort((a, b) => a.daysUntil - b.daysUntil)

  const upcomingBirthdays     = getAnnualEvents('dob')
  const upcomingAnniversaries = getAnnualEvents('startDate')

  // Mock performance — wire to performance collection when ready
  const PERF_MOCK = [
    { name: 'Sarah Khan',    score: 9.2, trend: +0.3 },
    { name: 'Ahmed Raza',    score: 8.7, trend: +0.1 },
    { name: 'Omar Hassan',   score: 8.4, trend: +0.5 },
    { name: 'Zara Malik',    score: 7.9, trend: -0.2 },
    { name: 'Kamran Sheikh', score: 7.6, trend:  0.0 },
  ]

  const handleApprove = (id: string) => approveRequest(id, currentUser?.name ?? 'HR')
  const handleDecline = (id: string) => declineRequest(id, currentUser?.name ?? 'HR')

  const num = 'tabular-nums'
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // ── KPI tile helper ─────────────────────────────────────────────────
  function KPI({ icon: Icon, label, value, sub, color, onClick }: {
    icon: React.ElementType; label: string; value: number | string
    sub: string; color: string; onClick?: () => void
  }) {
    return (
      <button onClick={onClick}
        className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 text-left hover:shadow-md transition-shadow group">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: color + '18' }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{label}</p>
          <p className={`text-xl font-bold text-gray-900 leading-tight ${num}`}>{value}</p>
          <p className="text-[11px] text-gray-400 leading-snug">{sub}</p>
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #2E3B8B 50%, #1D6FA4 100%)' }}>
        {/* decorative blobs */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #818CF8, transparent 70%)' }} />
        <div className="absolute bottom-0 right-32 w-32 h-32 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #34D399, transparent 70%)' }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/60 font-medium">{dateLabel}</p>
            <p className="text-2xl font-bold mt-0.5 tracking-tight">
              {greeting}, {firstName}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-green-400/20 text-green-300 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
              </span>
              <span className="text-white/60 text-[13px]">
                {shiftEmps.length} on shift · {shiftEmps.filter(e => e.isClockedIn).length} clocked in · {hrLate} late · {hrAbsent} absent · {onLeaveToday} on leave
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { l: 'Headcount',  v: activeTotal,      c: '#6EE7B7' },
              { l: 'On Shift',   v: shiftEmps.length, c: '#93C5FD' },
              { l: 'Pending',    v: pendingApprovals, c: '#FCA5A5' },
              { l: 'New / Month',v: newJoiners,        c: '#C4B5FD' },
            ].map(s => (
              <div key={s.l} className="bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-center min-w-[64px]">
                <p className={`text-xl font-bold ${num}`} style={{ color: s.c }}>{s.v}</p>
                <p className="text-[10px] text-white/50 mt-0.5 font-medium">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPI icon={Users}      label="Active Staff"    value={activeTotal}      sub={`+${ytdDelta} YTD`}             color="#2E86C1" onClick={() => navigate('/employees')} />
        <KPI icon={Zap}        label="On Shift Now"    value={shiftEmps.length} sub="Clocked in today"               color="#10B981" onClick={() => navigate('/attendance')} />
        <KPI icon={CalendarDays} label="Leave Today"   value={onLeaveToday}     sub="Approved absences"              color="#8B5CF6" onClick={() => navigate('/leave')} />
        <KPI icon={UserCheck}  label="New This Month"  value={newJoiners}       sub={joinerDelta >= 0 ? `+${joinerDelta} vs last month` : `${joinerDelta} vs last month`} color="#F59E0B" onClick={() => navigate('/employees')} />
        <KPI icon={Award}      label="Pending Approvals" value={pendingApprovals} sub="Leave requests"              color="#EF4444" onClick={() => navigate('/leave')} />
      </div>

      {/* ── ROW A: Turnover + Leave Requests ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Workforce / Turnover (2/3) */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Workforce</p>
              <p className="text-base font-bold text-gray-900">Employee Turnover & Headcount</p>
            </div>
            <button onClick={() => navigate('/reports')} className="text-[11px] text-primary font-semibold hover:underline">Full report →</button>
          </div>

          {/* Turnover stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: Users, label: 'Active Headcount', value: activeTotal,
                sub: `${ytdDelta >= 0 ? '+' : ''}${ytdDelta} YTD`,
                up: ytdDelta >= 0, color: '#2E86C1',
              },
              {
                icon: UserMinus, label: 'Departed (All Time)', value: departed,
                sub: `${Math.round((departed / totalEver) * 100)}% turnover rate`,
                up: false, color: '#EF4444',
              },
              {
                icon: TrendingUp, label: 'Retention Rate', value: `${retentionRate}%`,
                sub: 'Active vs total ever',
                up: retentionRate >= 80, color: '#10B981',
              },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{s.label}</p>
                  <s.icon size={13} style={{ color: s.color }} />
                </div>
                <p className={`text-2xl font-bold ${num}`} style={{ color: s.color }}>{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* 12-month headcount area chart */}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mb-2">12-Month Headcount Trend</p>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={headcountTrend} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <defs>
                  <linearGradient id="hcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2E86C1" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2E86C1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  formatter={(v: number) => [v, 'Headcount']}
                />
                <Area type="monotone" dataKey="active" stroke="#2E86C1" strokeWidth={2.5}
                  fill="url(#hcGrad)" dot={false} activeDot={{ r: 5, fill: '#2E86C1' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Joined this month vs last */}
          <div className="flex items-center gap-4 pt-1 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[12px] text-gray-600 font-medium">
                <span className={`font-bold ${num}`}>{newJoiners}</span> joined this month
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              {joinerDelta > 0
                ? <><ArrowUpRight size={13} className="text-emerald-500" /><span className="text-emerald-600 font-semibold">+{joinerDelta} vs last month</span></>
                : joinerDelta < 0
                  ? <><ArrowUpRight size={13} className="text-red-400 rotate-90" /><span className="text-red-500 font-semibold">{joinerDelta} vs last month</span></>
                  : <span className="text-gray-400">Same as last month</span>
              }
            </div>
          </div>
        </div>

        {/* Leave Requests (1/3) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Leave Requests</p>
              <p className="text-base font-bold text-gray-900">Pending Approval</p>
            </div>
            {pendingApprovals > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                {pendingApprovals}
              </span>
            )}
          </div>

          {pendingList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <Check size={18} className="text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">All caught up</p>
              <p className="text-xs text-gray-400">No pending requests</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 flex-1">
              {pendingList.slice(0, 5).map(lr => (
                <div key={lr.id} className="group flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <InitialAvatar name={lr.employeeName ?? '?'} hue={hueFor(lr.employeeName ?? '')} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{lr.employeeName}</p>
                    <p className="text-[11px] text-gray-400">
                      {LEAVE_TYPE_LABELS[lr.type] ?? lr.type}
                      {' · '}
                      <span className="font-medium text-gray-600">{lr.days}d</span>
                      {' · '}
                      <span>{lr.startDate}</span>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleApprove(lr.id)}
                      title="Approve"
                      className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition">
                      <Check size={12} />
                    </button>
                    <button onClick={() => handleDecline(lr.id)}
                      title="Decline"
                      className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {pendingList.length > 5 && (
                <button onClick={() => navigate('/leave')}
                  className="text-[11px] text-primary font-semibold text-center py-2 hover:underline">
                  +{pendingList.length - 5} more — view all →
                </button>
              )}
            </div>
          )}

          {recentLeave.length > 0 && (
            <div className="mt-auto pt-3 border-t border-gray-50">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-2">Recently approved</p>
              {recentLeave.map(r => (
                <div key={r.id} className="flex items-center gap-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[11px] text-gray-500 truncate">{r.employeeName}</span>
                  <span className="text-[11px] text-gray-400 ml-auto shrink-0">{r.days}d</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PEOPLE ALERTS ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Reminders</p>
            <p className="text-base font-bold text-gray-900">
              People Alerts
              <span className="text-sm font-normal text-gray-400 ml-2">next 14 days</span>
            </p>
          </div>
          {(certExpiring.length + upcomingBirthdays.length + upcomingAnniversaries.length) > 0 && (
            <span className="bg-amber-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full tabular-nums">
              {certExpiring.length + upcomingBirthdays.length + upcomingAnniversaries.length}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* Certificate Expiry */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle size={13} className="text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Certificate Expiry</p>
              {certExpiring.length > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{certExpiring.length}</span>
              )}
            </div>
            {certExpiring.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">All certificates valid.</p>
            ) : (
              <div className="space-y-1.5">
                {certExpiring.map(({ emp, daysUntil }) => (
                  <div key={emp.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-amber-50">
                    <InitialAvatar name={emp.name} hue={hueFor(emp.name)} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-900 truncate">{emp.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{emp.jobTitle}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums ${
                      daysUntil === 0 ? 'bg-red-500 text-white' :
                      daysUntil <= 3  ? 'bg-orange-100 text-orange-700' :
                                        'bg-amber-100 text-amber-700'
                    }`}>
                      {daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Birthdays */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-pink-50 rounded-lg flex items-center justify-center shrink-0">
                <Gift size={13} className="text-pink-500" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Birthdays</p>
              {upcomingBirthdays.length > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full">{upcomingBirthdays.length}</span>
              )}
            </div>
            {upcomingBirthdays.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">No birthdays in the next 14 days.</p>
            ) : (
              <div className="space-y-1.5">
                {upcomingBirthdays.map(({ emp, daysUntil }) => (
                  <div key={emp.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-pink-50">
                    <InitialAvatar name={emp.name} hue={hueFor(emp.name)} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-900 truncate">{emp.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{emp.jobTitle}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums ${
                      daysUntil === 0 ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-700'
                    }`}>
                      {daysUntil === 0 ? 'Today' : `in ${daysUntil}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Work Anniversaries */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
                <Trophy size={13} className="text-violet-500" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Work Anniversaries</p>
              {upcomingAnniversaries.length > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{upcomingAnniversaries.length}</span>
              )}
            </div>
            {upcomingAnniversaries.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">No anniversaries in the next 14 days.</p>
            ) : (
              <div className="space-y-1.5">
                {upcomingAnniversaries.map(({ emp, daysUntil, yearCount }) => (
                  <div key={emp.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-violet-50">
                    <InitialAvatar name={emp.name} hue={hueFor(emp.name)} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-900 truncate">{emp.name}</p>
                      <p className="text-[11px] text-gray-400">{yearCount} yr{yearCount !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums ${
                      daysUntil === 0 ? 'bg-violet-500 text-white' : 'bg-violet-100 text-violet-700'
                    }`}>
                      {daysUntil === 0 ? 'Today' : `in ${daysUntil}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── ROW B: On Shift | Performance | Departments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* On Shift Now */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Live</p>
              <p className="text-base font-bold text-gray-900">On Shift Now</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {shiftEmps.length} on shift · {shiftEmps.filter(e => e.isClockedIn).length} in
            </div>
          </div>

          {shiftEmps.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
              <Clock size={28} className="text-gray-200" />
              <p className="text-sm text-gray-400">No active shifts right now</p>
              <p className="text-[11px] text-gray-300">Scheduled shifts will appear here</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-64">
              {shiftEmps.map((e, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="relative shrink-0">
                    <InitialAvatar name={e.name} hue={hueFor(e.name)} size={34} />
                    {e.isClockedIn && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{e.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{e.jobTitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {e.since
                      ? <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">In {e.since}</span>
                      : <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Not clocked in</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/attendance')}
            className="mt-3 pt-3 border-t border-gray-50 text-[11px] text-primary font-semibold hover:underline text-center">
            View full attendance →
          </button>
        </div>

        {/* Performance */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Performance</p>
              <p className="text-base font-bold text-gray-900">Top Performers</p>
            </div>
            <button onClick={() => navigate('/performance')} className="text-[11px] text-primary font-semibold hover:underline">
              View all →
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {PERF_MOCK.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                  {i + 1}
                </div>
                <InitialAvatar name={p.name} hue={hueFor(p.name)} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-900 truncate">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${(p.score / 10) * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[13px] font-bold ${num} text-gray-800`}>{p.score}</span>
                  {p.trend > 0
                    ? <TrendingUp size={11} className="text-emerald-500" />
                    : p.trend < 0
                      ? <TrendingDown size={11} className="text-red-400" />
                      : <Activity size={11} className="text-gray-300" />
                  }
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-3 border-t border-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-400">Avg team score</span>
              <span className={`text-sm font-bold text-violet-600 ${num}`}>
                {(PERF_MOCK.reduce((s, p) => s + p.score, 0) / PERF_MOCK.length).toFixed(1)}/10
              </span>
            </div>
            <p className="text-[10px] text-gray-300 mt-0.5 italic">Mock data — wire to performance module</p>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Departments</p>
              <p className="text-base font-bold text-gray-900">Headcount Split</p>
            </div>
            <button onClick={() => navigate('/employees')} className="text-[11px] text-primary font-semibold hover:underline">
              Employees →
            </button>
          </div>

          {departments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No department data yet.</p>
          ) : (
            <>
              {/* Segmented bar */}
              <div className="flex h-2.5 rounded-full overflow-hidden mb-4 gap-px">
                {departments.map(d => (
                  <div key={d.name}
                    title={`${d.name}: ${d.count}`}
                    style={{ width: `${(d.count / totalDeptCount) * 100}%`, background: d.color }} />
                ))}
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                {departments.map(d => (
                  <div key={d.name} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-[12.5px] font-medium text-gray-700 flex-1 truncate">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(d.count / totalDeptCount) * 100}%`, background: d.color }} />
                      </div>
                      <span className={`text-[12px] font-bold text-gray-700 w-4 text-right ${num}`}>{d.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between">
            <span className="text-[11px] text-gray-400">Total active</span>
            <span className={`text-[12px] font-bold text-gray-800 ${num}`}>{activeTotal}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Team Lead dashboard ───────────────────────────────────────────────
function TeamLeadDashboard({ name }: { name: string }) {
  const navigate = useNavigate()
  const currentUser = useAppSelector(s => s.auth.user)
  const { requests: leaveRequests, approveRequest, declineRequest } = useFirebaseLeave()
  const pendingTeamLeave = leaveRequests.filter(r => r.status === 'pending').slice(0, 3)
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
          {pendingTeamLeave.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No pending requests.</p>
            ) : (
            <div className="space-y-3">
              {pendingTeamLeave.map(lr => (
                <div key={lr.id} className="pb-2.5 border-b border-gray-50 last:border-0">
                  <p className="text-xs font-medium text-secondary truncate">{lr.employeeName}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{lr.days}d · {LEAVE_TYPE_LABELS[lr.type] ?? lr.type}</p>
                  <div className="flex gap-1 mt-1.5">
                    <button onClick={() => approveRequest(lr.id, currentUser?.name ?? 'Team Lead')}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors">Approve</button>
                    <button onClick={() => declineRequest(lr.id, currentUser?.name ?? 'Team Lead')}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-colors">Decline</button>
                  </div>
                </div>
              ))}
            </div>
            )}
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
    let diffM      = liveTime.getHours() * 60 + liveTime.getMinutes() - sh * 60 - sm
    if (diffM < 0) diffM += 24 * 60   // overnight session
    liveHours += diffM / 60
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
  if (role === 'employee')  return <EmployeePortalDashboard />
  return <AdminDashboard />   // admin and hr both see the full dashboard
}
