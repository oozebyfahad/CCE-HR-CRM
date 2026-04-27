import { useState, useRef, useCallback } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Line, AreaChart, Area,
  ReferenceLine,
} from 'recharts'
import {
  TrendingUp, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Upload, Search, Play, Lock, Trash2, Mail, Download,
  CheckSquare, Square, ArrowUpRight, ArrowDownRight, X,
  Loader2, Plus, Star,
} from 'lucide-react'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { mockReviews } from '../../utils/mockData'
import { useAppSelector } from '../../store'
import { useFirebaseRecordings, type CallRecording } from '../../hooks/useFirebaseRecordings'
import { useFirebasePerformanceReviews } from '../../hooks/useFirebasePerformanceReviews'
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'

// ── Call chart mock data (replace with live Yestech data later) ───────

const DAILY_CALLS = [
  { day: 'Mon', incoming: 42, outgoing: 31, missed: 8,  total: 81  },
  { day: 'Tue', incoming: 55, outgoing: 38, missed: 5,  total: 98  },
  { day: 'Wed', incoming: 49, outgoing: 44, missed: 11, total: 104 },
  { day: 'Thu', incoming: 63, outgoing: 52, missed: 7,  total: 122 },
  { day: 'Fri', incoming: 71, outgoing: 60, missed: 9,  total: 140 },
  { day: 'Sat', incoming: 28, outgoing: 19, missed: 4,  total: 51  },
  { day: 'Sun', incoming: 15, outgoing: 10, missed: 2,  total: 27  },
]

const KPI_BREAKDOWN = {
  today: { label: "Today's Calls",  incoming: 28, outgoing: 10, missed: 4,   total: 42   },
  week:  { label: 'This Week',      incoming: 198, outgoing: 94, missed: 31, total: 323  },
  month: { label: 'This Month',     incoming: 756, outgoing: 381, missed: 110, total: 1247 },
}

const TODAY_SPARK  = [12, 18, 15, 22, 30, 25, 35, 42]
const WEEK_SPARK   = [180, 210, 195, 230, 245, 220, 260]
const MONTH_SPARK  = [820, 910, 880, 950, 1020, 990, 1100, 1050, 1130, 1200]

const AGENTS = ['All Agents', 'Jyrney', 'Alex', 'Sarah', 'Mike', 'Emma']

interface LogRow {
  id: number
  date: string
  source: string
  dest: string
  duration: string
  tta: string
  status: string
  ext: string
  callerid: string
  notes: string
  area: string
}

const radarData = [
  { skill: 'Communication', score: 8 },
  { skill: 'Teamwork',      score: 7 },
  { skill: 'Productivity',  score: 9 },
  { skill: 'Punctuality',   score: 6 },
  { skill: 'Initiative',    score: 8 },
  { skill: 'Knowledge',     score: 9 },
]

// ── Sparkline ─────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const id = `sg${color.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data.map((v, i) => ({ v, i }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, change, up, spark, color, icon: Icon, active, onClick }: {
  label: string; value: string; sub: string; change: string; up: boolean
  spark: number[]; color: string; icon: React.ElementType
  active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="card p-4 text-left overflow-hidden transition-all w-full hover:shadow-md"
      style={active ? { boxShadow: `0 0 0 2px ${color}` } : {}}>
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}1a` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-500' : 'text-red-500'}`}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{change}
        </span>
      </div>
      <p className="text-2xl font-bold text-secondary">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-[10px] text-gray-300 mt-0.5">{sub}</p>
      <div className="mt-2 -mx-1"><Sparkline data={spark} color={color} /></div>
      {active && <p className="mt-1 text-[10px] font-semibold" style={{ color }}>View breakdown ↓</p>}
    </button>
  )
}

// ── Breakdown panel ───────────────────────────────────────────────────

function BreakdownPanel({ data, color, onClose }: {
  data: typeof KPI_BREAKDOWN['today']; color: string; onClose: () => void
}) {
  const rows = [
    { label: 'Incoming', value: data.incoming, pct: Math.round((data.incoming / data.total) * 100), color: '#2E86C1', icon: PhoneIncoming },
    { label: 'Outgoing', value: data.outgoing, pct: Math.round((data.outgoing / data.total) * 100), color: '#10B981', icon: PhoneOutgoing },
    { label: 'Missed',   value: data.missed,   pct: Math.round((data.missed   / data.total) * 100), color: '#EF4444', icon: PhoneMissed   },
  ]
  return (
    <div className="card p-5 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold text-secondary">{data.label} — Breakdown</p>
          <p className="text-xs text-gray-400">{data.total.toLocaleString()} total calls</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-2">
                <r.icon size={13} style={{ color: r.color }} />
                <span className="text-xs font-medium text-secondary">{r.label}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold text-secondary">{r.value.toLocaleString()}</span>
                <span className="text-[10px] text-gray-400 w-7 text-right">{r.pct}%</span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.pct}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-xl p-3 text-xs min-w-[130px]">
      <p className="font-bold text-secondary mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500 capitalize">{p.name}</span>
          </span>
          <span className="font-semibold text-secondary">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Call Stats + Chart (shared between Call Logs & Recordings tabs) ───

type KpiId = 'today' | 'week' | 'month' | null

function CallStatsSection({ activeKpi, setActiveKpi }: {
  activeKpi: KpiId; setActiveKpi: (id: KpiId) => void
}) {
  const kpiColor = activeKpi === 'today' ? '#2E86C1' : activeKpi === 'week' ? '#10B981' : '#F59E0B'
  const avg = Math.round(DAILY_CALLS.reduce((s, d) => s + d.total, 0) / DAILY_CALLS.length)

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Today's Calls" value="42"    sub="vs 37 yesterday"  change="13.5%" up    spark={TODAY_SPARK}  color="#2E86C1" icon={Phone}         active={activeKpi === 'today'} onClick={() => setActiveKpi(activeKpi === 'today' ? null : 'today')} />
        <KpiCard label="This Week"     value="323"   sub="Mon – Sun rolling" change="8.2%"  up    spark={WEEK_SPARK}   color="#10B981" icon={PhoneIncoming} active={activeKpi === 'week'}  onClick={() => setActiveKpi(activeKpi === 'week'  ? null : 'week')}  />
        <KpiCard label="This Month"    value="1,247" sub="April 2026"        change="2.9%"  up={false} spark={MONTH_SPARK} color="#F59E0B" icon={PhoneOutgoing} active={activeKpi === 'month'} onClick={() => setActiveKpi(activeKpi === 'month' ? null : 'month')} />
      </div>

      {/* Breakdown */}
      {activeKpi && (
        <BreakdownPanel data={KPI_BREAKDOWN[activeKpi]} color={kpiColor} onClose={() => setActiveKpi(null)} />
      )}

      {/* Chart */}
      <div className="card overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#f8faff,#f0f7ff)' }}>
          <div>
            <p className="text-sm font-bold text-secondary">Daily Call Volume</p>
            <p className="text-xs text-gray-400 mt-0.5">Last 7 days — incoming, outgoing &amp; missed</p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-gray-500">
            {[['#2E86C1','Incoming'],['#10B981','Outgoing'],['#EF4444','Missed']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />{l}
              </span>
            ))}
          </div>
        </div>
        <div className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={DAILY_CALLS} barGap={3} barCategoryGap="28%">
              <defs>
                {[['barIncoming','#2E86C1'],['barOutgoing','#10B981'],['barMissed','#EF4444']].map(([id, c]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={1} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.5} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(46,134,193,0.04)', radius: 6 }} />
              <ReferenceLine y={avg} stroke="#CBD5E1" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: 'avg', position: 'insideRight', fontSize: 9, fill: '#94a3b8' }} />
              <Bar dataKey="incoming" name="incoming" fill="url(#barIncoming)" radius={[5,5,0,0]} maxBarSize={22} />
              <Bar dataKey="outgoing" name="outgoing" fill="url(#barOutgoing)" radius={[5,5,0,0]} maxBarSize={22} />
              <Bar dataKey="missed"   name="missed"   fill="url(#barMissed)"   radius={[5,5,0,0]} maxBarSize={22} />
              <Line type="monotone" dataKey="total" name="total" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4"
                dot={{ r: 3, fill: '#94a3b8', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#2E86C1', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

type Tab = 'reviews' | 'logs' | 'recordings'

export default function Performance() {
  const currentUser = useAppSelector(s => s.auth.user)
  const isEmployee  = currentUser?.role === 'employee'

  // ── Reviews (real Firebase, fallback to mock if empty) ──
  const { reviews: fbReviews, loading: reviewsLoading } = useFirebasePerformanceReviews()
  const allReviews = fbReviews.length > 0 ? fbReviews : mockReviews

  const visibleReviews = isEmployee
    ? allReviews.filter(r => r.employeeName === currentUser?.name)
    : allReviews

  const [selected, setSelected] = useState(visibleReviews[0] ?? null)
  const [tab,      setTab]      = useState<Tab>('reviews')
  const [activeKpi,setActiveKpi]= useState<KpiId>(null)

  // ── Call Recordings ──
  const { recordings: liveRecordings, loading: recLoading } = useFirebaseRecordings()
  const [recFromDate, setRecFromDate] = useState('')
  const [recToDate,   setRecToDate]   = useState('')
  const [recFromHour, setRecFromHour] = useState('')
  const [recFromMin,  setRecFromMin]  = useState('')
  const [recToHour,   setRecToHour]   = useState('')
  const [recToMin,    setRecToMin]    = useState('')
  const [recSource,   setRecSource]   = useState('')
  const [recDest,     setRecDest]     = useState('')
  const [recAgent,    setRecAgent]    = useState('All Agents')
  const [recSelected,      setRecSelected]      = useState<string[]>([])
  const [recSearch,        setRecSearch]        = useState('')
  const [playingId,        setPlayingId]        = useState<string | null>(null)
  const [appliedFromDate,  setAppliedFromDate]  = useState('')
  const [appliedToDate,    setAppliedToDate]    = useState('')
  const [apiRecordings,    setApiRecordings]    = useState<CallRecording[]>([])
  const [apiSearching,     setApiSearching]     = useState(false)
  const [probeMsg,         setProbeMsg]         = useState('')
  const [voipStatus,       setVoipStatus]       = useState<{ checking: boolean; webhooks: {url:string;token:string}[]; checked: boolean; error?: string }>({ checking: false, webhooks: [], checked: false })
  const [registering,      setRegistering]      = useState(false)

  const applySearch = async () => {
    setAppliedFromDate(recFromDate)
    setAppliedToDate(recToDate)
    if (!recFromDate && !recToDate) return
    setApiSearching(true)
    setProbeMsg('')
    try {
      const r = await fetch('/api/voip', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'probe', from: recFromDate, to: recToDate }),
      })
      const json = await r.json()
      if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
        const normalised: CallRecording[] = json.data.map((x: Record<string, unknown>) => ({
          id:          String(x.id ?? x.callRecordingId ?? Math.random()),
          callID:      String(x.callID ?? x.call_id ?? ''),
          duration:    Number(x.duration ?? 0),
          durationFmt: (() => { const s = Number(x.duration ?? 0); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` })(),
          datetime:    String(x.datetime ?? x.date ?? ''),
          source:      String(x.source ?? x.from ?? ''),
          destination: String(x.destination ?? x.to ?? ''),
          isProtected: Boolean(x.isProtected ?? x.is_protected ?? false),
          filename:    String(x.filename ?? ''),
          url:         String(x.url ?? ''),
        }))
        setApiRecordings(normalised)
        setProbeMsg(`Found ${normalised.length} recordings via API`)
      } else {
        // Show what each endpoint returned so we can diagnose
        const summary = (json.results ?? [])
          .map((r: {ep: string; status?: number; preview?: string; error?: string}) =>
            `${r.ep}: ${r.status ?? 'ERR'} — ${(r.preview ?? r.error ?? '').slice(0, 60)}`)
          .join('\n')
        setProbeMsg(summary || 'No list endpoint found on VoIP server. Recordings only arrive via webhook after each call.')
      }
    } catch {
      setProbeMsg('Could not reach VoIP proxy.')
    } finally {
      setApiSearching(false)
    }
  }

  const checkVoipStatus = async () => {
    setVoipStatus({ checking: true, webhooks: [], checked: false })
    try {
      const r = await fetch('/api/voip', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'check' }),
      })
      const json = await r.json()
      setVoipStatus({ checking: false, webhooks: json.webhooks ?? [], checked: true, error: json.ok ? undefined : json.raw })
    } catch (e: unknown) {
      setVoipStatus({ checking: false, webhooks: [], checked: true, error: String(e) })
    }
  }

  const registerWebhook = async () => {
    setRegistering(true)
    try {
      const webhookUrl = `${window.location.origin}/api/yestech-webhook`
      const customerToken = 'cce_voip_2026'
      const r = await fetch('/api/voip', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'register', webhookUrl, customerToken }),
      })
      const json = await r.json()
      if (json.ok) await checkVoipStatus()
    } finally {
      setRegistering(false)
    }
  }

  // Merge Firebase + direct API results, deduplicated by id
  const mergedRecordings = [...liveRecordings, ...apiRecordings].filter(
    (r, i, arr) => arr.findIndex(x => x.id === r.id) === i
  )

  const recordings = mergedRecordings.filter(r => {
    if (recSearch       && !r.source.includes(recSearch)       && !r.destination.includes(recSearch)) return false
    if (recSource       && !r.source.includes(recSource))      return false
    if (recDest         && !r.destination.includes(recDest))   return false
    if (appliedFromDate && r.datetime.slice(0, 10) < appliedFromDate) return false
    if (appliedToDate   && r.datetime.slice(0, 10) > appliedToDate)   return false
    return true
  })
  const toggleRec = (id: string) =>
    setRecSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleAll = () =>
    setRecSelected(s => s.length === recordings.length ? [] : recordings.map(r => r.id))

  // ── Call Logs ──
  const [logFile,     setLogFile]     = useState<File | null>(null)
  const [logDragOver, setLogDragOver] = useState(false)
  const [logSearch,   setLogSearch]   = useState('')
  const [logsData,    setLogsData]    = useState<LogRow[]>([])
  const [logParsing,  setLogParsing]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseLogFile = useCallback(async (file: File) => {
    setLogParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = xlsxRead(new Uint8Array(buffer), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = xlsxUtils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
      const pick = (r: Record<string, string>, ...keys: string[]) =>
        keys.map(k => r[k] ?? '').find(v => v !== '') ?? ''
      setLogsData(rows.map((r, i) => ({
        id:       i + 1,
        date:     pick(r, 'Date', 'DATE', 'DateTime', 'date', 'Start Time'),
        source:   pick(r, 'Source', 'From', 'Caller', 'source', 'CallerID'),
        dest:     pick(r, 'Dest', 'Destination', 'To', 'dest', 'Called'),
        duration: pick(r, 'Duration', 'duration', 'Duration (s)', 'Dur'),
        tta:      pick(r, 'TTA', 'tta', 'Wait Time', 'Ring Time', 'Answer Delay'),
        status:   pick(r, 'Status', 'status', 'Disposition', 'Call Status'),
        ext:      pick(r, 'Ext', 'Extension', 'ext', 'DID', 'DDI'),
        callerid: pick(r, 'Ext CallerID', 'CallerID', 'callerid', 'CID', 'CLI'),
        notes:    pick(r, 'Notes', 'notes', 'Comments', 'Description'),
        area:     pick(r, 'Area', 'area', 'Location', 'Region', 'Site'),
      })))
    } finally {
      setLogParsing(false)
    }
  }, [])

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setLogDragOver(false)
    const f = e.dataTransfer.files[0]; if (f) { setLogFile(f); parseLogFile(f) }
  }
  const filteredLogs = logsData.filter(l =>
    !logSearch || l.source.includes(logSearch) || l.dest.includes(logSearch) ||
    l.status.toLowerCase().includes(logSearch.toLowerCase())
  )

  // ══════════════════════════════════════════════════════════════════════
  // Employee view
  // ══════════════════════════════════════════════════════════════════════

  if (isEmployee) {
    if (visibleReviews.length === 0) return (
      <div className="space-y-5">
        <div><h2 className="page-header">My Performance</h2><p className="page-sub">Your performance review</p></div>
        <div className="card p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-secondary">No Performance Review Yet</p>
          <p className="text-xs text-gray-400 mt-1">Contact HR or your manager.</p>
        </div>
      </div>
    )
    const sel = selected ?? visibleReviews[0]
    return (
      <div className="space-y-5">
        <div><h2 className="page-header">My Performance</h2><p className="page-sub">Your performance review</p></div>
        {sel && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="flex items-start gap-4 mb-4">
                <Avatar name={sel.employeeName} size="md" />
                <div className="flex-1">
                  <h3 className="font-semibold text-secondary">{sel.employeeName}</h3>
                  <p className="text-xs text-gray-400">{sel.reviewPeriod} · Due: {new Date(sel.reviewDate).toLocaleDateString('en-GB')}</p>
                  <p className="text-xs text-gray-400">Reviewed by {sel.reviewerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{sel.score}</p>
                  <p className="text-xs text-gray-400">/10</p>
                </div>
              </div>
              <p className="section-title">Goals</p>
              <div className="space-y-3">
                {sel.goals.map(g => (
                  <div key={g.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-secondary">{g.title}</p>
                      <Badge variant={statusVariant(g.status)} size="xs">{g.status.replace('_',' ')}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width:`${g.progress}%` }} />
                      </div>
                      <span className="text-xs font-medium text-secondary w-8 text-right">{g.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <p className="section-title">Competency Scores</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                  <Radar dataKey="score" stroke="#2E86C1" fill="#2E86C1" fillOpacity={0.15} strokeWidth={2} />
                  <Tooltip contentStyle={{ fontSize:11, borderRadius:8, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // Admin / HR view
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Performance Management</h2>
          <p className="page-sub">Call analytics &amp; team performance — Q2 2026</p>
        </div>
        {tab === 'reviews' && (
          <button className="btn-primary text-sm flex items-center gap-2">
            <Plus size={15} /> New Review
          </button>
        )}
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl w-fit border border-gray-200/60">
        {([
          { id: 'reviews',    label: 'Performance Reviews' },
          { id: 'logs',       label: 'Call Logs'           },
          { id: 'recordings', label: 'Call Recordings'     },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-secondary shadow-sm border border-gray-200/80'
                : 'text-gray-500 hover:text-secondary hover:bg-white/50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          PERFORMANCE REVIEWS TAB
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          {/* Summary stats */}
          {reviewsLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={13} className="animate-spin" /> Loading reviews from Firebase…
            </div>
          ) : (
            <>
              {fbReviews.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Live — {fbReviews.length} reviews from Firebase
                </div>
              )}
              {fbReviews.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
                  <Star size={12} /> Showing sample data — add real reviews to Firebase to see live data
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Avg Score',       value: visibleReviews.length ? (visibleReviews.reduce((s,r)=>s+r.score,0)/visibleReviews.length).toFixed(1)+'/10' : '—', color: '#2E86C1' },
              { label: 'Reviews Done',    value: visibleReviews.filter(r=>r.status==='completed').length+'/'+visibleReviews.length, color: '#10B981' },
              { label: 'Goals Completed', value: (() => { const all=visibleReviews.flatMap(r=>r.goals); return all.length ? Math.round(all.filter(g=>g.status==='completed').length/all.length*100)+'%' : '—' })(), color: '#F59E0B' },
              { label: 'Overdue',         value: String(visibleReviews.filter(r=>r.status==='overdue').length), color: '#EF4444' },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Review cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleReviews.map(r => (
              <div key={r.id} onClick={() => setSelected(r)}
                className={`card p-4 cursor-pointer hover:shadow-md transition-all ${selected?.id === r.id ? 'ring-2 ring-primary/30' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={r.employeeName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary truncate">{r.employeeName}</p>
                    <p className="text-xs text-gray-400">{r.reviewPeriod}</p>
                  </div>
                  <Badge variant={statusVariant(r.status)} size="xs">{r.status}</Badge>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width:`${(r.score/10)*100}%` }} />
                  </div>
                  <span className="text-sm font-bold text-primary">{r.score}<span className="text-xs text-gray-400 font-normal">/10</span></span>
                </div>
                <p className="text-[10px] text-gray-400">by {r.reviewerName} · Due {new Date(r.reviewDate).toLocaleDateString('en-GB')}</p>
              </div>
            ))}
          </div>

          {/* Selected review detail */}
          {selected && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar name={selected.employeeName} size="md" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-secondary">{selected.employeeName}</h3>
                    <p className="text-xs text-gray-400">{selected.reviewPeriod} · Due: {new Date(selected.reviewDate).toLocaleDateString('en-GB')}</p>
                    <p className="text-xs text-gray-400">Reviewed by {selected.reviewerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{selected.score}</p>
                    <p className="text-xs text-gray-400">/10</p>
                  </div>
                </div>
                <p className="section-title">Goals</p>
                <div className="space-y-3">
                  {selected.goals.map(g => (
                    <div key={g.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-secondary">{g.title}</p>
                        <Badge variant={statusVariant(g.status)} size="xs">{g.status.replace('_',' ')}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width:`${g.progress}%` }} />
                        </div>
                        <span className="text-xs font-medium text-secondary w-8 text-right">{g.progress}%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Due: {new Date(g.dueDate).toLocaleDateString('en-GB')}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5">
                <p className="section-title">Competency Scores</p>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                    <Radar dataKey="score" stroke="#2E86C1" fill="#2E86C1" fillOpacity={0.15} strokeWidth={2} />
                    <Tooltip contentStyle={{ fontSize:11, borderRadius:8, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CALL LOGS TAB
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'logs' && (
        <div className="space-y-4">
          <CallStatsSection activeKpi={activeKpi} setActiveKpi={setActiveKpi} />

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setLogDragOver(true) }}
            onDragLeave={() => setLogDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all select-none ${
              logDragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-gray-200 hover:border-primary/40 hover:bg-gray-50/60'
            }`}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setLogFile(f); parseLogFile(f) } }} />
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: logFile ? '#d1fae5' : '#eff6ff', width:52, height:52 }}>
              <Upload size={22} className={logFile ? 'text-emerald-500' : 'text-primary'} />
            </div>
            {logFile ? (
              <>
                <p className="text-sm font-semibold text-secondary">{logFile.name}</p>
                {logParsing
                  ? <p className="text-xs text-primary mt-1 font-medium flex items-center justify-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Parsing…</p>
                  : <p className="text-xs text-emerald-500 mt-1 font-medium">{logsData.length} records loaded</p>
                }
                <p className="text-[10px] text-gray-400 mt-1">Click to replace</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-secondary">Drop your call log export here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse — accepts <strong>.csv</strong> and <strong>.xlsx</strong></p>
                <p className="text-[10px] text-gray-300 mt-2">Export from your VoIP portal and drop it here to view</p>
              </>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Search call logs…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-secondary border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
                <Download size={13} /> Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Date','Source','Dest','Duration','TTA','Status','Ext','Ext CallerID','Notes','Area'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLogs.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-secondary whitespace-nowrap">{l.date}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{l.source}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{l.dest}</td>
                      <td className="px-4 py-2.5 text-gray-600">{l.duration}</td>
                      <td className="px-4 py-2.5 text-gray-600">{l.tta}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          l.status === 'Answered' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{l.ext}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-500">{l.callerid || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400">{l.notes || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{l.area}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <Upload size={20} className="text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">{logFile ? 'No matching records' : 'Drop a call log file above to view records'}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CALL RECORDINGS TAB
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'recordings' && (
        <div className="space-y-4">

          {/* Inline audio player */}
          {playingId && (() => {
            const rec = recordings.find(r => r.id === playingId)
            return (
              <div className="card p-4 flex items-center gap-4 border-l-4 border-primary">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-secondary mb-1.5">
                    {rec?.source ?? playingId} → {rec?.destination} &nbsp;·&nbsp; {rec?.datetime} &nbsp;·&nbsp; {rec?.durationFmt}
                  </p>
                  <audio
                    controls
                    autoPlay
                    className="w-full h-9"
                    src={`/api/voip?id=${encodeURIComponent(playingId)}`}
                  />
                </div>
                <button onClick={() => setPlayingId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
                  <X size={15} />
                </button>
              </div>
            )
          })()}

          {/* VoIP connection status */}
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              {!voipStatus.checked && !voipStatus.checking && (
                <p className="text-xs text-gray-400">Check that your VoIP webhook is registered before searching.</p>
              )}
              {voipStatus.checking && (
                <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Checking VoIP connection…</p>
              )}
              {voipStatus.checked && voipStatus.webhooks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Webhook registered — recordings will appear automatically after each call
                  </p>
                  {voipStatus.webhooks.map((w, i) => (
                    <p key={i} className="text-[10px] text-gray-400 mt-0.5 font-mono">{w.url}</p>
                  ))}
                </div>
              )}
              {voipStatus.checked && voipStatus.webhooks.length === 0 && !voipStatus.error && (
                <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> No webhook registered — click Register to set it up
                </p>
              )}
              {voipStatus.checked && voipStatus.error && (
                <p className="text-xs text-red-500">Token error — check VOIP_API_TOKEN in Vercel: <span className="font-mono">{voipStatus.error?.slice(0, 80)}</span></p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={checkVoipStatus} disabled={voipStatus.checking}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-500 hover:text-secondary px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {voipStatus.checking ? <Loader2 size={11} className="animate-spin" /> : <Phone size={11} />}
                Check Connection
              </button>
              {voipStatus.checked && voipStatus.webhooks.length === 0 && !voipStatus.error && (
                <button onClick={registerWebhook} disabled={registering}
                  className="flex items-center gap-1.5 text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {registering ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  Register Webhook
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">From</label>
                <input type="date" value={recFromDate} onChange={e => setRecFromDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">From Time</label>
                <div className="flex gap-2">
                  <select value={recFromHour} onChange={e => setRecFromHour(e.target.value)}
                    className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-500 bg-white">
                    <option value="">Hours</option>
                    {Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}</option>)}
                  </select>
                  <select value={recFromMin} onChange={e => setRecFromMin(e.target.value)}
                    className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-500 bg-white">
                    <option value="">Mins</option>
                    {['00','15','30','45'].map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">To</label>
                <input type="date" value={recToDate} onChange={e => setRecToDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">To Time</label>
                <div className="flex gap-2">
                  <select value={recToHour} onChange={e => setRecToHour(e.target.value)}
                    className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-500 bg-white">
                    <option value="">Hours</option>
                    {Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}</option>)}
                  </select>
                  <select value={recToMin} onChange={e => setRecToMin(e.target.value)}
                    className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-500 bg-white">
                    <option value="">Mins</option>
                    {['00','15','30','45'].map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Source</label>
                <input value={recSource} onChange={e => setRecSource(e.target.value)} placeholder="Source number"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Destination</label>
                <input value={recDest} onChange={e => setRecDest(e.target.value)} placeholder="Destination"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Agent</label>
                <select value={recAgent} onChange={e => setRecAgent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary text-gray-600 bg-white">
                  {AGENTS.map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setRecSource(''); setRecDest(''); setRecFromDate(''); setRecToDate(''); setRecAgent('All Agents'); setAppliedFromDate(''); setAppliedToDate(''); setApiRecordings([]); setProbeMsg('') }}
                  className="flex items-center justify-center gap-2 border border-gray-200 text-gray-500 hover:text-secondary px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <X size={13} /> Clear
                </button>
                <button
                  onClick={applySearch}
                  disabled={apiSearching}
                  className="flex items-center justify-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {apiSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  {apiSearching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>
          </div>

          {/* Probe result */}
          {probeMsg && (
            <div className="card p-3 bg-gray-50 border border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 mb-1">VoIP API response:</p>
              <pre className="text-[10px] text-gray-600 whitespace-pre-wrap font-mono">{probeMsg}</pre>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-secondary">
                {recLoading ? 'Loading…' : `${recordings.length} recording${recordings.length !== 1 ? 's' : ''}`}
                {recSelected.length > 0 && <span className="ml-2 text-xs text-primary font-normal">· {recSelected.length} selected</span>}
              </p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={recSearch} onChange={e => setRecSearch(e.target.value)} placeholder="Quick search…"
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary w-44" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-4 py-2.5 w-8">
                      <button onClick={toggleAll}>
                        {recSelected.length === recordings.length && recordings.length > 0
                          ? <CheckSquare size={14} className="text-primary" />
                          : <Square size={14} className="text-gray-400" />}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">Date ↑</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Source</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Destination</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Duration</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Protected</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <Loader2 size={20} className="animate-spin text-primary mx-auto" />
                        <p className="text-xs text-gray-400 mt-2">Connecting to live feed…</p>
                      </td>
                    </tr>
                  )}
                  {!recLoading && recordings.map(r => (
                    <tr key={r.id} className={`hover:bg-gray-50/50 transition-colors ${recSelected.includes(r.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleRec(r.id)}>
                          {recSelected.includes(r.id)
                            ? <CheckSquare size={14} className="text-primary" />
                            : <Square size={14} className="text-gray-300 hover:text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-secondary whitespace-nowrap">{r.datetime}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{r.source}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{r.destination}</td>
                      <td className="px-4 py-3 font-semibold text-secondary">{r.durationFmt || `${r.duration}s`}</td>
                      <td className="px-4 py-3">
                        {r.isProtected
                          ? <span className="flex items-center gap-1 text-amber-600 text-[10px] font-semibold"><Lock size={10} /> Protected</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setPlayingId(playingId === r.id ? null : r.id)} title="Play"
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${playingId === r.id ? 'bg-primary text-white' : 'hover:bg-primary/10 text-primary'}`}>
                            <Play size={12} fill="currentColor" />
                          </button>
                          <button title="Lock" className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${r.isProtected ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                            <Lock size={12} />
                          </button>
                          <button title="Delete" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                          <button title="Email" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                            <Mail size={12} />
                          </button>
                          <a href={`/api/voip?id=${encodeURIComponent(r.id)}&dl=1`} download title="Download"
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors">
                            <Download size={12} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!recLoading && recordings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <Play size={20} className="text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">No recordings yet</p>
                        <p className="text-xs text-gray-300 mt-1">Recordings will appear here automatically once Yestech is connected</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
