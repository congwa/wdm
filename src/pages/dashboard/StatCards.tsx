import { Database, FolderGit2, FileSearch, HardDrive } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatSize, formatNumber } from '@/lib/formatters'
import { useDashboardStore } from '@/stores/useDashboardStore'

export function StatCards() {
  const data = useDashboardStore((s) => s.data)

  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const stats = [
    { label: '总占用', value: formatSize(data.total_size), icon: HardDrive },
    { label: '索引文件', value: formatNumber(data.indexed_file_count), icon: FileSearch },
    { label: '追踪项目', value: formatNumber(data.tracked_project_count), icon: FolderGit2 },
    { label: '可释放空间', value: formatSize(data.reclaimable_size), icon: Database, accent: true },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, accent }) => (
        <Card key={label} className="border-border bg-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
