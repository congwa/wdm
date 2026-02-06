import { useNavigate } from 'react-router-dom'
import { Trash2, Shield, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDashboardStore } from '@/stores/useDashboardStore'
import { formatSize } from '@/lib/formatters'

export function QuickActions() {
  const navigate = useNavigate()
  const scan = useDashboardStore((s) => s.scan)
  const isScanning = useDashboardStore((s) => s.isScanning)
  const data = useDashboardStore((s) => s.data)

  const actions = [
    { label: '一键清理', icon: Trash2, onClick: () => navigate('/cleanup') },
    { label: '隐私扫描', icon: Shield, onClick: () => navigate('/privacy') },
    { label: '刷新数据', icon: RefreshCw, onClick: scan, loading: isScanning },
  ]

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-foreground">快捷操作</CardTitle>
        {data && data.db_free_pages > 0 && (
          <Badge variant="secondary" className="font-mono text-xs">
            数据库空闲页: {data.db_free_pages} / {data.db_total_pages}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {actions.map(({ label, icon: Icon, onClick, loading }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              onClick={onClick}
              disabled={loading}
              className="gap-2 cursor-pointer"
            >
              <Icon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {label}
            </Button>
          ))}
          {data && (
            <span className="ml-auto text-xs text-muted-foreground self-center">
              可释放: {formatSize(data.reclaimable_size)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
