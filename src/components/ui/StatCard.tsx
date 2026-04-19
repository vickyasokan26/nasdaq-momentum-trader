import { type ReactNode } from 'react'

interface StatCardProps {
  label:     string
  value:     ReactNode
  sub?:      ReactNode
  accent?:   'gain' | 'loss' | 'warn' | 'accent' | 'neutral'
  className?: string
}

const ACCENT_MAP = {
  gain:    'border-gain/20',
  loss:    'border-loss/20',
  warn:    'border-warn/20',
  accent:  'border-accent/20',
  neutral: 'border-desk-border',
}

const VALUE_MAP = {
  gain:    'text-gain',
  loss:    'text-loss',
  warn:    'text-warn',
  accent:  'text-accent',
  neutral: 'text-text-primary',
}

export function StatCard({ label, value, sub, accent = 'neutral', className = '' }: StatCardProps) {
  return (
    <div className={`bg-desk-surface border ${ACCENT_MAP[accent]} rounded-xl p-4 ${className}`}>
      <div className="text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-2">
        {label}
      </div>
      <div className={`text-2xl font-mono font-semibold tabular ${VALUE_MAP[accent]}`}>
        {value}
      </div>
      {sub && (
        <div className="text-xs font-mono text-text-muted mt-1">{sub}</div>
      )}
    </div>
  )
}
