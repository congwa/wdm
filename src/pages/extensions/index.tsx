import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatSize } from '@/lib/formatters'

interface ExtensionInfo {
  id: string; version: string; publisher: string; source: string
  installed_at: number; size: number; disabled: boolean; path: string
}

export function Extensions() {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!isTauri()) { setLoading(false); return }
      try {
        const data = await tauriInvoke<ExtensionInfo[]>('get_extensions')
        setExtensions(data)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const totalSize = extensions.reduce((a, e) => a + e.size, 0)

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">扩展管理</h2>
        <p className="text-sm text-muted-foreground">{extensions.length} 个扩展 · 总计 {formatSize(totalSize)}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {extensions.map((ext) => (
          <Card key={ext.id} className={`border-border bg-card ${ext.disabled ? 'opacity-60' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{ext.id.split('.').pop()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ext.publisher || ext.id.split('.')[0]}</p>
                </div>
                <Badge variant={ext.disabled ? 'destructive' : 'secondary'} className="shrink-0 text-xs">
                  {ext.disabled ? '已禁用' : '已启用'}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">v{ext.version}</span>
                <span>·</span>
                <span>{formatSize(ext.size)}</span>
                <span>·</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ext.source}</Badge>
              </div>
              {ext.installed_at > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  安装: {new Date(ext.installed_at).toLocaleDateString('zh-CN')}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {extensions.length === 0 && <p className="text-sm text-muted-foreground col-span-full">未找到扩展</p>}
      </div>
    </div>
  )
}
