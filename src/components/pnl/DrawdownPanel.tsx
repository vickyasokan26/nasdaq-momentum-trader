'use client'

import { pnlSign, pnlColor } from '@/components/ui/Badge'
import type { DrawdownStatus } from '@/types'

interface Props {
  data?: {
    drawdown: DrawdownStatus
    settings: { accountSizeEur: number; maxDailyLossEur: number; maxWeeklyLossEur: number }
    weeklyHistory: Array<{ pnlDate: string; netPnlEur: number }>
  }
}

function ProgressBar({
  used, label, limit, stopHit,
}: {
  used: number; label: string; limit: number; stopHit: boolean
}) {
  const pct        = Math.min(1, used)
  const barColor   =
    stopHit          ? 'bg-loss' :
    pct > 0.75       ? 'bg-loss' :
    pct > 0.5        ? 'bg-warn' : 'bg-gain'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xxs font-mono text-text-muted uppercase tracking-widest">{label}</span>
        <span className={`text-xxs font-mono tabular ${stopHit ? 'text-loss' : 'text-text-secondary'}`}>
          {(pct * 100).toFixed(0)}% of €{limit.toFixed(0)}
          {stopHit && <span className="ml-1 text-loss font-bold animate-pulse">STOP</span>}
        </span>
      </div>
      <div className="h-1.5 bg-desk-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

export function DrawdownPanel({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-desk-surface border border-desk-border rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-desk-raised rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-3 bg-desk-raised rounded" />
          <div className="h-3 bg-desk-raised rounded" />
        </div>
      </div>
    )
  }

  const { drawdown, settings } = data
  const dailyPnlColor   = pnlColor(drawdown.dailyPnl)
  const weeklyPnlColor  = pnlColor(drawdown.weeklyPnl)

  return (
    <div className={`bg-desk-surface border rounded-xl p-5 ${
      drawdown.dailyStopHit || drawdown.weeklyStopHit
        ? 'border-loss/40 shadow-glow-loss'
        : 'border-desk-border'
    }`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest">
          Drawdown Guard
        </h3>
        <span className="text-xxs font-mono text-text-muted">€{settings.accountSizeEur.toFixed(0)} account</span>
      </div>

      {/* Stop hit alert */}
      {(drawdown.dailyStopHit || drawdown.weeklyStopHit) && (
        <div className="bg-loss/10 border border-loss/30 rounded-lg px-3 py-2.5 mb-4 animate-fade-in">
          <p className="text-sm font-mono font-semibold text-loss">
            ⛔ {drawdown.dailyStopHit ? 'Daily' : 'Weekly'} loss limit reached — STOP TRADING
          </p>
          <p className="text-xs font-mono text-text-muted mt-0.5">
            Protect the account. Do not override this.
          </p>
        </div>
      )}

      {/* P&L summary */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="text-xxs font-mono text-text-muted uppercase tracking-widest mb-1">Today P&amp;L</div>
          <div className={`text-2xl font-mono font-semibold tabular ${dailyPnlColor}`}>
            {pnlSign(drawdown.dailyPnl)}
          </div>
          <div className="text-xxs font-mono text-text-muted mt-0.5">
            Target: +€20 → +€30
          </div>
        </div>
        <div>
          <div className="text-xxs font-mono text-text-muted uppercase tracking-widest mb-1">This Week</div>
          <div className={`text-2xl font-mono font-semibold tabular ${weeklyPnlColor}`}>
            {pnlSign(drawdown.weeklyPnl)}
          </div>
          <div className="text-xxs font-mono text-text-muted mt-0.5">
            Target: +€100 → +€150
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-3">
        <ProgressBar
          label="Daily loss used"
          used={drawdown.dailyLimitUsedPct}
          limit={settings.maxDailyLossEur}
          stopHit={drawdown.dailyStopHit}
        />
        <ProgressBar
          label="Weekly loss used"
          used={drawdown.weeklyLimitUsedPct}
          limit={settings.maxWeeklyLossEur}
          stopHit={drawdown.weeklyStopHit}
        />
      </div>
    </div>
  )
}
