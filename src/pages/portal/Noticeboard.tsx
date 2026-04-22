import { useState, useEffect } from 'react'
import { Megaphone, Pin, AlertTriangle, Info, Bell, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore'
import { db } from '../../config/firebase'

interface Notice {
  id: string
  title: string
  content: string
  priority: 'urgent' | 'important' | 'general'
  category: string
  postedBy: string
  pinned?: boolean
  targetRoles?: string[]
  createdAt: { seconds: number } | null
}

const PRIORITY_CONFIG = {
  urgent:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    icon: AlertTriangle, label: 'Urgent'    },
  important: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500',  icon: Bell,          label: 'Important' },
  general:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',   icon: Info,          label: 'General'   },
}

function timeAgo(ts: { seconds: number } | null): string {
  if (!ts) return ''
  const diff = Math.floor((Date.now() / 1000 - ts.seconds) / 60)
  if (diff < 1)    return 'Just now'
  if (diff < 60)   return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function NoticeCard({ notice }: { notice: Notice }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = PRIORITY_CONFIG[notice.priority]
  const Icon = cfg.icon
  const isLong = notice.content.length > 200

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-300 hover:shadow-md ${
      notice.pinned ? `${cfg.bg} ${cfg.border}` : 'bg-white border-gray-100 hover:border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.badge}`}>
          <Icon size={17} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            {notice.pinned && (
              <span className="flex items-center gap-1 text-[9px] font-bold bg-gray-800 text-white px-2 py-0.5 rounded-full">
                <Pin size={8} /> PINNED
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label.toUpperCase()}
            </span>
            {notice.category && (
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {notice.category}
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-secondary mt-2 leading-tight">{notice.title}</h3>

          <div className={`text-xs text-gray-600 mt-2 leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
            {notice.content}
          </div>

          {isLong && (
            <button onClick={() => setExpanded(v => !v)}
              className="mt-2 flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
              {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Read more</>}
            </button>
          )}

          <div className="flex items-center gap-3 mt-3">
            <p className="text-[10px] text-gray-400">Posted by <span className="font-semibold text-gray-500">{notice.postedBy}</span></p>
            <span className="text-gray-300">·</span>
            <p className="text-[10px] text-gray-400">{timeAgo(notice.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Noticeboard() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [filter, setFilter]   = useState<'all' | 'urgent' | 'important' | 'general'>('all')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)))
    })
  }, [])

  const filtered = notices.filter(n => {
    const matchFilter = filter === 'all' || n.priority === filter
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const pinned   = filtered.filter(n => n.pinned)
  const unpinned = filtered.filter(n => !n.pinned)

  const urgentCount    = notices.filter(n => n.priority === 'urgent').length
  const importantCount = notices.filter(n => n.priority === 'important').length

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #1E1210 60%, #0f1629 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.35), transparent 65%)' }} />
        <div className="absolute bottom-0 left-16 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.2), transparent 65%)' }} />

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full mb-4">
            <Megaphone size={12} className="text-red-400" />
            <span className="text-red-300 text-[11px] font-semibold tracking-wide">COMPANY NOTICEBOARD</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="text-white/50 text-sm mt-2">Stay informed with the latest company news and important updates.</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Total Notices',    value: String(notices.length),    color: '#60A5FA' },
              { label: 'Urgent',           value: String(urgentCount),        color: urgentCount > 0 ? '#F87171' : '#6B7280' },
              { label: 'Important',        value: String(importantCount),     color: '#FCD34D' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Urgent banner */}
      {urgentCount > 0 && filter === 'all' && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 animate-pulse">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm font-semibold text-red-800">
            {urgentCount} urgent notice{urgentCount > 1 ? 's' : ''} — please read immediately.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search notices…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'urgent', 'important', 'general'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all capitalize ${
                filter === f ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Notices */}
      {filtered.length === 0 ? (
        <div className="card py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-secondary">No notices to display</p>
          <p className="text-xs text-gray-400 mt-1">HR will post company announcements here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Pin size={11} /> Pinned
              </p>
              {pinned.map(n => <NoticeCard key={n.id} notice={n} />)}
            </div>
          )}
          {unpinned.length > 0 && (
            <div className="space-y-3">
              {pinned.length > 0 && (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent</p>
              )}
              {unpinned.map(n => <NoticeCard key={n.id} notice={n} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
