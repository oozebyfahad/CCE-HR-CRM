import { useState, useEffect, useRef } from 'react'
import { Bell, X, CheckCheck, Megaphone, CalendarCheck, CreditCard, FileText, ShieldAlert, Shield } from 'lucide-react'
import { collection, query, where, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAppSelector } from '../../store'

export interface AppNotification {
  id: string
  userId: string
  title: string
  message: string
  type: 'leave' | 'advance' | 'payslip' | 'notice' | 'letter' | 'grievance' | 'overtime' | 'cert' | 'discipline'
  read: boolean
  link?: string
  createdAt: { seconds: number } | null
}

const TYPE_ICON: Record<string, React.ElementType> = {
  leave:     CalendarCheck,
  advance:   CreditCard,
  payslip:   FileText,
  notice:    Megaphone,
  letter:    FileText,
  grievance: ShieldAlert,
  overtime:  CalendarCheck,
  cert:       ShieldAlert,
  discipline: Shield,
}

const TYPE_COLOR: Record<string, string> = {
  leave:     'bg-blue-100 text-blue-600',
  advance:   'bg-amber-100 text-amber-600',
  payslip:   'bg-purple-100 text-purple-600',
  notice:    'bg-emerald-100 text-emerald-600',
  letter:    'bg-indigo-100 text-indigo-600',
  grievance: 'bg-red-100 text-red-600',
  overtime:  'bg-orange-100 text-orange-600',
  cert:       'bg-rose-100 text-rose-600',
  discipline: 'bg-red-100  text-red-600',
}

function timeAgo(ts: { seconds: number } | null): string {
  if (!ts) return ''
  const diff = Math.floor((Date.now() / 1000 - ts.seconds) / 60)
  if (diff < 1)   return 'Just now'
  if (diff < 60)  return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

interface Props {
  placement?: 'top-right' | 'bottom-sidebar'
}

export default function NotificationBell({ placement = 'top-right' }: Props) {
  const user   = useAppSelector(s => s.auth.user)
  const [open, setOpen]   = useState(false)
  const [notes, setNotes] = useState<AppNotification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.email) return
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.email),
    )
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))
      docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      setNotes(docs)
    }, () => {})
  }, [user?.email])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notes.filter(n => !n.read).length

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true })
  }

  const markAllRead = async () => {
    const unreadNotes = notes.filter(n => !n.read)
    if (!unreadNotes.length) return
    const batch = writeBatch(db)
    unreadNotes.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }))
    await batch.commit()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden ${placement === 'bottom-sidebar' ? 'bottom-11 left-0' : 'top-11 right-0'}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-primary" />
              <p className="text-sm font-bold text-secondary">Notifications</p>
              {unread > 0 && (
                <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{unread} new</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1">
                  <CheckCheck size={11} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notes.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notes.map(n => {
                const Icon  = TYPE_ICON[n.type] ?? Bell
                const color = TYPE_COLOR[n.type] ?? 'bg-gray-100 text-gray-500'
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${!n.read ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${!n.read ? 'text-secondary' : 'text-gray-600'}`}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[9px] text-gray-300 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: AppNotification['type'],
  link?: string,
) {
  const { addDoc, serverTimestamp } = await import('firebase/firestore')
  await addDoc(collection(db, 'notifications'), {
    userId, title, message, type, read: false, link: link ?? null, createdAt: serverTimestamp(),
  })
}
