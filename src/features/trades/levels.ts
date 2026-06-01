export interface CandidateLevels {
  entryLow:  number
  entryHigh: number
  stop:      number
  t1:        number
  t2:        number
  rr:        number
  posEur:    number
  shares:    number
  stopPct:   number
}

export function calcEmaGap(ema20?: number | null, ema50?: number | null): number {
  if (!ema20 || !ema50 || ema50 === 0) return 0
  return ((ema20 - ema50) / ema50) * 100
}

/**
 * Derives entry range, stop, targets, position size and share count from a
 * screened candidate.
 *
 * Entry: anchored to EMA20 (the retest level) ±0.3% when EMA data is present;
 *        falls back to current price −0.3%/−1.5% without EMA data.
 *
 * Stop: structural — placed 0.7% below EMA50 when a bullish EMA stack exists
 *       (EMA50 is the level where the trade is invalidated if EMA20 breaks);
 *       falls back to a mechanical distance below EMA20 when EMA50 is absent
 *       or the EMA stack is not bullish.
 *
 * Targets: from current price, scaled by the EMA-gap-derived trend-strength
 *          proxy so stronger trends produce wider upside objectives.
 */
export function calcCandidateLevels(c: {
  price: number
  ema20?: number | null
  ema50?: number | null
}): CandidateLevels {
  const emaGap   = calcEmaGap(c.ema20, c.ema50)
  const emaGapSd = Math.max(0.025, Math.min(0.055, 0.03 + emaGap / 100))

  const hasEma20 = c.ema20 != null && c.ema20 > 0
  const hasEma50 = c.ema50 != null && c.ema50 > 0

  // Entry: anchor to EMA20 (the retest level); fall back to current price
  const entryHigh = hasEma20 ? c.ema20! * 1.003 : c.price * 0.997
  const entryLow  = hasEma20 ? c.ema20! * 0.997 : c.price * 0.985

  // Structural stop:
  // - Bullish stack (emaGap > 0, both EMAs): 0.7% below EMA50 (entry invalidation level)
  // - EMA20 only or bearish/flat stack:      emaGapSd below EMA20
  // - No EMAs:                               emaGapSd below entryLow
  const stop = (hasEma50 && emaGap > 0)
    ? c.ema50! * (1 - 0.007)
    : hasEma20
      ? c.ema20! * (1 - emaGapSd)
      : entryLow * (1 - emaGapSd)

  // Actual stop distance from entryLow — floor at 0.5% to protect position sizing
  const stopDist = Math.max(entryLow - stop, 0.001)
  const sd       = Math.max(stopDist / entryLow, 0.005)

  // Targets from current price, scaled by emaGapSd (trend strength proxy)
  const t1 = c.price * (1 + emaGapSd * 2.5)
  const t2 = c.price * (1 + emaGapSd * 4)
  const rr = (t1 - entryLow) / stopDist

  const posEur = Math.min(12 / sd, 595)
  const shares = Math.floor((posEur * 1.09) / c.price)

  return { entryLow, entryHigh, stop, t1, t2, rr, posEur, shares, stopPct: sd * 100 }
}
