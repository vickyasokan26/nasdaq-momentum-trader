/**
 * P&L and Drawdown Calculations
 *
 * Daily P&L is derived from closed trades — not a manually typed number.
 * Manual adjustments are additive (commissions, fees, etc.)
 */

import type { DrawdownStatus } from '@/types'
import { ACCOUNT } from '@/constants/screener'
import { startOfDay, endOfDay, isAfter, isBefore, addDays } from 'date-fns'

export interface TradeForPnl {
  closedAt?:  Date | null
  pnlEur?:    number | null
  status:     string
}

/** Calculate system P&L from closed trades on a given UTC date */
export function calcDayPnl(trades: TradeForPnl[], date: Date): number {
  const start = startOfDay(date)
  const end   = endOfDay(date)

  return trades
    .filter(t =>
      t.status === 'CLOSED' &&
      t.closedAt !== null &&
      t.closedAt !== undefined &&
      isAfter(t.closedAt, start) &&
      isBefore(t.closedAt, end) &&
      t.pnlEur !== null &&
      t.pnlEur !== undefined
    )
    .reduce((sum, t) => sum + (t.pnlEur ?? 0), 0)
}

/** Calculate week P&L from closed trades in a date range */
export function calcWeekPnl(trades: TradeForPnl[], weekStart: Date): number {
  const weekEnd = addDays(weekStart, 7)
  return trades
    .filter(t =>
      t.status === 'CLOSED' &&
      t.closedAt !== null &&
      t.closedAt !== undefined &&
      isAfter(t.closedAt, startOfDay(weekStart)) &&
      isBefore(t.closedAt, startOfDay(weekEnd)) &&
      t.pnlEur !== null &&
      t.pnlEur !== undefined
    )
    .reduce((sum, t) => sum + (t.pnlEur ?? 0), 0)
}

/** Full drawdown status object */
export function calcDrawdownStatus(
  dailyPnl:   number,
  weeklyPnl:  number,
  settings: { maxDailyLossEur: number; maxWeeklyLossEur: number }
): DrawdownStatus {
  const dailyLimit  = settings.maxDailyLossEur
  const weeklyLimit = settings.maxWeeklyLossEur

  // Loss is expressed as negative pnl
  const dailyUsed   = Math.max(0, -dailyPnl)
  const weeklyUsed  = Math.max(0, -weeklyPnl)

  return {
    dailyPnl,
    dailyLimit,
    dailyLimitUsedPct:   Math.min(1, dailyUsed / dailyLimit),
    weeklyPnl,
    weeklyLimit,
    weeklyLimitUsedPct:  Math.min(1, weeklyUsed / weeklyLimit),
    dailyStopHit:        dailyUsed >= dailyLimit,
    weeklyStopHit:       weeklyUsed >= weeklyLimit,
  }
}

/** Check whether today trading is allowed based on drawdown */
export interface TradingPermission {
  allowed:  boolean
  reason?:  string
  warning?: string
}

export function checkTradingPermission(status: DrawdownStatus): TradingPermission {
  if (status.dailyStopHit) {
    return {
      allowed: false,
      reason:  `Daily loss limit reached (€${Math.abs(status.dailyPnl).toFixed(2)} lost). STOP trading for today. Protect the account.`,
    }
  }
  if (status.weeklyStopHit) {
    return {
      allowed: false,
      reason:  `Weekly loss limit reached (€${Math.abs(status.weeklyPnl).toFixed(2)} lost). STOP trading. Review your process before next week.`,
    }
  }
  if (status.dailyLimitUsedPct >= 0.5) {
    return {
      allowed:  true,
      warning:  `50% of daily loss limit used (€${Math.abs(status.dailyPnl).toFixed(2)}). Reduce size or be more selective.`,
    }
  }
  return { allowed: true }
}

/** Format P&L with sign and currency */
export function formatEur(amount: number, alwaysSign = false): string {
  const sign   = amount >= 0 ? (alwaysSign ? '+' : '') : '-'
  const abs    = Math.abs(amount)
  return `${sign}€${abs.toFixed(2)}`
}

/** Express P&L as R-multiple */
export function toRMultiple(pnl: number, riskEur: number): number {
  if (riskEur === 0) return 0
  return pnl / riskEur
}
