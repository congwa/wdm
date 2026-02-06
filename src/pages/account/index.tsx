import { useEffect, useState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { tauriInvoke, isTauri } from '@/lib/tauri'

interface AccountData {
  plan: { name: string; start_timestamp: number; end_timestamp: number; messages: number; used_messages: number; flow_actions: number; used_flow_actions: number; flex_credits: number; used_flex_credits: number } | null
  models: { name: string; id: string; provider: string }[]
  api_key: string
  api_server: string
  identity: { machine_id: string; device_id: string; installation_id: string; first_session: string; last_session: string }
}

export function Account() {
  const [data, setData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!isTauri()) { setLoading(false); return }
      try {
        const d = await tauriInvoke<AccountData>('get_account_data')
        setData(d)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
  if (!data) return <p className="text-muted-foreground">未找到账户数据</p>

  const plan = data.plan
  const endDate = plan ? new Date(plan.end_timestamp) : null
  const isExpired = endDate ? endDate < new Date() : false
  const msgPercent = plan ? (plan.used_messages / Math.max(plan.messages, 1)) * 100 : 0
  const flowPercent = plan ? (plan.used_flow_actions / Math.max(plan.flow_actions, 1)) * 100 : 0

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">账户信息</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {plan && (
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-sm">套餐</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={isExpired ? 'destructive' : 'secondary'}>{plan.name}</Badge>
                <span className="text-xs text-muted-foreground">
                  到期: {endDate?.toLocaleDateString('zh-CN')} {isExpired && '(已过期)'}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Messages</span>
                    <span className="font-mono tabular-nums">{plan.used_messages.toLocaleString()} / {plan.messages.toLocaleString()}</span>
                  </div>
                  <Progress value={msgPercent} className="h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Flow Actions</span>
                    <span className="font-mono tabular-nums">{plan.used_flow_actions.toLocaleString()} / {plan.flow_actions.toLocaleString()}</span>
                  </div>
                  <Progress value={flowPercent} className="h-1.5" />
                </div>
                {plan.flex_credits > 0 && (
                  <div className="text-xs text-muted-foreground">Flex Credits: {plan.used_flex_credits} / {plan.flex_credits}</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {data.api_key && (
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-sm">API Key</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">
                  {showKey ? data.api_key : `${data.api_key.slice(0, 16)}${'*'.repeat(20)}${data.api_key.slice(-8)}`}
                </code>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={() => copyText(data.api_key, 'api')}>
                  {copied === 'api' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">API Server: {data.api_server}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {data.models.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-sm">可用模型 ({data.models.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {data.models.map((m) => (
                <div key={m.name + m.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                  {m.provider && <p className="text-xs text-muted-foreground">{m.provider}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-sm">设备标识</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(data.identity).map(([key, value]) => (
            value && (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{key}</span>
                <div className="flex items-center gap-2">
                  <code className="max-w-[300px] truncate font-mono text-xs text-foreground">{value}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 cursor-pointer" onClick={() => copyText(value, key)}>
                    {copied === key ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            )
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
