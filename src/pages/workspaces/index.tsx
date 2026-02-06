import { useEffect, useState } from 'react'
import { FolderOpen, Terminal, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { tauriInvoke, isTauri } from '@/lib/tauri'

interface WorkspaceData {
  workspaces: { id: string; folder_uri: string; folder_name: string; path_exists: boolean }[]
  recent_paths: { path_type: string; uri: string; label: string }[]
  terminal_commands: string[]
}

export function Workspaces() {
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!isTauri()) { setLoading(false); return }
      try {
        const d = await tauriInvoke<WorkspaceData>('get_workspace_data')
        setData(d)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
  if (!data) return <p className="text-muted-foreground">未找到工作区数据</p>

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">工作区管理</h2>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-sm">活跃工作区 ({data.workspaces.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 p-0">
          {data.workspaces.map((ws, i) => (
            <div key={ws.id}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-4 px-6 py-4">
                <FolderOpen className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{ws.folder_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ws.folder_uri.replace('file://', '')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ws.path_exists ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            </div>
          ))}
          {data.workspaces.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">无活跃工作区</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-sm">最近打开 ({data.recent_paths.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.recent_paths.slice(0, 15).map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {p.path_type === 'folder' ? '目录' : '文件'}
                </Badge>
                <span className="truncate text-muted-foreground font-mono text-xs">{p.label || p.uri.replace('file://', '')}</span>
              </div>
            ))}
            {data.recent_paths.length === 0 && <p className="text-sm text-muted-foreground">无记录</p>}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="h-4 w-4" /> 终端命令历史 ({data.terminal_commands.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.terminal_commands.slice(0, 20).map((cmd, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-primary font-mono">$</span>
                <code className="text-muted-foreground font-mono truncate">{cmd}</code>
              </div>
            ))}
            {data.terminal_commands.length === 0 && <p className="text-sm text-muted-foreground">无命令历史</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
