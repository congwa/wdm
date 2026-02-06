import { useEffect } from 'react'
import { useDashboardStore } from '@/stores/useDashboardStore'
import { StatCards } from './StatCards'
import { DiskBreakdownChart } from './DiskBreakdownChart'
import { ProjectCoverageList } from './ProjectCoverageList'
import { QuickActions } from './QuickActions'

export function Dashboard() {
  const data = useDashboardStore((s) => s.data)
  const scan = useDashboardStore((s) => s.scan)

  useEffect(() => {
    if (!data) {
      scan()
    }
  }, [data, scan])

  return (
    <div className="space-y-6">
      <StatCards />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DiskBreakdownChart />
        <ProjectCoverageList />
      </div>
      <QuickActions />
    </div>
  )
}
