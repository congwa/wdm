import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatSize } from '@/lib/formatters'

interface TrackedProject {
  name: string; source: string; dir_name: string
  files: string[]; total_size: number; sensitive_files: string[]
}

export function CodeTracker() {
  const [projects, setProjects] = useState<TrackedProject[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!isTauri()) { setLoading(false); return }
    try {
      const data = await tauriInvoke<TrackedProject[]>('get_tracked_projects')
      setProjects(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const { allSensitive, legacy, windsurf, totalSize, sensitiveSetMap } = useMemo(() => {
    const allSens = projects.flatMap((p) => p.sensitive_files.map((f) => ({ file: f, project: p.name })))
    const leg = projects.filter((p) => p.source === 'legacy')
    const ws = projects.filter((p) => p.source === 'windsurf')
    const total = projects.reduce((a, p) => a + p.total_size, 0)
    const setMap = new Map<string, Set<string>>()
    for (const p of projects) {
      setMap.set(p.dir_name, new Set(p.sensitive_files))
    }
    return { allSensitive: allSens, legacy: leg, windsurf: ws, totalSize: total, sensitiveSetMap: setMap }
  }, [projects])

  const handleDelete = async (dirName: string) => {
    try {
      await tauriInvoke('delete_tracked_project', { dirName })
      load()
    } catch (e) { alert(`删除失败: ${e}`) }
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>

  const renderGroup = (title: string, items: TrackedProject[]) => (
    <Card className="border-border bg-card">
      <CardHeader><CardTitle className="text-sm">{title} — {items.length} 个项目</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" className="w-full">
          {items.map((p) => (
            <AccordionItem key={p.dir_name} value={p.dir_name} className="border-border px-6">
              <AccordionTrigger className="py-3 cursor-pointer hover:no-underline">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-foreground">{p.name}</span>
                  <Badge variant="secondary" className="text-xs">{p.files.length} 文件</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{formatSize(p.total_size)}</span>
                  {p.sensitive_files.length > 0 && (
                    <Badge className="bg-amber-500/10 text-amber-500 border-0 text-xs">{p.sensitive_files.length} 敏感文件</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pb-2">
                  {p.files.slice(0, 20).map((f) => {
                    const isSensitive = sensitiveSetMap.get(p.dir_name)?.has(f) ?? false
                    return (
                      <div key={f} className={`text-xs py-1 ${isSensitive ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                        {isSensitive ? '⚠ ' : ''}{f}
                      </div>
                    )
                  })}
                  {p.files.length > 20 && <p className="text-xs text-muted-foreground">...还有 {p.files.length - 20} 个文件</p>}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="mt-2 text-xs text-destructive cursor-pointer">删除</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除 {p.name}？</AlertDialogTitle>
                        <AlertDialogDescription>将永久删除该项目的代码追踪副本（{formatSize(p.total_size)}），不可恢复。</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(p.dir_name)} className="cursor-pointer bg-destructive">删除</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">代码追踪</h2>
        <p className="text-sm text-muted-foreground">总计: {projects.length} 个项目 · {formatSize(totalSize)}</p>
      </div>

      {allSensitive.length > 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-500">
            发现 {allSensitive.length} 个敏感文件副本（{allSensitive.slice(0, 3).map(s => s.file).join(', ')}{allSensitive.length > 3 ? '...' : ''}）
          </AlertDescription>
        </Alert>
      )}

      {legacy.length > 0 && renderGroup('旧版 (codeium)', legacy)}
      {windsurf.length > 0 && renderGroup('新版 (windsurf)', windsurf)}
      {projects.length === 0 && <p className="text-muted-foreground">未找到代码追踪数据</p>}
    </div>
  )
}
