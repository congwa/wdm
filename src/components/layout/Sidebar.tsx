import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  GitBranch,
  MessageSquare,
  User,
  Puzzle,
  FolderOpen,
  Brain,
  Shield,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '总览' },
  { to: '/embedding', icon: Database, label: '嵌入数据库' },
  { to: '/code-tracker', icon: GitBranch, label: '代码追踪' },
  { to: '/chat-history', icon: MessageSquare, label: '聊天记录' },
  'separator' as const,
  { to: '/account', icon: User, label: '账户信息' },
  { to: '/extensions', icon: Puzzle, label: '扩展管理' },
  { to: '/workspaces', icon: FolderOpen, label: '工作区' },
  { to: '/ai-rules', icon: Brain, label: 'AI 规则' },
  'separator' as const,
  { to: '/privacy', icon: Shield, label: '隐私安全' },
  { to: '/cleanup', icon: Trash2, label: '存储清理' },
]

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-card transition-all duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono font-bold text-sm">
            W
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-foreground">
              Windsurf DM
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {navItems.map((item, i) => {
            if (item === 'separator') {
              return <Separator key={`sep-${i}`} className="my-2" />
            }
            const { to, icon: Icon, label } = item

            const link = (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            )

            if (collapsed) {
              return (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            }

            return link
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="w-full justify-center cursor-pointer"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
