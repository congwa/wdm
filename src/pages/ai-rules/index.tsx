import { useEffect, useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { tauriInvoke, isTauri } from '@/lib/tauri'

interface McpServer {
  name: string; command: string; args: string[]
  env: Record<string, string>; disabled: boolean
}

interface AIRulesData {
  global_rules: string; global_rules_path: string
  mcp_servers: McpServer[]; mcp_config_path: string
  model_names: string[]
}

export function AIRules() {
  const [data, setData] = useState<AIRulesData | null>(null)
  const [rules, setRules] = useState('')
  const [originalRules, setOriginalRules] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      if (!isTauri()) { setLoading(false); return }
      try {
        const d = await tauriInvoke<AIRulesData>('get_ai_rules_data')
        setData(d)
        setRules(d.global_rules)
        setOriginalRules(d.global_rules)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await tauriInvoke('save_global_rules', { content: rules })
      setOriginalRules(rules)
      alert('保存成功')
    } catch (e) { alert(`保存失败: ${e}`) }
    setSaving(false)
  }

  if (loading) return <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-40 w-full" />)}</div>

  const hasChanges = rules !== originalRules

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">AI 规则与配置</h2>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="rules" className="cursor-pointer">全局规则</TabsTrigger>
          <TabsTrigger value="mcp" className="cursor-pointer">MCP 配置</TabsTrigger>
          <TabsTrigger value="models" className="cursor-pointer">模型配置</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card className="border-border bg-card">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">全局规则 (global_rules.md)</CardTitle>
                {data && <p className="text-xs text-muted-foreground mt-1">{data.global_rules_path}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  className="gap-1.5 cursor-pointer"
                  disabled={!hasChanges}
                  onClick={() => setRules(originalRules)}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> 还原
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 cursor-pointer"
                  disabled={!hasChanges || saving}
                  onClick={handleSave}
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? '保存中...' : '保存'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="输入全局规则..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm">MCP 服务器配置</CardTitle>
              {data && <p className="text-xs text-muted-foreground">{data.mcp_config_path}</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.mcp_servers.map((server) => (
                <div key={server.name} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{server.name}</p>
                      <code className="text-xs text-muted-foreground font-mono">{server.command} {server.args.join(' ')}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={server.disabled ? 'destructive' : 'secondary'} className="text-xs">
                        {server.disabled ? '已禁用' : '已启用'}
                      </Badge>
                      <Switch checked={!server.disabled} />
                    </div>
                  </div>
                  {Object.keys(server.env).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      环境变量: {JSON.stringify(server.env)}
                    </div>
                  )}
                </div>
              ))}
              {(!data?.mcp_servers || data.mcp_servers.length === 0) && (
                <p className="text-sm text-muted-foreground">未配置 MCP 服务器</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-sm">从 user_settings.pb 提取的模型</CardTitle></CardHeader>
            <CardContent>
              {data?.model_names && data.model_names.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {data.model_names.map((m) => (
                    <div key={m} className="rounded-md border border-border px-3 py-2 text-sm text-foreground">{m}</div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">未找到模型配置</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
