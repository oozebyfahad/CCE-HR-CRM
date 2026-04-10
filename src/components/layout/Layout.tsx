import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav  from './TopNav'
import { useAppSelector } from '../../store'
import { cn } from '../../utils/cn'

export default function Layout() {
  const collapsed = useAppSelector(s => s.ui.sidebarCollapsed)

  return (
    <div className="flex min-h-screen bg-[#F0F4F8]">
      <Sidebar />
      <div className={cn('flex-1 flex flex-col transition-all duration-300', collapsed ? 'ml-16' : 'ml-60')}>
        <TopNav />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
