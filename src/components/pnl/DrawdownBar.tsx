'use client'

import { useQuery } from '@tanstack/react-query'
import { pnlSign } from '@/components/ui/Badge'

export function DrawdownBar({ compact }: { compact?: boolean }) {
  const { data } = useQuery({
    queryKey:        ['pnl'],
    queryFn:         () => fetch('/api/pnl').then(r => r.json()),
    refetchInterval: 60_000,
  })

  if (!data?.drawdown) return null

  const { drawdown } = data
  const daily   = drawdown.dailyPnl
  const usedPct = drawdown.dailyLimitUsedPct

  const barColor =
    drawdown.dailyStopHit ? 'var(--red)'   :
    usedPct > 0.75        ? 'var(--red)'   :
    usedPct > 0.5         ? 'var(--amber)' : 'var(--green)'

  const pnlCssColor = daily > 0 ? 'var(--green)' : daily < 0 ? 'var(--red)' : 'var(--text3)'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>Today</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, color: pnlCssColor, fontVariantNumeric: 'tabular-nums' }}>
          {pnlSign(daily)}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          borderRadius: 999,
          background: barColor,
          width: `${Math.max(2, usedPct * 100)}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>
      {drawdown.dailyStopHit && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--red)', marginTop: 4 }}>⛔ Stop hit</p>
      )}
    </div>
  )
}
