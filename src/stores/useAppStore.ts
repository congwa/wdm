import { create } from 'zustand'

interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
}

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id'>) => void
  dismissNotification: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  notifications: [],
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        ...s.notifications,
        { ...n, id: crypto.randomUUID() },
      ],
    })),
  dismissNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}))
