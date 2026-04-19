'use client'

import { useQuery } from '@tanstack/react-query'
import { pnlSign, pnlColor } from '@/components/ui/Badge'

export function DrawdownBar({ compact }: { compact?: boolean }) {
  const { data } = useQuery({
    queryKey:       ['pnl'],
    queryFn:        () => fetch('/api/pnl').then(r => r.json()),
    refetchInterval: 60_000,
  })

  if (!data?.drawdown) return null

  const { drawdown } = data
  const daily  = drawdown.dailyPnl
  const usedPct = drawdown.dailyLimitUsedPct

  const barColor =
    drawdown.dailyStopHit   ? 'bg-loss' :
    usedPct > 0.75          ? 'bg-loss' :
    usedPct > 0.5           ? 'bg-warn' : 'bg-gain'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xxs font-mono text-text-muted">Today</span>
        <span className={`text-xxs font-mono font-semibold tabular ${pnlColor(daily)}`}>
          {pnlSign(daily)}
        </span>
      </div>
      <div className="h-1 bg-desk-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(2, usedPct * 100)}%` }}
        />
      </div>
      {drawdown.dailyStopHit && (
        <p className="text-xxs font-mono text-loss mt-1 animate-pulse">⛔ Stop hit</p>
      )}
    </div>
  )
}
