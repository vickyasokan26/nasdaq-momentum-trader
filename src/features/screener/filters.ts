/**
 * Screener Filter Engine
 *
 * Applies all rules in sequence. Each filter tracks its drop count.
 * Returns passing candidates and a full drop summary for the validation report.
 */

import { addDays, differenceInCalendarDays } from 'date-fns'
import type { CanonicalRow, FilterDropSummary } from '@/types'
import { SCREENER } from '@/constants/screener'

export interface FilterResult {
  passing: CanonicalRow[]
  drops:   FilterDropSummary
}

interface MutableDrops {
  priceFloor:    number
  trendFilter:   number
  rsiGate:       number
  emaStack:      number
  relVolGate:    number
  spikeGuard:    number
  earningsGate:  number
  dist52whGate:  number
  marketCapGate: number
  [key: string]: number
}

/** Parse an earnings date string into a Date, returning null if invalid */
function parseEarningsDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

/** Days until earnings from today. Negative = already passed. */
function daysUntilEarnings(earningsDate: Date): number {
  return differenceInCalendarDays(earningsDate, new Date())
}

export function applyScreenerFilters(rows: CanonicalRow[]): FilterResult {
  const drops: MutableDrops = {
    priceFloor:    0,
    trendFilter:   0,
    rsiGate:       0,
    emaStack:      0,
    relVolGate:    0,
    spikeGuard:    0,
    earningsGate:  0,
    dist52whGate:  0,
    marketCapGate: 0,
  }

  const passing: CanonicalRow[] = []

  for (const row of rows) {
    // 1. Price floor
    if (row.price <= SCREENER.MIN_PRICE) {
      drops.priceFloor++
      continue
    }

    // 2. Trend filter: price > SMA50
    if (row.sma50 !== undefined && row.price <= row.sma50) {
      drops.trendFilter++
      continue
    }

    // 3. RSI gate (screener range — wider than entry trigger)
    if (
      row.rsi14 !== undefined &&
      (row.rsi14 < SCREENER.RSI_MIN || row.rsi14 > SCREENER.RSI_MAX)
    ) {
      drops.rsiGate++
      continue
    }

    // 4. EMA stack: ema20 > ema50
    if (
      row.ema20 !== undefined &&
      row.ema50 !== undefined &&
      row.ema20 <= row.ema50
    ) {
      drops.emaStack++
      continue
    }

    // 5. Relative volume gate
    if (row.relativeVolume !== undefined && row.relativeVolume < SCREENER.MIN_REL_VOL) {
      drops.relVolGate++
      continue
    }

    // 6. Spike guard (weekly change)
    if (row.chg1w !== undefined && row.chg1w > SCREENER.MAX_CHG_1W) {
      drops.spikeGuard++
      continue
    }

    // 7. Earnings blackout
    if (row.upcomingEarningsDate) {
      const earningsDate = parseEarningsDate(row.upcomingEarningsDate)
      if (earningsDate) {
        const daysOut = daysUntilEarnings(earningsDate)
        // Skip if earnings is within blackout window (0–10 days away)
        if (daysOut >= 0 && daysOut <= SCREENER.EARNINGS_BLACKOUT_DAYS) {
          drops.earningsGate++
          continue
        }
      }
    }

    // 8. 52-week high distance gate
    if (row.high52w !== undefined && row.high52w > 0) {
      const distPct = ((row.high52w - row.price) / row.high52w) * 100
      if (distPct < SCREENER.DIST_52WH_MIN || distPct > SCREENER.DIST_52WH_MAX) {
        drops.dist52whGate++
        continue
      }
      // Store computed distance on the row for ranking
      ;(row as CanonicalRow & { dist52wh?: number }).dist52wh = distPct
    }

    // 9. Market cap gate
    if (row.marketCap !== undefined && row.marketCap < SCREENER.MIN_MARKET_CAP) {
      drops.marketCapGate++
      continue
    }

    passing.push(row)
  }

  return { passing, drops }
}

/** Check if a single candidate passes the daily regime check for entries */
export interface RegimeCheck {
  passes:    boolean
  reasons:   string[]
}

export function checkDailyRegime(row: {
  price:  number
  ema20?: number
  ema50?: number
  sma50?: number
  rsi14?: number
}): RegimeCheck {
  const reasons: string[] = []

  if (row.sma50 !== undefined && row.price < row.sma50) {
    reasons.push('Price below SMA50 — trend not confirmed')
  }
  if (row.ema20 !== undefined && row.ema50 !== undefined && row.ema20 <= row.ema50) {
    reasons.push('EMA20 not above EMA50 — no bullish EMA stack')
  }
  if (row.rsi14 !== undefined && (row.rsi14 < 45 || row.rsi14 > 75)) {
    reasons.push(`RSI ${row.rsi14.toFixed(1)} outside 45-75 daily regime range`)
  }

  return { passes: reasons.length === 0, reasons }
}
