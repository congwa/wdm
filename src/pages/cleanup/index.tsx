import { useEffect, useState } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatSize } from '@/lib/formatters'
import { LoadingOverlay } from '@/components/ui/loading-overlay'

interface CleanupItem {
  key: string; label: string; size: number
  risk_level: string; description: string; path: string
}

interface CleanupResult {
  key: string; freed_size: number; success: boolean; error: string | null
}

export function Cleanup() {
  const [items, setItems] = useState<CleanupItem[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [results, setResults] = useState<CleanupResult[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    async function load() {
      if (!isTauri()) { setLoading(false); return }
      try {
        const data = await tauriInvoke<CleanupItem[]>('get_cleanup_items')
        setItems(data)
        // Auto-check safe items
        const autoChecked: Record<string, boolean> = {}
        data.forEach((i) => { if (i.risk_level === 'safe') autoChecked[i.key] = true })
        setChecked(autoChecked)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const safe = items.filter((i) => i.risk_level === 'safe')
  const warning = items.filter((i) => i.risk_level === 'warning')

  const selectedKeys = Object.entries(checked).filter(([, v]) => v).map(([k]) => k)
  const selectedSize = items.filter((i) => checked[i.key]).reduce((a, i) => a + i.size, 0)

  const handleClean = async (keys: string[]) => {
    setCleaning(true)
    try {
      const res = await tauriInvoke<CleanupResult[]>('execute_cleanup', { keys })
      setResults(res)
      setShowResults(true)
      // Refresh items
      const data = await tauriInvoke<CleanupItem[]>('get_cleanup_items')
      setItems(data)
    } catch (e) {
      alert(`清理失败: ${e}`)
    }
    setCleaning(false)
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>

  const renderGroup = (
    title: string, icon: typeof Sparkles, color: string, borderColor: string,
    groupItems: CleanupItem[], description: string
  ) => (
    <Card className={`${borderColor} border bg-card`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {(() => { const Icon = icon; return <Icon className={`h-4 w-4 ${color}`} /> })()}
          <CardTitle className="text-sm text-foreground">{title}</CardTitle>
          <Badge variant="secondary" className="ml-auto font-mono">
            {formatSize(groupItems.filter((i) => checked[i.key]).reduce((a, i) => a + i.size, 0))}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {groupItems.map((item) => (
          <label key={item.key} className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={checked[item.key] ?? false}
              onCheckedChange={(v) => setChecked((s) => ({ ...s, [item.key]: !!v }))}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-foreground">{item.label}</span>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatSize(item.size)}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  )

  const totalFreed = results.reduce((a, r) => a + r.freed_size, 0)

  return (
    <div className="relative space-y-6">
      <LoadingOverlay visible={cleaning} message="正在清理文件..." />
      <div>
        <h2 className="text-xl font-semibold text-foreground">存储清理</h2>
        <p className="text-sm text-muted-foreground">
          已选择 {selectedKeys.length} 项 · 预计释放 {formatSize(selectedSize)}
        </p>
      </div>

      {safe.length > 0 && renderGroup('安全清理', Sparkles, 'text-emerald-500', 'border-emerald-500/30', safe, '自动恢复，无风险')}
      {warning.length > 0 && renderGroup('深度清理', AlertTriangle, 'text-amber-500', 'border-amber-500/30', warning, '不可恢复')}

      <div className="flex gap-3">
        <Button
          onClick={() => handleClean(selectedKeys.filter((k) => items.find((i) => i.key === k)?.risk_level === 'safe'))}
          disabled={cleaning || !selectedKeys.some((k) => items.find((i) => i.key === k)?.risk_level === 'safe')}
          className="cursor-pointer"
        >
          执行安全清理
        </Button>

        {selectedKeys.some((k) => items.find((i) => i.key === k)?.risk_level === 'warning') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="cursor-pointer text-amber-500 border-amber-500/30">执行深度清理</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认深度清理？</AlertDialogTitle>
                <AlertDialogDescription>选中的数据将被永久删除，不可恢复。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleClean(selectedKeys.filter((k) => items.find((i) => i.key === k)?.risk_level === 'warning'))}
                  className="cursor-pointer bg-amber-500 hover:bg-amber-600"
                >确认删除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>清理完成</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {results.map((r) => (
              <div key={r.key} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{r.key}</span>
                {r.success ? (
                  <Badge variant="secondary" className="font-mono text-xs">释放 {formatSize(r.freed_size)}</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">失败: {r.error}</Badge>
                )}
              </div>
            ))}
            <p className="text-center font-medium text-foreground">总计释放: {formatSize(totalFreed)}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
