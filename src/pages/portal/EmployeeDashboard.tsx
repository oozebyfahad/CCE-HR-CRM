import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'
import {
  Clock, CalendarDays, CreditCard, User,
  X, CheckCircle2, Megaphone, AlertTriangle, Bell, Info, QrCode,
  DollarSign, ScrollText,
} from 'lucide-react'
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { useFirebaseTimesheets, fmt12, toYMD, fmtHours, weekMonday } from '../../hooks/useFirebaseTimesheets'
import { useFirebaseLeave } from '../../hooks/useFirebaseLeave'
import { QRCodeSVG } from 'qrcode.react'

interface Notice {
  id: string
  title: string
  content: string
  priority: 'urgent' | 'important' | 'general'
  postedBy: string
  pinned?: boolean
  createdAt: { seconds: number } | null
}

const NOTICE_PRIORITY = {
  urgent:    { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',   dot: 'bg-red-500',   icon: AlertTriangle },
  important: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', icon: Bell          },
  general:   { bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',  dot: 'bg-blue-400',  icon: Info          },
}

// ── SVG ring ─────────────────────────────────────────────────────────
function Ring({
  progress, color, size = 140, stroke = 12,
  track = '#F0F4F8',
}: {
  progress: number; color: string; size?: number; stroke?: number; track?: string
}) {
  const r    = (size - stroke * 2) / 2
  const cx   = size / 2
  const circ = 2 * Math.PI * r
  const off  = circ - Math.min(1, Math.max(0, progress)) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={track}  strokeWidth={stroke} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
    </svg>
  )
}

// ── Mini donut for leave balance ──────────────────────────────────────
function MiniDonut({
  used, total, color, label,
}: {
  used: number; total: number; color: string; label: string
}) {
  const remaining = Math.max(0, total - used)
  const pct       = total > 0 ? remaining / total : 0
  const size      = 68
  const stroke    = 7
  const r         = (size - stroke * 2) / 2
  const circ      = 2 * Math.PI * r
  const off       = circ - Math.min(1, Math.max(0, pct)) * circ
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-secondary leading-none">{remaining}</span>
          <span className="text-[9px] text-gray-400">left</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-secondary">{label}</p>
        <p className="text-[10px] text-gray-400">{used}/{total} used</p>
      </div>
    </div>
  )
}

// ── Mini calendar ─────────────────────────────────────────────────────
function MiniCalendar({ leaveDates }: { leaveDates: Set<string> }) {
  const today     = new Date()
  const year      = today.getFullYear()
  const month     = today.getMonth()
  const monthName = today.toLocaleDateString('en-GB', { month: 'long' })
  const daysInMo  = new Date(year, month + 1, 0).getDate()
  const startDay  = new Date(year, month, 1).getDay()
  const HEADS     = ['S','M','T','W','T','F','S']

  return (
    <div>
      <p className="text-xs font-bold text-secondary text-center mb-2">{monthName} {year}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {HEADS.map((d, i) => (
          <span key={i} className="text-[9px] text-gray-400 font-semibold">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {Array(startDay).fill(null).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: daysInMo }, (_, i) => i + 1).map(d => {
          const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const isToday = d === today.getDate()
          const isLeave = leaveDates.has(ds)
          return (
            <button key={d}
              className={`w-full aspect-square text-[10px] rounded-full flex items-center justify-center mx-auto transition-colors
                ${isToday  ? 'bg-primary text-white font-bold'
                : isLeave  ? 'bg-blue-100 text-blue-600 font-semibold'
                           : 'text-gray-600 hover:bg-gray-100'}`}>
              {d}
            </button>
          )
        })}
      </div>
      <div className="flex gap-3 mt-2 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[9px] text-gray-500">Today</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-100 border border-blue-300" />
          <span className="text-[9px] text-gray-500">Leave</span>
        </div>
      </div>
    </div>
  )
}

// ── Leave modal ───────────────────────────────────────────────────────
const LEAVE_TYPES = [
  { v: 'annual',        l: 'Annual Leave'    },
  { v: 'sick',          l: 'Sick Leave'      },
  { v: 'toil',          l: 'TOIL'            },
  { v: 'unpaid',        l: 'Unpaid Leave'    },
  { v: 'maternity',     l: 'Maternity Leave' },
  { v: 'paternity',     l: 'Paternity Leave' },
  { v: 'compassionate', l: 'Compassionate'   },
]

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-800'

function LeaveModal({
  name, employeeId, onClose,
}: { name: string; employeeId: string; onClose: () => void }) {
  const [type,      setType]      = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [reason,    setReason]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [done,      setDone]      = useState(false)

  const dayCount = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1)
    : 0

  const submit = async () => {
    if (!startDate || !endDate) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'leave_requests'), {
        employeeId, employeeName: name, type, startDate, endDate,
        days: dayCount, reason, status: 'pending', submittedAt: serverTimestamp(),
      })
      setDone(true)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <CalendarDays size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Apply for Leave</p>
              <p className="text-xs text-gray-400">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        {done ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <p className="text-base font-bold text-secondary">Request Submitted</p>
            <p className="text-xs text-gray-400">Your leave request has been sent for approval.</p>
            <button onClick={onClose} className="btn-primary text-sm mt-2 px-6">Done</button>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Leave Type</label>
                <select value={type} onChange={e => setType(e.target.value)} className={inp}>
                  {LEAVE_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Start</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">End</label>
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
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Reason <span className="text-gray-300 normal-case font-normal">(optional)</span>
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  rows={3} placeholder="Brief reason…" className={`${inp} resize-none`} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <button onClick={onClose} className="btn-outline text-sm px-4">Cancel</button>
              <button onClick={submit} disabled={saving || !startDate || !endDate}
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

// ── Main employee portal dashboard ────────────────────────────────────
export default function EmployeeDashboard() {
  const navigate    = useNavigate()
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees } = useFirebaseEmployees()
  const { requests: allLeave } = useFirebaseLeave()
  const [liveTime,   setLiveTime]   = useState(new Date())
  const [clockingIn, setClockingIn] = useState(false)
  const [leaveModal, setLeaveModal] = useState(false)

  const myEmployee = employees.find(e => e.email === currentUser?.email)
  const { entries, currentlyClockedIn, clockIn, clockOut } =
    useFirebaseTimesheets(myEmployee?.id ?? '')

  const [notices, setNotices] = useState<Notice[]>([])
  const [showQr,  setShowQr]  = useState(false)

  // Tick every second
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Latest notices
  useEffect(() => {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(3))
    return onSnapshot(q, snap => {
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)))
    })
  }, [])

  // Today's hours
  const todayYMD    = toYMD(new Date())
  const todayEntries = entries.filter(e => e.date === todayYMD)
  const loggedHours  = todayEntries.filter(e => !e.clockedIn).reduce((s, e) => s + e.hours, 0)

  let liveHours = loggedHours
  if (currentlyClockedIn?.startTime) {
    const [sh, sm] = currentlyClockedIn.startTime.split(':').map(Number)
    let diffM = liveTime.getHours() * 60 + liveTime.getMinutes() - sh * 60 - sm
    if (diffM < 0) diffM += 24 * 60
    liveHours += diffM / 60
  }
  const TARGET   = 8
  const ringPct  = Math.min(1, liveHours / TARGET)
  const hrs      = Math.floor(liveHours)
  const mins     = Math.floor((liveHours - hrs) * 60)
  const secs     = currentlyClockedIn ? liveTime.getSeconds() : 0
  const liveStr  = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
  const punchIn  = currentlyClockedIn?.startTime ?? todayEntries[todayEntries.length - 1]?.startTime
  const punchOut = todayEntries.find(e => e.endTime && !e.clockedIn)?.endTime

  // This week
  const weekStart   = weekMonday(new Date())
  const weekDayStrs = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return toYMD(d)
  })
  const weekHours = weekDayStrs.reduce((s, date) =>
    s + entries.filter(e => e.date === date && !e.clockedIn).reduce((x, e) => x + e.hours, 0), 0)

  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const weeklyData = weekDayStrs.map((date, i) => ({
    day:     DAY_LABELS[i],
    hours:   Math.round(entries.filter(e => e.date === date && !e.clockedIn).reduce((x, e) => x + e.hours, 0) * 10) / 10,
    isToday: date === todayYMD,
  }))

  // Leave data
  const myLeave      = allLeave.filter(r => r.employeeId === myEmployee?.id)
  const approvedLeave = myLeave.filter(r => r.status === 'approved')
  const pendingLeave  = myLeave.filter(r => r.status === 'pending')

  const leaveDates = new Set<string>()
  approvedLeave.forEach(lr => {
    const s = new Date(lr.startDate), end = new Date(lr.endDate)
    for (const d = new Date(s); d <= end; d.setDate(d.getDate() + 1))
      leaveDates.add(toYMD(new Date(d)))
  })

  const annualUsed = myLeave.filter(r => r.type === 'annual' && r.status === 'approved').reduce((s, r) => s + r.days, 0)
  const sickUsed   = myLeave.filter(r => r.type === 'sick'   && r.status === 'approved').reduce((s, r) => s + r.days, 0)
  const toilUsed   = myLeave.filter(r => r.type === 'toil'   && r.status === 'approved').reduce((s, r) => s + r.days, 0)
  const LEAVE_TOTAL = 10
  const totalUsed   = myLeave.filter(r => r.status === 'approved').reduce((s, r) => s + r.days, 0)

  // This month attendance %
  const thisMonthStr = todayYMD.slice(0, 7)
  const workedDays   = new Set(entries.filter(e => e.date.startsWith(thisMonthStr) && !e.clockedIn).map(e => e.date)).size
  const dayOfMonth   = new Date().getDate()
  const workdaysPassed = Array.from({ length: dayOfMonth }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth(), i + 1)
    return d.getDay() !== 0 && d.getDay() !== 6
  }).filter(Boolean).length
  const attendancePct = workdaysPassed > 0 ? Math.round((workedDays / workdaysPassed) * 100) : 100

  // Greeting
  const h         = liveTime.getHours()
  const greeting  = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
  const firstName = (currentUser?.name ?? 'there').split(' ')[0]
  const dateLabel = liveTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const handleClockIn = async () => {
    setClockingIn(true)
    try { await clockIn() } finally { setClockingIn(false) }
  }

  const num = 'tabular-nums'


  return (
    <div className="space-y-4">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl p-7 text-white bg-[#12121E]">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(46,134,193,0.45), transparent 65%)' }} />
        <div className="absolute -bottom-16 left-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 65%)' }} />
        <div className="absolute bottom-10 right-10 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(244,114,182,0.2), transparent 65%)' }} />

        <div className="relative">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {currentlyClockedIn ? (
                  <span className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> WORKING
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                    NOT CLOCKED IN
                  </span>
                )}
                <span className="text-white/40 text-[11px]">{dateLabel}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                {greeting},<br />
                <span className="text-[#5DADE2]">{firstName}.</span>
              </h1>
              <p className="text-white/50 text-sm mt-2 max-w-xs">
                {currentlyClockedIn
                  ? `You've been working for ${liveStr} today.`
                  : liveHours > 0
                    ? `You logged ${String(hrs).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m today.`
                    : "You haven't clocked in yet today."}
              </p>
            </div>
            <div className="text-right hidden md:block">
              <div className={`text-5xl font-bold ${num} leading-none`}
                style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                {liveTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-white/30 text-sm mt-1">
                {String(liveTime.getSeconds()).padStart(2,'0')}s
              </div>
            </div>
          </div>

          {/* 4 stat chips */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: "Today's Hours",   v: liveStr,                           c: '#5DADE2'  },
              { l: 'Leave Remaining', v: `${Math.max(0, LEAVE_TOTAL - totalUsed)}d`, c: '#6EE7B7' },
              { l: 'Week Hours',      v: fmtHours(weekHours),               c: '#C4B5FD'  },
              { l: 'This Month',      v: `${attendancePct}%`,               c: '#FCD34D'  },
            ].map(s => (
              <div key={s.l} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="text-[10px] opacity-50 uppercase tracking-wide font-medium mb-1">{s.l}</div>
                <div className={`text-xl font-bold ${num}`} style={{ color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Noticeboard Preview ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
              <Megaphone size={15} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Company Noticeboard</p>
              <p className="text-xs text-gray-400">Latest announcements</p>
            </div>
          </div>
          <button onClick={() => navigate('/noticeboard')} className="text-xs text-primary hover:underline font-semibold">
            All notices →
          </button>
        </div>
        {notices.length === 0 ? (
          <div className="py-8 text-center">
            <Megaphone size={22} className="text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No announcements yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notices.map(n => {
              const cfg = NOTICE_PRIORITY[n.priority]
              const NIcon = cfg.icon
              return (
                <div key={n.id} className="flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-secondary leading-tight">{n.title}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                        n.priority === 'urgent' ? 'bg-red-100 text-red-700'
                        : n.priority === 'important' ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                      }`}>{n.priority}</span>
                      {n.pinned && <span className="text-[9px] font-bold bg-gray-800 text-white px-1.5 py-0.5 rounded-full">PINNED</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.content}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">by {n.postedBy}</p>
                  </div>
                  <NIcon size={13} className={`shrink-0 mt-1 ${cfg.text}`} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Row 1: Clock | Workspace | Leave Balances ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Clock card */}
        <div className="lg:col-span-3 card p-5 flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm font-bold text-secondary">Time Clock</p>
            <span className="text-[10px] text-gray-400 tabular-nums">{todayYMD}</span>
          </div>

          {/* Ring */}
          <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
            <Ring progress={ringPct} color="#2E86C1" size={140} stroke={12} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className={`text-lg font-bold text-secondary font-mono ${num}`}>{liveStr}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">of {TARGET}h target</p>
            </div>
          </div>

          {/* Punch bar */}
          <div className="w-full bg-secondary rounded-xl px-4 py-2.5 flex justify-between items-center">
            <div className="text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-medium">In</p>
              <p className={`text-sm font-bold text-white mt-0.5 ${num}`}>{punchIn ? fmt12(punchIn) : '--:--'}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-medium">Out</p>
              <p className={`text-sm font-bold text-white mt-0.5 ${num}`}>{punchOut ? fmt12(punchOut) : '--:--'}</p>
            </div>
          </div>

          {currentlyClockedIn ? (
            <button
              onClick={() => clockOut(currentlyClockedIn.id, currentlyClockedIn.startTime!)}
              className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2">
              <Clock size={14} /> Punch Out
            </button>
          ) : (
            <button
              onClick={handleClockIn} disabled={clockingIn}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
              <Clock size={14} /> {clockingIn ? 'Clocking in…' : 'Punch In'}
            </button>
          )}

          <button onClick={() => navigate('/my-time')}
            className="text-xs text-primary hover:underline w-full text-center">
            View shifts →
          </button>
        </div>

        {/* Workspace + quick actions */}
        <div className="lg:col-span-5 card p-6 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-[0.05] bg-primary" />
          <div className="absolute -right-4 top-12  w-24 h-24 rounded-full opacity-[0.07] bg-primary" />

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Your workspace</p>
            <p className="text-xl font-bold text-secondary mt-1">{firstName}'s Portal</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {myEmployee?.jobTitle ?? 'Employee'} · {myEmployee?.department ?? currentUser?.department ?? '—'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Apply Leave', sub: `${Math.max(0, LEAVE_TOTAL - totalUsed)}d remaining`,
                icon: CalendarDays, action: () => setLeaveModal(true),
                bg: 'bg-primary/5 hover:bg-primary/10 border-primary/10', icon_bg: 'bg-primary/15', icon_color: 'text-primary',
              },
              {
                label: 'Payslips', sub: 'View & download',
                icon: CreditCard, action: () => navigate('/my-payslips'),
                bg: 'bg-purple-50 hover:bg-purple-100 border-purple-100', icon_bg: 'bg-purple-100', icon_color: 'text-purple-600',
              },
              {
                label: 'Attendance', sub: `${attendancePct}% this month`,
                icon: Clock, action: () => navigate('/my-attendance'),
                bg: 'bg-green-50 hover:bg-green-100 border-green-100', icon_bg: 'bg-green-100', icon_color: 'text-green-600',
              },
              {
                label: 'My Profile', sub: 'View & edit info',
                icon: User, action: () => navigate('/my-profile'),
                bg: 'bg-pink-50 hover:bg-pink-100 border-pink-100', icon_bg: 'bg-pink-100', icon_color: 'text-pink-600',
              },
            ].map(q => (
              <button key={q.label} onClick={q.action}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors border text-left ${q.bg}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${q.icon_bg}`}>
                  <q.icon size={14} className={q.icon_color} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-secondary">{q.label}</p>
                  <p className="text-[10px] text-gray-400">{q.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Recent requests */}
          <div className="mt-auto pt-3 border-t border-gray-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-secondary">Recent Requests</p>
              <button onClick={() => navigate('/my-requests')} className="text-[10px] text-primary hover:underline">All →</button>
            </div>
            {myLeave.length === 0 ? (
              <p className="text-[11px] text-gray-400">No requests yet.</p>
            ) : (
              <div className="space-y-1.5">
                {myLeave.slice(0, 2).map(lr => (
                  <div key={lr.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-secondary capitalize">{lr.type.replace('_',' ')} leave</p>
                      <p className="text-[10px] text-gray-400">{lr.startDate} · {lr.days}d</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                      ${lr.status === 'approved' ? 'bg-green-100 text-green-700'
                        : lr.status === 'pending'  ? 'bg-amber-100 text-amber-700'
                                                   : 'bg-red-100 text-red-700'}`}>
                      {lr.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leave balances */}
        <div className="lg:col-span-4 card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-secondary">Leave Balance</p>
              <p className="text-xs text-gray-400">Total: {LEAVE_TOTAL} days</p>
            </div>
            <button onClick={() => navigate('/my-leave')} className="text-xs text-primary hover:underline">Details →</button>
          </div>
          <div className="flex flex-col items-center gap-3 flex-1">
            <MiniDonut used={totalUsed} total={LEAVE_TOTAL} color="#2E86C1" label="Total Leave" />
            <div className="flex gap-5 text-center">
              <div><p className="text-xs font-bold text-secondary">{sickUsed}</p><p className="text-[10px] text-gray-400">Sick</p></div>
              <div><p className="text-xs font-bold text-secondary">{annualUsed}</p><p className="text-[10px] text-gray-400">Annual</p></div>
              <div><p className="text-xs font-bold text-secondary">{toilUsed}</p><p className="text-[10px] text-gray-400">TOIL</p></div>
            </div>
          </div>
          <button onClick={() => setLeaveModal(true)}
            className="w-full mt-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl transition">
            Apply for Leave
          </button>
        </div>
      </div>

      {/* ── Row 2: Weekly chart | Calendar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        <div className="lg:col-span-7 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-secondary">This Week's Hours</p>
              <p className="text-xs text-gray-400">
                {weekDayStrs[0]} → {weekDayStrs[6]} · <strong>{fmtHours(weekHours)}</strong> total
              </p>
            </div>
            <button onClick={() => navigate('/my-time')} className="text-xs text-primary hover:underline">My Shifts →</button>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                formatter={(v: number) => [`${v}h`, 'Hours']}
              />
              <Bar dataKey="hours" radius={[5, 5, 0, 0]}>
                {weeklyData.map((entry, index) => (
                  <Cell key={index} fill={entry.isToday ? '#1a5f8a' : '#2E86C1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-500">
            <span>Target: {TARGET}h/day</span>
            <span>·</span>
            <span>Total: <strong className="text-secondary">{fmtHours(weekHours)}</strong></span>
            <span>·</span>
            <span className={weekHours >= TARGET * 5 ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
              {weekHours >= TARGET * 5 ? '✓ On track' : 'Behind target'}
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-secondary">Calendar</p>
            <button onClick={() => navigate('/my-leave')} className="text-xs text-primary hover:underline">My Leave →</button>
          </div>
          <MiniCalendar leaveDates={leaveDates} />
          {approvedLeave.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Upcoming Leave</p>
              {approvedLeave.slice(0, 2).map(lr => (
                <div key={lr.id} className="flex items-center justify-between py-1">
                  <span className="text-xs text-secondary capitalize">{lr.type.replace('_',' ')}</span>
                  <span className="text-[10px] text-gray-400">{lr.startDate} · {lr.days}d</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* ── Row 3: Quick portal cards | QR card ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Quick portal actions */}
        <div className="lg:col-span-7 card p-5">
          <p className="text-sm font-bold text-secondary mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Request Advance', icon: DollarSign, path: '/my-advance',     bg: 'bg-purple-50',  ic: 'text-purple-600',  hover: 'hover:bg-purple-100'  },
              { label: 'Request Letter',  icon: ScrollText, path: '/request-letter', bg: 'bg-indigo-50',  ic: 'text-indigo-600',  hover: 'hover:bg-indigo-100'  },
              { label: 'File Grievance',  icon: Megaphone,  path: '/grievance',      bg: 'bg-rose-50',    ic: 'text-rose-600',    hover: 'hover:bg-rose-100'    },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border border-transparent text-left transition-colors ${a.bg} ${a.hover}`}>
                <a.icon size={14} className={`shrink-0 ${a.ic}`} />
                <span className="text-xs font-semibold text-secondary leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* QR Clock-In card */}
        <div className="lg:col-span-5 card p-5 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 w-full justify-between">
            <div>
              <p className="text-sm font-bold text-secondary text-left">QR Clock-In</p>
              <p className="text-xs text-gray-400 text-left">Scan to record attendance</p>
            </div>
            <button onClick={() => setShowQr(v => !v)}
              className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
              <QrCode size={13} />
              {showQr ? 'Hide' : 'Show'}
            </button>
          </div>
          {showQr ? (
            <>
              <div className="p-3 bg-white border-2 border-gray-100 rounded-2xl shadow-inner">
                <QRCodeSVG
                  value={JSON.stringify({ employeeId: myEmployee?.id ?? '', name: myEmployee?.name ?? '', ts: Date.now() })}
                  size={120}
                  bgColor="#ffffff"
                  fgColor="#12121E"
                  level="M"
                />
              </div>
              <p className="text-[11px] text-gray-400 max-w-[180px]">
                Show this QR to your manager or HR kiosk to clock in / out.
              </p>
            </>
          ) : (
            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center">
              <QrCode size={32} className="text-gray-300" />
            </div>
          )}
        </div>
      </div>

      {leaveModal && (
        <LeaveModal
          name={currentUser?.name ?? ''}
          employeeId={myEmployee?.id ?? ''}
          onClose={() => setLeaveModal(false)}
        />
      )}
    </div>
  )
}
