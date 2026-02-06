import { useEffect, useState, useCallback } from 'react'
import { Database, FileSearch, FolderGit2, GitCommitHorizontal, Code2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatSize, formatNumber } from '@/lib/formatters'
import { LoadingOverlay } from '@/components/ui/loading-overlay'

interface EmbeddingStats {
  file_count: number; versioned_file_count: number; context_item_count: number
  snippet_count: number; embedding_count: number; commit_count: number
  commit_intent_count: number; db_size: number; free_pages: number
  total_pages: number; page_size: number
}

interface IndexedFile { absolute_path: string; last_access_time: string; corpus_name: string; corpus_relative_path: string }
interface ProjectSummary { corpus_name: string; file_count: number; commit_count: number }
interface IndexedCommit { repo_name: string; hexsha: string; message: string }
interface ContextItem { id: number; node_uri: string; node_name: string; code_context_type: string; versioned_file_id: number }

export function Embedding() {
  const [stats, setStats] = useState<EmbeddingStats | null>(null)
  const [files, setFiles] = useState<IndexedFile[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [commits, setCommits] = useState<IndexedCommit[]>([])
  const [context, setContext] = useState<ContextItem[]>([])
  const [search, setSearch] = useState('')
  const [vacuuming, setVacuuming] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!isTauri()) { setLoading(false); return }
    try {
      const [s, f, p, c, ctx] = await Promise.all([
        tauriInvoke<EmbeddingStats>('get_embedding_stats'),
        tauriInvoke<IndexedFile[]>('get_embedding_files', { limit: 100, offset: 0, search: '' }),
        tauriInvoke<ProjectSummary[]>('get_embedding_projects'),
        tauriInvoke<IndexedCommit[]>('get_embedding_commits', { limit: 100 }),
        tauriInvoke<ContextItem[]>('get_embedding_context', { limit: 100, offset: 0 }),
      ])
      setStats(s); setFiles(f); setProjects(p); setCommits(c); setContext(ctx)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSearch = async () => {
    if (!isTauri()) return
    const f = await tauriInvoke<IndexedFile[]>('get_embedding_files', { limit: 100, offset: 0, search })
    setFiles(f)
  }

  const handleVacuum = async () => {
    setVacuuming(true)
    try {
      const freed = await tauriInvoke<number>('vacuum_embedding_db')
      alert(`压缩完成，释放 ${formatSize(freed)}`)
      loadData()
    } catch (e) { alert(`VACUUM 失败: ${e}`) }
    setVacuuming(false)
  }

  const handleDeleteProject = async (corpus: string) => {
    setDeleting(corpus)
    try {
      const deleted = await tauriInvoke<number>('delete_project_index', { corpusName: corpus })
      alert(`已删除 ${deleted} 条记录`)
      loadData()
    } catch (e) { alert(`删除失败: ${e}`) }
    setDeleting(null)
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
  if (!stats) return <p className="text-muted-foreground">未找到嵌入数据库。请确认 Windsurf 已安装并使用过。</p>

  const freePercent = stats.total_pages > 0 ? Math.round((stats.free_pages / stats.total_pages) * 100) : 0
  const barItems = [
    { label: '文件数', value: stats.file_count, max: stats.snippet_count || 1 },
    { label: '代码项', value: stats.context_item_count, max: stats.snippet_count || 1 },
    { label: '片段数', value: stats.snippet_count, max: stats.snippet_count || 1 },
    { label: '向量数', value: stats.embedding_count, max: stats.snippet_count || 1 },
    { label: '提交数', value: stats.commit_count, max: stats.snippet_count || 1 },
  ]

  const overlayMsg = vacuuming ? '正在压缩数据库...' : deleting ? `正在删除 ${deleting} 索引...` : ''

  return (
    <div className="relative space-y-6">
      <LoadingOverlay visible={vacuuming || !!deleting} message={overlayMsg} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">嵌入数据库</h2>
          <p className="text-sm text-muted-foreground">
            数据库大小: {formatSize(stats.db_size)} · 空闲页: {freePercent}% · 页大小: {stats.page_size}B
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={vacuuming} className="cursor-pointer">{vacuuming ? '压缩中...' : 'VACUUM 压缩'}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认压缩数据库？</AlertDialogTitle>
              <AlertDialogDescription>
                VACUUM 将回收 {formatNumber(stats.free_pages)} 个空闲页（约 {formatSize(stats.free_pages * stats.page_size)}），操作期间数据库不可用。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleVacuum} className="cursor-pointer">执行压缩</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="overview" className="gap-1.5 cursor-pointer"><Database className="h-3.5 w-3.5" />概览</TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5 cursor-pointer"><FileSearch className="h-3.5 w-3.5" />索引文件</TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5 cursor-pointer"><FolderGit2 className="h-3.5 w-3.5" />按项目</TabsTrigger>
          <TabsTrigger value="commits" className="gap-1.5 cursor-pointer"><GitCommitHorizontal className="h-3.5 w-3.5" />Git 提交</TabsTrigger>
          <TabsTrigger value="context" className="gap-1.5 cursor-pointer"><Code2 className="h-3.5 w-3.5" />代码上下文</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-sm">数据库统计</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {barItems.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono tabular-nums text-foreground">{formatNumber(item.value)}</span>
                  </div>
                  <Progress value={Math.min((item.value / item.max) * 100, 100)} className="h-2" />
                </div>
              ))}
              {freePercent > 10 && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-sm text-amber-500">
                    空闲页占比 {freePercent}%（{formatNumber(stats.free_pages)} / {formatNumber(stats.total_pages)}），
                    建议执行 VACUUM 可回收约 {formatSize(stats.free_pages * stats.page_size)}。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card className="border-border bg-card">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-sm">索引文件 ({formatNumber(stats.file_count)})</CardTitle>
              <div className="flex gap-2">
                <Input
                  placeholder="搜索文件路径..."
                  className="max-w-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" size="sm" onClick={handleSearch} className="cursor-pointer">搜索</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y divide-border">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{f.corpus_relative_path || f.absolute_path}</p>
                        <p className="text-xs text-muted-foreground">{f.corpus_name} · {f.last_access_time}</p>
                      </div>
                    </div>
                  ))}
                  {files.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">无结果</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.corpus_name} className="border-border bg-card">
                <CardContent className="p-5">
                  <h3 className="truncate font-medium text-foreground">{p.corpus_name}</h3>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">{p.file_count} 文件</Badge>
                    <Badge variant="outline" className="font-mono text-xs">{p.commit_count} 提交</Badge>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="mt-3 cursor-pointer text-xs text-destructive hover:text-destructive">删除索引</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除 {p.corpus_name} 的索引？</AlertDialogTitle>
                        <AlertDialogDescription>将删除该项目的所有嵌入向量、代码片段和上下文数据。Windsurf 重新打开该项目时会自动重建。</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteProject(p.corpus_name)} className="cursor-pointer bg-destructive">删除</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="commits">
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y divide-border">
                  {commits.map((c, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-3">
                      <code className="shrink-0 font-mono text-xs text-primary">{c.hexsha.slice(0, 8)}</code>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{c.message}</p>
                        <p className="text-xs text-muted-foreground">{c.repo_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="context">
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y divide-border">
                  {context.map((c) => (
                    <div key={c.id} className="flex items-center gap-4 px-6 py-3">
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{c.code_context_type}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{c.node_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.node_uri}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
