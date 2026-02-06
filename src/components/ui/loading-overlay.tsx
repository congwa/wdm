import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
  className?: string
}

export function LoadingOverlay({ visible, message, className }: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex flex-col items-center justify-center',
        'bg-background/80 backdrop-blur-sm rounded-lg',
        'animate-in fade-in duration-200',
        className
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
      {message && (
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
