/**
 * Windsurf data directory paths (macOS)
 */
export const PATHS = {
  codeium: '~/.codeium',
  codeiumWindsurf: '~/.codeium/windsurf',
  appSupport: '~/Library/Application Support/Windsurf',
  windsurf: '~/.windsurf',
  cache: '~/Library/Caches/com.exafunction.windsurf',
} as const

/**
 * Risk level colors and labels
 */
export const RISK_LEVELS = {
  high: { label: '高风险', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  medium: { label: '中风险', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  low: { label: '低风险', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
} as const

/**
 * Cleanup risk level styling
 */
export const CLEANUP_LEVELS = {
  safe: { label: '安全', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  warning: { label: '警告', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  danger: { label: '危险', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
} as const

/**
 * Chart colors for data visualization
 */
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const
