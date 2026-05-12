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
 * screened candidate. Stop distance is dynamically scaled by the EMA20/EMA50
 * gap (wider gap = more momentum room = tighter stop) and clamped to 2.5–5.5%.
 */
export function calcCandidateLevels(c: {
  price: number
  ema20?: number | null
  ema50?: number | null
}): CandidateLevels {
  const emaGap    = calcEmaGap(c.ema20, c.ema50)
  const sd        = Math.max(0.025, Math.min(0.055, 0.03 + emaGap / 100))
  const entryLow  = c.price * 0.985
  const entryHigh = c.price * 0.997
  const stop      = entryLow * (1 - sd)
  const t1        = c.price * (1 + sd * 2.5)
  const t2        = c.price * (1 + sd * 4)
  const rr        = (t1 - entryLow) / (entryLow - stop)
  const posEur    = Math.min(12 / sd, 595)
  const shares    = Math.floor((posEur * 1.09) / c.price)
  return { entryLow, entryHigh, stop, t1, t2, rr, posEur, shares, stopPct: sd * 100 }
}
