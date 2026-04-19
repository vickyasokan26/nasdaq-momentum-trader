import { type ReactNode } from 'react'

type Variant = 'gain' | 'loss' | 'warn' | 'accent' | 'neutral' | 'muted'

const STYLES: Record<Variant, string> = {
  gain:    'bg-gain/10 text-gain border-gain/20',
  loss:    'bg-loss/10 text-loss border-loss/20',
  warn:    'bg-warn/10 text-warn border-warn/20',
  accent:  'bg-accent/10 text-accent border-accent/20',
  neutral: 'bg-desk-raised text-text-secondary border-desk-border',
  muted:   'bg-transparent text-text-muted border-desk-border',
}

interface BadgeProps {
  children:  ReactNode
  variant?:  Variant
  className?: string
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded border
      text-xxs font-mono font-semibold uppercase tracking-wide
      ${STYLES[variant]} ${className}
    `}>
      {children}
    </span>
  )
}

export function riskBadge(level: string | null | undefined) {
  if (!level) return <Badge variant="muted">—</Badge>
  const v: Variant =
    level === 'high'    ? 'loss' :
    level === 'medium'  ? 'warn' :
    level === 'low'     ? 'gain' : 'muted'
  return <Badge variant={v}>{level}</Badge>
}

export function pnlColor(pnl: number) {
  if (pnl > 0)  return 'text-gain'
  if (pnl < 0)  return 'text-loss'
  return 'text-text-muted'
}

export function pnlSign(pnl: number) {
  return pnl >= 0 ? `+€${pnl.toFixed(2)}` : `-€${Math.abs(pnl).toFixed(2)}`
}
