import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatNumber } from '@/lib/formatters'

interface ProjectSummary {
  corpus_name: string
  file_count: number
  commit_count: number
}

export function ProjectCoverageList() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        if (isTauri()) {
          const data = await tauriInvoke<ProjectSummary[]>('get_embedding_projects')
          setProjects(data)
        }
      } catch (e) {
        console.error('Failed to load projects:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">项目索引覆盖</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 px-6 pb-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : projects.length === 0 ? (
          <p className="px-6 pb-4 text-sm text-muted-foreground">未找到索引项目</p>
        ) : (
          <ScrollArea className="h-[220px]">
            <div className="space-y-1 px-6 pb-4">
              {projects.map((p) => (
                <div
                  key={p.corpus_name}
                  className="flex items-center justify-between rounded-md py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    <span className="truncate text-foreground">{p.corpus_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {formatNumber(p.file_count)} 文件
                    </Badge>
                    {p.commit_count > 0 && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatNumber(p.commit_count)} 提交
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
