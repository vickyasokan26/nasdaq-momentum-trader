import { type ReactNode } from 'react'

type Variant = 'gain' | 'loss' | 'warn' | 'accent' | 'neutral' | 'muted'

const STYLES: Record<Variant, { bg: string; color: string; border: string }> = {
  gain:    { bg: 'rgba(0,214,124,0.1)',  color: 'var(--green)', border: 'rgba(0,214,124,0.2)' },
  loss:    { bg: 'rgba(255,77,109,0.1)', color: 'var(--red)',   border: 'rgba(255,77,109,0.2)' },
  warn:    { bg: 'rgba(245,166,35,0.1)', color: 'var(--amber)', border: 'rgba(245,166,35,0.2)' },
  accent:  { bg: 'rgba(77,159,255,0.1)', color: 'var(--blue)',  border: 'rgba(77,159,255,0.2)' },
  neutral: { bg: 'var(--bg3)',           color: 'var(--text2)', border: 'var(--border)' },
  muted:   { bg: 'transparent',          color: 'var(--text3)', border: 'var(--border)' },
}

interface BadgeProps {
  children:  ReactNode
  variant?:  Variant
  style?:    React.CSSProperties
}

export function Badge({ children, variant = 'neutral', style }: BadgeProps) {
  const s = STYLES[variant]
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:        '2px 8px',
      borderRadius:   4,
      border:         `1px solid ${s.border}`,
      background:     s.bg,
      color:          s.color,
      fontFamily:     'var(--font-mono)',
      fontSize:       '0.65rem',
      fontWeight:     600,
      textTransform:  'uppercase',
      letterSpacing:  '0.04em',
      ...style,
    }}>
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

export function pnlColor(pnl: number): string {
  if (pnl > 0)  return 'var(--green)'
  if (pnl < 0)  return 'var(--red)'
  return 'var(--text3)'
}

export function pnlSign(pnl: number) {
  return pnl >= 0 ? `+€${pnl.toFixed(2)}` : `-€${Math.abs(pnl).toFixed(2)}`
}
