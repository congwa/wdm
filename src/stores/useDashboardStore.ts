import { create } from 'zustand'
import { tauriInvoke, isTauri } from '@/lib/tauri'

interface DiskCategory {
  name: string
  size: number
  path: string
}

interface DashboardOverview {
  total_size: number
  categories: DiskCategory[]
  indexed_file_count: number
  context_item_count: number
  embedding_count: number
  commit_count: number
  tracked_project_count: number
  extension_count: number
  chat_session_count: number
  reclaimable_size: number
  db_free_pages: number
  db_total_pages: number
}

interface DashboardState {
  data: DashboardOverview | null
  isScanning: boolean
  lastScanTime: string | null
  error: string | null

  scan: () => Promise<void>
}

const FALLBACK: DashboardOverview = {
  total_size: 0, categories: [], indexed_file_count: 0,
  context_item_count: 0, embedding_count: 0, commit_count: 0,
  tracked_project_count: 0, extension_count: 0, chat_session_count: 0,
  reclaimable_size: 0, db_free_pages: 0, db_total_pages: 0,
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  isScanning: false,
  lastScanTime: null,
  error: null,

  scan: async () => {
    set({ isScanning: true, error: null })
    try {
      if (isTauri()) {
        const data = await tauriInvoke<DashboardOverview>('scan_dashboard')
        set({ data, isScanning: false, lastScanTime: new Date().toISOString() })
      } else {
        // Browser fallback with mock
        await new Promise((r) => setTimeout(r, 800))
        set({ data: FALLBACK, isScanning: false, lastScanTime: new Date().toISOString() })
      }
    } catch (e) {
      set({ isScanning: false, error: String(e) })
    }
  },
}))
