import { useEffect, useState } from 'react'
import { Shield, ShieldAlert, ShieldCheck, Eye, Trash2, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { RISK_LEVELS } from '@/lib/constants'

interface RiskItem {
  id: string; level: 'high' | 'medium' | 'low'
  title: string; location: string; preview: string | null
}

export function Privacy() {
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  const load = async () => {
    if (!isTauri()) { setLoading(false); return }
    setScanning(true)
    try {
      const data = await tauriInvoke<RiskItem[]>('scan_privacy_risks')
      setRisks(data)
    } catch (e) { console.error(e) }
    setLoading(false)
    setScanning(false)
  }

  useEffect(() => { load() }, [])

  const riskCounts = {
    high: risks.filter((r) => r.level === 'high').length,
    medium: risks.filter((r) => r.level === 'medium').length,
    low: risks.filter((r) => r.level === 'low').length,
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>

  return (
    <div className="relative space-y-6">
      <LoadingOverlay visible={scanning && !loading} message="正在扫描本地数据..." />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">隐私安全扫描</h2>
          <p className="text-sm text-muted-foreground">扫描本地存储的敏感信息</p>
        </div>
        <Button onClick={load} disabled={scanning} className="gap-2 cursor-pointer">
          <Shield className="h-4 w-4" />
          {scanning ? '扫描中...' : '重新扫描'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(['high', 'medium', 'low'] as const).map((level) => {
          const config = RISK_LEVELS[level]
          const Icon = level === 'high' ? ShieldAlert : level === 'medium' ? Shield : ShieldCheck
          return (
            <Card key={level} className={`${config.border} border bg-card`}>
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className={`h-5 w-5 ${config.color}`} />
                <div>
                  <p className={`text-2xl font-bold tabular-nums ${config.color}`}>{riskCounts[level]}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-sm">发现 {risks.length} 个风险项</CardTitle></CardHeader>
        <CardContent className="space-y-1 p-0">
          {risks.map((risk, i) => {
            const config = RISK_LEVELS[risk.level]
            return (
              <div key={risk.id}>
                {i > 0 && <Separator />}
                <div className="flex items-start gap-4 px-6 py-4">
                  <Badge className={`shrink-0 ${config.bg} ${config.color} border-0 text-xs`}>{config.label}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{risk.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{risk.location}</p>
                    {risk.preview && <code className="mt-1 block text-xs font-mono text-amber-500">{risk.preview}</code>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer"><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer"><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            )
          })}
          {risks.length === 0 && <p className="px-6 py-8 text-center text-sm text-muted-foreground">未发现风险项</p>}
        </CardContent>
      </Card>
    </div>
  )
}
