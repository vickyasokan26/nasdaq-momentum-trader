import { type ReactNode } from 'react'

interface StatCardProps {
  label:   string
  value:   ReactNode
  sub?:    ReactNode
  accent?: 'gain' | 'loss' | 'warn' | 'accent' | 'neutral'
}

const BORDER_MAP: Record<string, string> = {
  gain:    'rgba(0,214,124,0.18)',
  loss:    'rgba(255,77,109,0.18)',
  warn:    'rgba(245,166,35,0.18)',
  accent:  'rgba(77,159,255,0.18)',
  neutral: 'var(--border)',
}

const VALUE_COLOR: Record<string, string> = {
  gain:    'var(--green)',
  loss:    'var(--red)',
  warn:    'var(--amber)',
  accent:  'var(--blue)',
  neutral: 'var(--text)',
}

export function StatCard({ label, value, sub, accent = 'neutral' }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${BORDER_MAP[accent]}`,
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 600,
        color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 600,
        color: VALUE_COLOR[accent], fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
