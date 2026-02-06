import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAppStore } from '@/stores/useAppStore'
import { isTauri } from '@/lib/tauri'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const navigate = useNavigate()

  // Listen for tray navigation events
  useEffect(() => {
    if (!isTauri()) return

    let unlisten: (() => void) | null = null

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<string>('navigate', (event) => {
        navigate(event.payload)
      }).then((fn) => {
        unlisten = fn
      })
    })

    return () => {
      unlisten?.()
    }
  }, [navigate])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div
        className={cn(
          'flex flex-1 flex-col transition-all duration-200',
          sidebarCollapsed ? 'ml-16' : 'ml-56'
        )}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
