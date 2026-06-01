import { calcEmaGap, calcCandidateLevels } from '@/features/trades/levels'

// ── calcEmaGap ────────────────────────────────────────────────────────────────

describe('calcEmaGap', () => {
  it('returns 0 when EMAs are missing', () => {
    expect(calcEmaGap(undefined, undefined)).toBe(0)
    expect(calcEmaGap(null, null)).toBe(0)
    expect(calcEmaGap(50, null)).toBe(0)
    expect(calcEmaGap(null, 50)).toBe(0)
  })

  it('returns 0 when ema50 is zero (guard against division)', () => {
    expect(calcEmaGap(10, 0)).toBe(0)
  })

  it('calculates positive gap when ema20 > ema50', () => {
    // ema20=105, ema50=100 → 5%
    expect(calcEmaGap(105, 100)).toBeCloseTo(5.0)
  })

  it('calculates negative gap when ema20 < ema50', () => {
    // ema20=95, ema50=100 → -5%
    expect(calcEmaGap(95, 100)).toBeCloseTo(-5.0)
  })

  it('returns 0 when EMAs are equal', () => {
    expect(calcEmaGap(100, 100)).toBe(0)
  })
})

// ── calcCandidateLevels — structural stop ─────────────────────────────────────
// stopPct reflects the ACTUAL distance from entryLow to the structural stop,
// not the emaGapSd formula. Tests below verify stop placement per EMA scenario.

describe('calcCandidateLevels — structural stop', () => {
  it('defaults to 3% mechanical stop when no EMA data provided', () => {
    // No EMAs → fallback: stop = entryLow * (1 - 0.03)
    const lvl = calcCandidateLevels({ price: 100 })
    expect(lvl.stopPct).toBeCloseTo(3.0)
  })

  it('bullish EMA stack — stop is 0.7% below EMA50 (entry invalidation level)', () => {
    // ema20=105, ema50=100 → emaGap=5% (bullish) → stop = 100 * 0.993 = 99.3
    const lvl = calcCandidateLevels({ price: 100, ema20: 105, ema50: 100 })
    expect(lvl.stop).toBeCloseTo(100 * (1 - 0.007))
  })

  it('tight bullish EMA stack — structural stop below EMA50', () => {
    // ema20=101, ema50=100 → emaGap=1% (bullish) → stop = 100 * 0.993 = 99.3
    const lvl = calcCandidateLevels({ price: 100, ema20: 101, ema50: 100 })
    expect(lvl.stop).toBeCloseTo(100 * (1 - 0.007))
    // entry anchored to EMA20=101, so stopPct reflects (entryLow - stop)/entryLow
    const entryLow = 101 * 0.997
    const stopDist = entryLow - 99.3
    expect(lvl.stopPct).toBeCloseTo((stopDist / entryLow) * 100)
  })

  it('bearish EMA stack — falls back to mechanical stop below EMA20', () => {
    // ema20=95, ema50=100 → emaGap=-5% (bearish) → no structural stop below EMA50
    // falls back: stop = ema20 * (1 - emaGapSd_clamped_to_0.025) = 95 * 0.975 = 92.625
    const lvl = calcCandidateLevels({ price: 100, ema20: 95, ema50: 100 })
    expect(lvl.stop).toBeCloseTo(95 * (1 - 0.025))
  })

  it('EMA20 only (no EMA50) — falls back to mechanical stop below EMA20', () => {
    // No EMA50 → stop = ema20 * (1 - emaGapSd) where emaGapSd=0.03 (emaGap=0)
    const lvl = calcCandidateLevels({ price: 100, ema20: 99 })
    expect(lvl.stop).toBeCloseTo(99 * (1 - 0.03))
  })
})

// ── calcCandidateLevels — entry range ─────────────────────────────────────────

describe('calcCandidateLevels — entry range', () => {
  // No-EMA fallback: keeps original wide zone below current price
  it('sets entryLow at 1.5% below screened price when no EMA available', () => {
    const { entryLow } = calcCandidateLevels({ price: 100 })
    expect(entryLow).toBeCloseTo(98.5)
  })

  it('sets entryHigh at 0.3% below screened price when no EMA available', () => {
    const { entryHigh } = calcCandidateLevels({ price: 100 })
    expect(entryHigh).toBeCloseTo(99.7)
  })

  it('scales both entry bounds with the screened price (no EMA fallback)', () => {
    const { entryLow, entryHigh } = calcCandidateLevels({ price: 200 })
    expect(entryLow).toBeCloseTo(197.0)
    expect(entryHigh).toBeCloseTo(199.4)
  })

  // EMA-anchored: entry zone is ±0.3% around EMA20, NOT current price
  it('anchors entry zone to EMA20 when EMA data is available', () => {
    // price=100 but ema20=95 — entry should be near 95, not near 100
    const { entryLow, entryHigh } = calcCandidateLevels({ price: 100, ema20: 95, ema50: 90 })
    expect(entryLow).toBeCloseTo(95 * 0.997)
    expect(entryHigh).toBeCloseTo(95 * 1.003)
  })

  it('entry zone is ±0.3% around EMA20 (retest tolerance)', () => {
    const { entryLow, entryHigh } = calcCandidateLevels({ price: 100, ema20: 99, ema50: 96 })
    expect(entryLow).toBeCloseTo(99 * 0.997)
    expect(entryHigh).toBeCloseTo(99 * 1.003)
  })
})

// ── calcCandidateLevels — stop price ──────────────────────────────────────────

describe('calcCandidateLevels — stop price', () => {
  it('places stop below entryLow by the stop-distance fraction (no EMA fallback)', () => {
    const price = 100
    const lvl   = calcCandidateLevels({ price })
    // sd=0.03, entryLow=98.5, stop=98.5*(1-0.03)=95.545
    expect(lvl.stop).toBeCloseTo(98.5 * (1 - 0.03))
  })

  it('stop is always below entryLow regardless of EMA configuration', () => {
    for (const emaGapBias of [-5, 0, 5, 15]) {
      const ema20 = 100 + emaGapBias
      const lvl   = calcCandidateLevels({ price: 100, ema20, ema50: 100 })
      expect(lvl.stop).toBeLessThan(lvl.entryLow)
    }
  })
})

// ── calcCandidateLevels — targets ─────────────────────────────────────────────
// Targets are scaled by the EMA-gap-derived trend-strength proxy (emaGapSd),
// not by stopPct. For the no-EMA fallback, emaGapSd === stopPct/100, so the
// two formulations agree and the tests below remain valid for that case.

describe('calcCandidateLevels — targets', () => {
  it('T1 is 2.5× emaGapSd above the screened price (no-EMA default)', () => {
    const price = 100
    const { t1, stopPct } = calcCandidateLevels({ price })
    const sd = stopPct / 100  // equals emaGapSd when no EMAs (both = 0.03)
    expect(t1).toBeCloseTo(price * (1 + sd * 2.5))
  })

  it('T2 is 4× emaGapSd above the screened price (no-EMA default)', () => {
    const price = 100
    const { t2, stopPct } = calcCandidateLevels({ price })
    const sd = stopPct / 100
    expect(t2).toBeCloseTo(price * (1 + sd * 4))
  })

  it('T2 is always above T1', () => {
    const lvl = calcCandidateLevels({ price: 100 })
    expect(lvl.t2).toBeGreaterThan(lvl.t1)
  })

  it('both targets are above entryLow', () => {
    const lvl = calcCandidateLevels({ price: 50, ema20: 52, ema50: 50 })
    expect(lvl.t1).toBeGreaterThan(lvl.entryLow)
    expect(lvl.t2).toBeGreaterThan(lvl.entryLow)
  })

  it('T1 gives at least 2:1 R:R at the 3% default stop (no EMA)', () => {
    const { rr } = calcCandidateLevels({ price: 100 })
    expect(rr).toBeGreaterThanOrEqual(2)
  })

  it('targets are above current price even when structural stop is tight', () => {
    // ema20=105, ema50=100 → structural stop below EMA50, targets from price
    const { t1, t2 } = calcCandidateLevels({ price: 100, ema20: 105, ema50: 100 })
    expect(t1).toBeGreaterThan(100)
    expect(t2).toBeGreaterThan(t1)
  })

  it('wider EMA gap produces higher targets (trend strength proxy)', () => {
    const narrow = calcCandidateLevels({ price: 100, ema20: 101, ema50: 100 })
    const wide   = calcCandidateLevels({ price: 100, ema20: 105, ema50: 100 })
    expect(wide.t1).toBeGreaterThan(narrow.t1)
    expect(wide.t2).toBeGreaterThan(narrow.t2)
  })
})

// ── calcCandidateLevels — position sizing ─────────────────────────────────────

describe('calcCandidateLevels — position sizing', () => {
  it('posEur = risk(€12) / stop-distance fraction (no EMA default)', () => {
    // sd=0.03 → posEur = 12/0.03 = 400
    const { posEur } = calcCandidateLevels({ price: 100 })
    expect(posEur).toBeCloseTo(400)
  })

  it('posEur is higher when stop distance is tighter (lower sd)', () => {
    const tight = calcCandidateLevels({ price: 100, ema20: 95, ema50: 100 }) // bearish → EMA20-based stop
    const wide  = calcCandidateLevels({ price: 100, ema20: 110, ema50: 100 }) // wide gap → big stop vs EMA50
    expect(tight.posEur).toBeGreaterThan(wide.posEur)
  })

  it('shares = floor(posEur × 1.09 / price)', () => {
    const price = 100
    const { posEur, shares } = calcCandidateLevels({ price })
    expect(shares).toBe(Math.floor((posEur * 1.09) / price))
  })

  it('shares rounds down — never rounds up', () => {
    // price=50, no EMA → posEur=400, shares=floor(400*1.09/50)=floor(8.72)=8
    const { shares } = calcCandidateLevels({ price: 50 })
    expect(shares).toBe(8)
  })

  it('returns 0 shares for very high priced stocks', () => {
    // price=1000, no EMA → posEur≈400 → floor(436/1000)=0
    const { shares } = calcCandidateLevels({ price: 1000 })
    expect(shares).toBe(0)
  })

  it('posEur reaches the 595 cap when structural stop is very tight', () => {
    // ema20 ≈ ema50 → stop just below ema50 → stopDist < 0.5% → sd clamped → posEur caps
    const { posEur } = calcCandidateLevels({ price: 100, ema20: 100, ema50: 99.9 })
    expect(posEur).toBe(595)
  })
})
