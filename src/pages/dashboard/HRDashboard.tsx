import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import EmployeePortalDashboard from '../portal/EmployeeDashboard'
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Star, Clock, CalendarDays, Briefcase, Users, X, CheckCircle2, Calendar, Check, Award } from 'lucide-react'
import { Avatar } from '../../components/common/Avatar'
import { LEAVE_TYPE_LABELS } from '../../utils/constants'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useFirebaseTimesheets, fmt12, toYMD } from '../../hooks/useFirebaseTimesheets'
import { useFirebaseLeave } from '../../hooks/useFirebaseLeave'
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'

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

  const [clockedInCount, setClockedInCount] = useState(0)
  const [hrMarkedToday,  setHrMarkedToday]  = useState<{ status: string }[]>([])

  useEffect(() => {
    getDocs(query(collection(db, 'time_entries'), where('date', '==', todayStr), where('clockedIn', '==', true)))
      .then(s => setClockedInCount(s.size))
    getDocs(query(collection(db, 'attendance_records'), where('date', '==', todayStr)))
      .then(s => setHrMarkedToday(s.docs.map(d => d.data() as { status: string })))
  }, [todayStr])

  // ── Derived metrics ──────────────────────────────────────────────────
  const activeEmps     = employees.filter(e => e.status === 'active')
  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const newJoiners     = employees.filter(e => e.startDate >= thisMonthStart).length
  const onLeaveToday   = leaveRequests.filter(r =>
    r.status === 'approved' && r.startDate <= todayStr && r.endDate >= todayStr
  ).length
  const pendingList    = leaveRequests.filter(r => r.status === 'pending')
  const pendingApprovals = pendingList.length
  const probationDue   = activeEmps.filter(e => {
    if (!e.startDate) return false
    const probEnd = new Date(e.startDate)
    probEnd.setMonth(probEnd.getMonth() + 3)
    const diff = Math.round((probEnd.getTime() - today.getTime()) / 86_400_000)
    return diff >= 0 && diff <= 30
  }).length

  const hrLate       = hrMarkedToday.filter(r => r.status === 'late').length
  const hrAbsent     = hrMarkedToday.filter(r => r.status === 'absent').length
  const presentToday = clockedInCount
  const activeTotal  = activeEmps.length || 1
  const presentPct   = Math.round((presentToday / activeTotal) * 100)

  // Department breakdown
  const CHART_COLORS = ['#2E86C1','#10B981','#8B5CF6','#F59E0B','#EC4899','#F97316']
  const deptMap = new Map<string, number>()
  activeEmps.forEach(e => { if (e.department) deptMap.set(e.department, (deptMap.get(e.department) ?? 0) + 1) })
  const departments = Array.from(deptMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({ name, count, color: CHART_COLORS[i % CHART_COLORS.length] }))
  const totalDept = departments.reduce((s, d) => s + d.count, 0) || 1

  // Headcount trend (12 months)
  const headcount = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    return {
      m: d.toLocaleDateString('en-GB', { month: 'short' }),
      c: employees.filter(e => e.startDate && e.startDate <= monthEnd).length,
    }
  })
  const hcMax    = Math.max(...headcount.map(h => h.c), 1)
  const hcMin    = Math.min(...headcount.map(h => h.c), 0)
  const ytdDelta = headcount[headcount.length - 1].c - headcount[0].c

  // MOCK — replace with real shift_plans collection when ready
  const shifts = [
    { label: 'Night',   start: '22:00', end: '06:00', staffed: 14, need: 16, color: '#6366F1' },
    { label: 'Morning', start: '06:00', end: '14:00', staffed: 42, need: 40, color: '#10B981' },
    { label: 'Day',     start: '10:00', end: '18:00', staffed: 38, need: 38, color: '#2E86C1' },
    { label: 'Evening', start: '14:00', end: '22:00', staffed: 24, need: 28, color: '#F59E0B' },
  ]

  // MOCK — wire to real activity log later
  const activity = [
    { id: 'a1', kind: 'joined',   who: 'Jordan Reeves',  detail: 'started in Dispatch',              mins: 8   },
    { id: 'a2', kind: 'leave',    who: 'Marcus Obi',     detail: 'requested 2 days sick leave',      mins: 14  },
    { id: 'a3', kind: 'review',   who: 'Sarah Chen',     detail: 'completed Q1 performance review',  mins: 47  },
    { id: 'a4', kind: 'clockin',  who: 'Night shift',    detail: '18 staff clocked in',              mins: 62  },
    { id: 'a5', kind: 'training', who: 'James Mitchell', detail: 'completed De-escalation course',   mins: 95  },
    { id: 'a6', kind: 'warning',  who: 'Aisha Hussain',  detail: 'marked late (3rd this month)',     mins: 120 },
  ]

  const handleApprove = (id: string) => approveRequest(id, currentUser?.name ?? 'HR')
  const handleDecline = (id: string) => declineRequest(id, currentUser?.name ?? 'HR')
  const firstName = (currentUser?.name ?? 'there').split(' ')[0]

  const timeLabel = today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()

  const num = 'tabular-nums'

  return (
    <div className="space-y-4">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl p-7 text-white bg-[#12121E]">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(46,134,193,0.5), transparent 60%)' }} />
        <div className="absolute -bottom-16 right-24 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(244,114,182,0.3), transparent 60%)' }} />

        <div className="relative flex justify-between items-start gap-6 flex-wrap">
          <div>
            <div className="text-[11px] opacity-60 tracking-wider font-medium">{dateLabel} · {timeLabel}</div>
            <div className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mt-3">
              Morning, {firstName}.<br />
              <span className="text-[#5DADE2]">{activeTotal} people on the clock today.</span>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap text-sm">
              <span className="inline-flex items-center gap-1.5 bg-green-500/15 text-green-300 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
              </span>
              <span className="text-white/70">
                {presentToday} clocked in · {hrLate} late · {hrAbsent} absent
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            {[
              { l: 'Present',   v: presentPct,       sub: `${presentToday}/${activeTotal}`, c: '#10B981' },
              { l: 'Approvals', v: pendingApprovals, sub: 'waiting',                        c: '#F05A3E', raw: true },
              { l: 'Probation', v: probationDue,     sub: 'due 30d',                        c: '#F9A8D4', raw: true },
            ].map(r => (
              <div key={r.l} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-center">
                <Donut pct={r.raw ? 100 : r.v} size={66} stroke={6} color={r.c}>
                  <div className={`text-lg font-bold ${num}`}>
                    {r.v}{!r.raw && <span className="text-[10px] opacity-60">%</span>}
                  </div>
                </Donut>
                <div className="text-[11px] mt-2 font-semibold">{r.l}</div>
                <div className={`text-[10px] opacity-50 ${num}`}>{r.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-6 rounded-xl overflow-hidden grid grid-cols-4 gap-px bg-white/10">
          {[
            { l: 'New this month',    v: newJoiners,       c: '#6EE7B7' },
            { l: 'Approvals pending', v: pendingApprovals, c: '#FBBF24' },
            { l: 'Probation due',     v: probationDue,     c: '#F9A8D4' },
            { l: 'Leave today',       v: onLeaveToday,     c: '#93C5FD' },
          ].map(s => (
            <div key={s.l} className="bg-[#12121E] px-4 py-3.5">
              <div className="text-[10px] opacity-60 uppercase tracking-wide font-medium">{s.l}</div>
              <div className={`text-2xl font-bold mt-0.5 ${num}`} style={{ color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT: activity feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[11px] tracking-wide text-gray-400 uppercase font-semibold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                Live activity
              </div>
              <div className="text-base font-bold">What's happening</div>
            </div>
            <button onClick={() => navigate('/reports')} className="text-xs text-primary font-semibold hover:underline">
              Full log →
            </button>
          </div>
          <div className="flex flex-col">
            {activity.map(a => {
              const meta: Record<string, { c: string; bg: string; l: string }> = {
                joined:   { c: '#10B981', bg: '#E7F9F1', l: 'Joined'   },
                leave:    { c: '#8B5CF6', bg: '#F0ECFF', l: 'Leave'    },
                review:   { c: '#2E86C1', bg: '#E5F0F8', l: 'Review'   },
                clockin:  { c: '#10B981', bg: '#E7F9F1', l: 'Clock'    },
                training: { c: '#F59E0B', bg: '#FEF8E7', l: 'Training' },
                warning:  { c: '#EF4444', bg: '#FEF3F2', l: 'Warn'     },
              }
              const m = meta[a.kind] ?? meta.review
              return (
                <div key={a.id} className="py-2 flex items-center gap-3 border-b border-gray-50 last:border-0">
                  <div className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ background: m.bg, color: m.c }}>{m.l}</div>
                  <div className="flex-1 text-[13px] text-secondary">
                    <strong className="font-semibold">{a.who}</strong>{' '}
                    <span className="text-gray-500">{a.detail}</span>
                  </div>
                  <div className={`text-[11px] text-gray-400 ${num}`}>{a.mins}m</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Action list */}
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[11px] tracking-wide text-gray-400 uppercase font-semibold">Needs you</div>
              <div className="text-base font-bold">Action list</div>
            </div>
            {(pendingApprovals + probationDue) > 0 && (
              <span className={`bg-[#F05A3E] text-white text-[11px] font-bold px-2 py-0.5 rounded-full ${num}`}>
                {pendingApprovals + probationDue}
              </span>
            )}
          </div>

          {pendingApprovals > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex gap-2.5 items-center">
              <div className="w-9 h-9 rounded-lg bg-[#F05A3E] text-white flex items-center justify-center shrink-0">
                <Calendar size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">{pendingApprovals} leave request{pendingApprovals !== 1 ? 's' : ''}</div>
                <div className="text-[11px] text-gray-500">Awaiting your review</div>
              </div>
              <button onClick={() => navigate('/leave')} className="text-[11px] text-[#F05A3E] font-semibold">Review →</button>
            </div>
          )}

          {pendingList.slice(0, 3).map(lr => (
            <div key={lr.id} className="bg-gray-50 rounded-xl p-2.5 flex items-center gap-2.5">
              <InitialAvatar name={lr.employeeName ?? '?'} hue={hueFor(lr.employeeName ?? '')} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold truncate">{lr.employeeName}</div>
                <div className="text-[11px] text-gray-500">
                  {LEAVE_TYPE_LABELS[lr.type] ?? lr.type} · {lr.days}d
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleApprove(lr.id)}
                  className="w-7 h-7 rounded-lg bg-secondary text-white flex items-center justify-center hover:bg-black transition">
                  <Check size={13} />
                </button>
                <button onClick={() => handleDecline(lr.id)}
                  className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-500 flex items-center justify-center hover:bg-gray-50 transition">
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}

          {probationDue > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex gap-2.5 items-center">
              <div className="w-9 h-9 rounded-lg bg-violet-500 text-white flex items-center justify-center shrink-0">
                <Award size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">{probationDue} probation review{probationDue !== 1 ? 's' : ''} due</div>
                <div className="text-[11px] text-gray-500">Within 30 days</div>
              </div>
              <button onClick={() => navigate('/performance')} className="text-[11px] text-violet-600 font-semibold">Open →</button>
            </div>
          )}

          {pendingApprovals === 0 && probationDue === 0 && (
            <div className="text-center text-xs text-gray-400 py-6">All caught up — nothing on your desk.</div>
          )}
        </div>

        {/* Headcount */}
        <div className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] tracking-wide text-gray-400 uppercase font-semibold">Headcount</div>
              <div className={`text-xl font-bold mt-0.5 ${num}`}>
                {activeTotal}{' '}
                <span className={`text-[12px] font-semibold ${ytdDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {ytdDelta >= 0 ? '+' : ''}{ytdDelta} YTD
                </span>
              </div>
            </div>
            <button onClick={() => navigate('/reports')} className="text-[11px] text-primary font-semibold hover:underline">Report →</button>
          </div>
          <div className="flex items-end gap-1 h-32">
            {headcount.map((h, i) => {
              const pct = (h.c - hcMin) / Math.max(1, hcMax - hcMin)
              const hpx = 20 + pct * 90
              const latest = i === headcount.length - 1
              return (
                <div key={h.m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-md"
                    style={{ height: hpx, background: latest ? '#2E86C1' : '#E7E4DE' }} />
                  <div className={`text-[9px] text-gray-400 ${num}`}>{h.m}</div>
                </div>
              )
            })}
          </div>
        </div>


        {/* Shift coverage */}
        <div className="bg-[#12121E] text-white rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] tracking-wide opacity-60 uppercase font-semibold">Live shifts</div>
              <div className="text-base font-bold mt-0.5">Shift coverage</div>
            </div>
            <div className="text-[11px] opacity-60">Today</div>
          </div>
          <div className="flex flex-col gap-2.5 flex-1 justify-center">
            {shifts.map(s => {
              const pct  = Math.min(100, (s.staffed / s.need) * 100)
              const over = s.staffed >= s.need
              return (
                <div key={s.label}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <div className="flex items-center gap-2">
                      <strong className="font-semibold">{s.label}</strong>
                      <span className={`opacity-50 text-[11px] ${num}`}>{s.start}–{s.end}</span>
                    </div>
                    <div className={`font-bold ${num}`}>
                      <span style={{ color: over ? '#6EE7B7' : '#FCA5A5' }}>{s.staffed}</span>
                      <span className="opacity-40">/{s.need}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="text-[10px] opacity-40 italic">Placeholder data · wire to shift_plans when ready</div>
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
