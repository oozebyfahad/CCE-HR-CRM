import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import Sidebar from './Sidebar'
import TopNav  from './TopNav'
import { useAppSelector } from '../../store'
import { cn } from '../../utils/cn'
import { db } from '../../config/firebase'
import { useFirebaseUsers } from '../../hooks/useFirebaseUsers'

// ── Notification popup ──────────────────────────────────────────────────
function NotificationPopup({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Bell size={16} className="text-white" />
            </div>
            <p className="text-sm font-bold text-white">Message from Admin</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition">
            <X size={15} className="text-white" />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
        {/* Footer */}
        <div className="px-5 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const collapsed   = useAppSelector(s => s.ui.sidebarCollapsed)
  const currentUser = useAppSelector(s => s.auth.user)
  const { markNotificationRead } = useFirebaseUsers()

  const [notification, setNotification] = useState<string | null>(null)

  // Check for unread notification on mount
  useEffect(() => {
    if (!currentUser?.id) return
    getDoc(doc(db, 'users', currentUser.id)).then(snap => {
      if (!snap.exists()) return
      const data = snap.data()
      if (data.notification && !data.notification.read && data.notification.message) {
        setNotification(data.notification.message)
      }
    })
  }, [currentUser?.id])

  const handleDismiss = async () => {
    setNotification(null)
    if (currentUser?.id) await markNotificationRead(currentUser.id)
  }

  return (
    <div className="flex min-h-screen bg-[#F0F4F8]">
      <Sidebar />
      <div className={cn('flex-1 flex flex-col transition-all duration-300', collapsed ? 'ml-16' : 'ml-60')}>
        <TopNav />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {notification && (
        <NotificationPopup message={notification} onClose={handleDismiss} />
      )}
    </div>
  )
}
