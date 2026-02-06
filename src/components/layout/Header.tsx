import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDashboardStore } from '@/stores/useDashboardStore'
import { formatSize } from '@/lib/formatters'

export function Header() {
  const data = useDashboardStore((s) => s.data)
  const isScanning = useDashboardStore((s) => s.isScanning)
  const scan = useDashboardStore((s) => s.scan)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">
          Windsurf Data Manager
        </h1>
        {data && (
          <Badge variant="secondary" className="font-mono text-xs">
            {formatSize(data.total_size)}
          </Badge>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={scan}
        disabled={isScanning}
        className="gap-2 cursor-pointer"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
        {isScanning ? '扫描中...' : '刷新'}
      </Button>
    </header>
  )
}
