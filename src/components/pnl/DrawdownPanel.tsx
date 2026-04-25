'use client'

import { pnlSign } from '@/components/ui/Badge'
import type { DrawdownStatus } from '@/types'

interface Props {
  data?: {
    drawdown: DrawdownStatus
    settings: { accountSizeEur: number; maxDailyLossEur: number; maxWeeklyLossEur: number }
    weeklyHistory: Array<{ pnlDate: string; netPnlEur: number }>
  }
}

function pnlCssColor(pnl: number) {
  if (pnl > 0) return 'var(--green)'
  if (pnl < 0) return 'var(--red)'
  return 'var(--text3)'
}

function ProgressBar({ used, label, limit, stopHit }: {
  used: number; label: string; limit: number; stopHit: boolean
}) {
  const pct      = Math.min(1, used)
  const barColor = stopHit || pct > 0.75 ? 'var(--red)' : pct > 0.5 ? 'var(--amber)' : 'var(--green)'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: stopHit ? 'var(--red)' : 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
          {(pct * 100).toFixed(0)}% of €{limit.toFixed(0)}
          {stopHit && <span style={{ marginLeft: 6, color: 'var(--red)', fontWeight: 700 }}>STOP</span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: barColor, width: `${pct * 100}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export function DrawdownPanel({ data }: Props) {
  if (!data) {
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ height: 14, background: 'var(--bg3)', borderRadius: 4, width: '30%', marginBottom: 20 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ height: 10, background: 'var(--bg3)', borderRadius: 4 }} />
          <div style={{ height: 10, background: 'var(--bg3)', borderRadius: 4 }} />
        </div>
      </div>
    )
  }

  const { drawdown, settings } = data
  const hasStop = drawdown.dailyStopHit || drawdown.weeklyStopHit

  return (
    <div style={{
      background:   'var(--bg2)',
      border:       hasStop ? '1px solid rgba(255,77,109,0.4)' : '1px solid var(--border)',
      boxShadow:    hasStop ? '0 0 16px rgba(255,77,109,0.15)' : 'none',
      borderRadius: 12,
      padding:      20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Drawdown Guard
        </h3>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>
          €{settings.accountSizeEur.toFixed(0)} account
        </span>
      </div>

      {hasStop && (
        <div style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)' }}>
            ⛔ {drawdown.dailyStopHit ? 'Daily' : 'Weekly'} loss limit reached — STOP TRADING
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text3)', marginTop: 4 }}>
            Protect the account. Do not override this.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Today P&amp;L</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 600, color: pnlCssColor(drawdown.dailyPnl), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {pnlSign(drawdown.dailyPnl)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 6 }}>Target: +€20 → +€30</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>This Week</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 600, color: pnlCssColor(drawdown.weeklyPnl), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {pnlSign(drawdown.weeklyPnl)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 6 }}>Target: +€100 → +€150</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
