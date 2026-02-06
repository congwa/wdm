import { useEffect, useState, useCallback } from 'react'
import {
  Unlock, FileText, Download, MessageSquare, Bot, User,
  Terminal, Eye, Wrench, AlertTriangle, RefreshCw, Loader2,
  GitBranch, Clock, Zap, ChevronDown, ChevronRight, FileCode, FolderOpen,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatSize } from '@/lib/formatters'
import type { CascadeSummary, CascadeStep, CascadeDetail } from '@/types'

// Legacy types (kept for backward compat)
interface LegacyChatSession {
  id: string; file_name: string; file_path: string; project: string
  size: number; last_modified: string; encrypted: boolean; source: string
}
interface ParsedContent {
  related_files: string[]; code_snippets: string[]; raw_strings: string[]
}

// ============================================================
// Main Component
// ============================================================

export function ChatHistory() {
  // Legacy state
  const [legacySessions, setLegacySessions] = useState<LegacyChatSession[]>([])
  const [selectedLegacy, setSelectedLegacy] = useState<string | null>(null)
  const [legacyParsed, setLegacyParsed] = useState<ParsedContent | null>(null)
  const [legacyParsing, setLegacyParsing] = useState(false)

  // Cascade state
  const [cascades, setCascades] = useState<CascadeSummary[]>([])
  const [selectedCascade, setSelectedCascade] = useState<string | null>(null)
  const [cascadeDetail, setCascadeDetail] = useState<CascadeDetail | null>(null)
  const [cascadeLoading, setCascadeLoading] = useState(false)
  const [serverConnected, setServerConnected] = useState<boolean | null>(null)

  // General
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'cascade' | 'legacy'>('cascade')

  // Load data
  useEffect(() => {
    if (!isTauri()) { setLoading(false); return }
    loadAll()
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // Load legacy sessions
      const legData = await tauriInvoke<LegacyChatSession[]>('get_chat_sessions')
      setLegacySessions(legData)
    } catch (e) { console.error('Legacy load failed:', e) }

    // Load cascade trajectories
    await loadCascades()
    setLoading(false)
  }, [])

  const loadCascades = async () => {
    try {
      const data = await tauriInvoke<CascadeSummary[]>('get_cascade_trajectories')
      // ISO 8601 strings are lexicographically sortable — avoid creating Date objects in comparator
      setCascades(data.sort((a, b) => (b.last_modified_time > a.last_modified_time ? 1 : b.last_modified_time < a.last_modified_time ? -1 : 0)))
      setServerConnected(true)
    } catch (e) {
      console.error('Cascade load failed:', e)
      setServerConnected(false)
    }
  }

  // Select a cascade conversation
  const handleSelectCascade = async (cascadeId: string) => {
    setSelectedCascade(cascadeId)
    setSelectedLegacy(null)
    setCascadeDetail(null)
    setCascadeLoading(true)
    try {
      const detail = await tauriInvoke<CascadeDetail>('get_cascade_detail', { cascadeId })
      setCascadeDetail(detail)
    } catch (e) {
      console.error('Detail load failed:', e)
    }
    setCascadeLoading(false)
  }

  // Select a legacy session
  const handleSelectLegacy = async (session: LegacyChatSession) => {
    setSelectedLegacy(session.id)
    setSelectedCascade(null)
    setLegacyParsed(null)
    if (!session.encrypted && isTauri()) {
      setLegacyParsing(true)
      try {
        const content = await tauriInvoke<ParsedContent>('parse_chat_content', { filePath: session.file_path })
        setLegacyParsed(content)
      } catch (e) { console.error('Parse failed:', e) }
      setLegacyParsing(false)
    }
  }

  const legacy = legacySessions.filter(s => s.source === 'legacy')

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">聊天记录</h2>
          <p className="text-sm text-muted-foreground">
            Cascade: {cascades.length} 条 {serverConnected ? '(已解密)' : '(需要 Windsurf 运行)'}
            {legacy.length > 0 && ` | 旧版: ${legacy.length} 条`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCascades} className="gap-1.5 cursor-pointer">
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('cascade')}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === 'cascade'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Unlock className="h-3.5 w-3.5" />
            Cascade 对话 ({cascades.length})
          </div>
        </button>
        {legacy.length > 0 && (
          <button
            onClick={() => setActiveTab('legacy')}
            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === 'legacy'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              旧版 ({legacy.length})
            </div>
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'cascade' ? (
        serverConnected === false ? (
          <ServerOfflineCard onRetry={loadCascades} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <CascadeList
              cascades={cascades}
              selected={selectedCascade}
              onSelect={handleSelectCascade}
            />
            <CascadeDetailPanel
              detail={cascadeDetail}
              summary={cascades.find(c => c.cascade_id === selectedCascade)}
              loading={cascadeLoading}
            />
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <LegacyList
            sessions={legacy}
            selected={selectedLegacy}
            onSelect={handleSelectLegacy}
          />
          <LegacyDetailPanel
            session={legacy.find(s => s.id === selectedLegacy)}
            parsed={legacyParsed}
            parsing={legacyParsing}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================
// Server Offline Card
// ============================================================

function ServerOfflineCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500/50 mb-4" />
        <p className="text-foreground font-medium">无法连接 Windsurf 语言服务器</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          请确保 Windsurf 正在运行并已打开一个工作区，然后重试。
          语言服务器在 Windsurf 打开项目时自动启动。
        </p>
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-1.5 cursor-pointer">
          <RefreshCw className="h-3.5 w-3.5" />
          重试连接
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Cascade List
// ============================================================

function CascadeList({ cascades, selected, onSelect }: {
  cascades: CascadeSummary[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <Card className="border-border bg-card lg:col-span-1">
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-2 space-y-0.5">
            {cascades.map(c => (
              <button
                key={c.cascade_id}
                onClick={() => onSelect(c.cascade_id)}
                className={`w-full rounded-md px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  selected === c.cascade_id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.summary || 'New Cascade'}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{c.step_count} 步</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {formatModel(c.model)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(c.last_modified_time)}
                      </span>
                    </div>
                    {c.workspace_names.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <FolderOpen className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate">
                          {c.workspace_names.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  {c.errored && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                </div>
              </button>
            ))}
            {cascades.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">暂无 Cascade 对话</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Cascade Detail Panel
// ============================================================

function CascadeDetailPanel({ detail, summary, loading }: {
  detail: CascadeDetail | null
  summary?: CascadeSummary
  loading: boolean
}) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (loading) {
    return (
      <Card className="border-border bg-card lg:col-span-2">
        <CardContent className="flex items-center justify-center h-[600px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>解密对话中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!detail) {
    return (
      <Card className="border-border bg-card lg:col-span-2">
        <CardContent className="flex items-center justify-center h-[600px] text-muted-foreground text-sm">
          选择一个对话查看已解密的内容
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card lg:col-span-2">
      <CardContent className="p-0">
        {/* Header */}
        {summary && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">{summary.summary}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {detail.steps.length} 步骤
                  </span>
                  <span className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    {formatModel(summary.model)}
                  </span>
                  {summary.workspace_names.length > 0 && (
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {summary.workspace_names.join(', ')}
                    </span>
                  )}
                  <span>
                    {formatSize(detail.raw_size)} 原始数据
                  </span>
                </div>
              </div>
              <Badge variant={summary.errored ? 'destructive' : 'secondary'} className="text-xs">
                {summary.errored ? '有错误' : '正常'}
              </Badge>
            </div>
            {summary.referenced_files.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {summary.referenced_files.map(f => (
                  <Badge key={f} variant="outline" className="text-xs font-mono gap-1">
                    <FileCode className="h-3 w-3" />
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Steps */}
        <ScrollArea className="h-[520px]">
          <div className="p-4 space-y-3">
            {detail.steps.map((step, idx) => (
              <StepItem
                key={idx}
                step={step}
                index={idx}
                expanded={expandedSteps.has(idx)}
                onToggle={() => toggleStep(idx)}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Step Item
// ============================================================

function StepItem({ step, index: _index, expanded, onToggle }: {
  step: CascadeStep
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  const { icon, label, color } = getStepMeta(step.step_type)
  const hasContent = step.content.length > 0
  const isLong = step.content.length > 200
  const showContent = hasContent && (expanded || !isLong)
  // Cap rendered content to avoid blocking the main thread with huge DOM text nodes
  const MAX_RENDER_CHARS = 10_000
  const displayContent = step.content.length > MAX_RENDER_CHARS && expanded
    ? step.content.slice(0, MAX_RENDER_CHARS)
    : step.content
  const isTruncated = step.content.length > MAX_RENDER_CHARS && expanded

  return (
    <div className={`rounded-lg border ${color} p-3`}>
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={onToggle}
      >
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">{label}</span>
            {step.tool_name && (
              <Badge variant="outline" className="text-xs font-mono">{step.tool_name}</Badge>
            )}
            {step.file_uri && (
              <Badge variant="outline" className="text-xs font-mono truncate max-w-[200px]">
                {step.file_uri.split('/').pop()}
              </Badge>
            )}
            {step.command && (
              <Badge variant="outline" className="text-xs font-mono truncate max-w-[250px]">
                {step.command}
              </Badge>
            )}
            {step.created_at && (
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {formatTime(step.created_at)}
              </span>
            )}
          </div>

          {/* Content */}
          {hasContent && (
            <div className="mt-1.5">
              {showContent ? (
                <>
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                    {displayContent}
                  </div>
                  {isTruncated && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ...内容过长，已截断显示（{(step.content.length / 1000).toFixed(1)}K 字符）
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {isLong ? (
                    expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                  ) : null}
                  <span>{step.content.slice(0, 100)}...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Legacy Components (kept from original)
// ============================================================

function LegacyList({ sessions, selected, onSelect }: {
  sessions: LegacyChatSession[]
  selected: string | null
  onSelect: (s: LegacyChatSession) => void
}) {
  return (
    <Card className="border-border bg-card lg:col-span-1">
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-2">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className={`w-full rounded-md px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  selected === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-sm font-medium">{s.project}</span>
                </div>
                <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                  <span>{formatSize(s.size)}</span>
                  <span>{s.last_modified}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function LegacyDetailPanel({ session, parsed, parsing }: {
  session?: LegacyChatSession
  parsed: ParsedContent | null
  parsing: boolean
}) {
  return (
    <Card className="border-border bg-card lg:col-span-2">
      <CardContent className="p-6">
        {session ? (
          parsing ? (
            <div className="flex items-center justify-center h-[540px]">
              <p className="text-muted-foreground">解析中...</p>
            </div>
          ) : parsed ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">{session.project}</h3>
                  <p className="text-xs text-muted-foreground">{formatSize(session.size)}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                  <Download className="h-3.5 w-3.5" />导出
                </Button>
              </div>
              <Separator />
              {parsed.related_files.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">涉及文件 ({parsed.related_files.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.related_files.slice(0, 30).map(f => (
                      <Badge key={f} variant="secondary" className="font-mono text-xs">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {parsed.code_snippets.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">代码片段 ({parsed.code_snippets.length})</p>
                  <ScrollArea className="h-[300px]">
                    <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">{(() => {
                      const joined = parsed.code_snippets.join('\n')
                      if (joined.length > 50_000) return joined.slice(0, 50_000) + '\n\n...内容过长，已截断显示'
                      return joined
                    })()}</pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[540px] text-muted-foreground text-sm">无法解析内容</div>
          )
        ) : (
          <div className="flex items-center justify-center h-[540px] text-muted-foreground text-sm">选择一个对话查看详情</div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Helpers
// ============================================================

function getStepMeta(stepType: string): { icon: React.ReactNode; label: string; color: string } {
  switch (stepType) {
    case 'CORTEX_STEP_TYPE_USER_INPUT':
      return { icon: <User className="h-4 w-4 text-blue-500" />, label: '用户', color: 'border-blue-500/20 bg-blue-500/5' }
    case 'CORTEX_STEP_TYPE_PLANNER_RESPONSE':
      return { icon: <Bot className="h-4 w-4 text-green-500" />, label: 'AI 回复', color: 'border-green-500/20 bg-green-500/5' }
    case 'CORTEX_STEP_TYPE_VIEW_FILE':
    case 'CORTEX_STEP_TYPE_VIEW_CONTENT':
      return { icon: <Eye className="h-4 w-4 text-purple-500" />, label: '查看文件', color: 'border-purple-500/20 bg-purple-500/5' }
    case 'CORTEX_STEP_TYPE_RUN_COMMAND':
      return { icon: <Terminal className="h-4 w-4 text-orange-500" />, label: '执行命令', color: 'border-orange-500/20 bg-orange-500/5' }
    case 'CORTEX_STEP_TYPE_MCP_TOOL':
      return { icon: <Wrench className="h-4 w-4 text-cyan-500" />, label: 'MCP 工具', color: 'border-cyan-500/20 bg-cyan-500/5' }
    case 'CORTEX_STEP_TYPE_WRITE_FILE':
    case 'CORTEX_STEP_TYPE_EDIT_FILE':
      return { icon: <FileCode className="h-4 w-4 text-yellow-500" />, label: '编辑文件', color: 'border-yellow-500/20 bg-yellow-500/5' }
    case 'CORTEX_STEP_TYPE_ERROR_MESSAGE':
      return { icon: <AlertTriangle className="h-4 w-4 text-red-500" />, label: '错误', color: 'border-red-500/20 bg-red-500/5' }
    case 'CORTEX_STEP_TYPE_MEMORY':
      return { icon: <Zap className="h-4 w-4 text-amber-500" />, label: '记忆', color: 'border-amber-500/20 bg-amber-500/5' }
    case 'CORTEX_STEP_TYPE_LIST_DIRECTORY':
      return { icon: <FolderOpen className="h-4 w-4 text-indigo-500" />, label: '列出目录', color: 'border-indigo-500/20 bg-indigo-500/5' }
    case 'CORTEX_STEP_TYPE_CHECKPOINT':
      return { icon: <GitBranch className="h-4 w-4 text-teal-500" />, label: '检查点', color: 'border-teal-500/20 bg-teal-500/5' }
    default:
      return { icon: <MessageSquare className="h-4 w-4 text-muted-foreground" />, label: stepType.replace('CORTEX_STEP_TYPE_', ''), color: 'border-border bg-muted/30' }
  }
}

function formatModel(model: string): string {
  if (!model) return '未知'
  return model
    .replace('MODEL_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace('Swe', 'SWE')
    .replace('Gpt', 'GPT')
    .replace('Claude', 'Claude')
}

function formatDateTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffDays === 0) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return '昨天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    }
  } catch {
    return iso.slice(0, 10)
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}
