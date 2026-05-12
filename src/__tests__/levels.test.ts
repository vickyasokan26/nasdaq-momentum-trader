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

// ── calcCandidateLevels — stop distance clamping ──────────────────────────────

describe('calcCandidateLevels — stop distance', () => {
  it('defaults to 3% stop when no EMA data provided', () => {
    const lvl = calcCandidateLevels({ price: 100 })
    expect(lvl.stopPct).toBeCloseTo(3.0)
  })

  it('clamps stop distance to 2.5% floor when EMAs are compressed', () => {
    // ema20=95, ema50=100 → emaGap=-5% → sd=0.03-0.05=-0.02 → clamped to 0.025
    const lvl = calcCandidateLevels({ price: 100, ema20: 95, ema50: 100 })
    expect(lvl.stopPct).toBeCloseTo(2.5)
  })

  it('clamps stop distance to 5.5% ceiling when EMAs are wide', () => {
    // ema20=110, ema50=100 → emaGap=10% → sd=0.03+0.10=0.13 → clamped to 0.055
    const lvl = calcCandidateLevels({ price: 100, ema20: 110, ema50: 100 })
    expect(lvl.stopPct).toBeCloseTo(5.5)
  })

  it('uses unclamped stop distance within the 2.5–5.5% range', () => {
    // ema20=101, ema50=100 → emaGap=1% → sd=0.03+0.01=0.04 → no clamping
    const lvl = calcCandidateLevels({ price: 100, ema20: 101, ema50: 100 })
    expect(lvl.stopPct).toBeCloseTo(4.0)
  })
})

// ── calcCandidateLevels — entry range ────────────────────────────────────────

describe('calcCandidateLevels — entry range', () => {
  it('sets entryLow at 1.5% below screened price', () => {
    const { entryLow } = calcCandidateLevels({ price: 100 })
    expect(entryLow).toBeCloseTo(98.5)
  })

  it('sets entryHigh at 0.3% below screened price', () => {
    const { entryHigh } = calcCandidateLevels({ price: 100 })
    expect(entryHigh).toBeCloseTo(99.7)
  })

  it('scales both entry bounds with the screened price', () => {
    const { entryLow, entryHigh } = calcCandidateLevels({ price: 200 })
    expect(entryLow).toBeCloseTo(197.0)
    expect(entryHigh).toBeCloseTo(199.4)
  })
})

// ── calcCandidateLevels — stop price ─────────────────────────────────────────

describe('calcCandidateLevels — stop price', () => {
  it('places stop below entryLow by the stop-distance fraction', () => {
    const price = 100
    const lvl   = calcCandidateLevels({ price })
    // sd=0.03, entryLow=98.5, stop=98.5*(1-0.03)=95.545
    expect(lvl.stop).toBeCloseTo(98.5 * (1 - 0.03))
  })

  it('stop is always below entryLow', () => {
    for (const emaGapBias of [-5, 0, 5, 15]) {
      const ema20 = 100 + emaGapBias
      const lvl   = calcCandidateLevels({ price: 100, ema20, ema50: 100 })
      expect(lvl.stop).toBeLessThan(lvl.entryLow)
    }
  })
})

// ── calcCandidateLevels — targets ─────────────────────────────────────────────

describe('calcCandidateLevels — targets', () => {
  it('T1 is 2.5× the stop distance above the screened price', () => {
    const price = 100
    const { t1, stopPct } = calcCandidateLevels({ price })
    const sd = stopPct / 100
    expect(t1).toBeCloseTo(price * (1 + sd * 2.5))
  })

  it('T2 is 4× the stop distance above the screened price', () => {
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

  it('T1 gives at least 2:1 R:R at the 3% default stop', () => {
    const { rr } = calcCandidateLevels({ price: 100 })
    expect(rr).toBeGreaterThanOrEqual(2)
  })
})

// ── calcCandidateLevels — position sizing ────────────────────────────────────

describe('calcCandidateLevels — position sizing', () => {
  it('posEur = risk(€12) / stop-distance fraction', () => {
    // sd=0.03 → posEur = 12/0.03 = 400
    const { posEur } = calcCandidateLevels({ price: 100 })
    expect(posEur).toBeCloseTo(400)
  })

  it('posEur is higher when stop distance is tighter (lower sd)', () => {
    const tight = calcCandidateLevels({ price: 100, ema20: 95, ema50: 100 }) // sd=0.025
    const wide  = calcCandidateLevels({ price: 100, ema20: 110, ema50: 100 }) // sd=0.055
    expect(tight.posEur).toBeGreaterThan(wide.posEur)
  })

  it('shares = floor(posEur × 1.09 / price)', () => {
    const price = 100
    const { posEur, shares } = calcCandidateLevels({ price })
    expect(shares).toBe(Math.floor((posEur * 1.09) / price))
  })

  it('shares rounds down — never rounds up', () => {
    // price=50 → shares=floor(400*1.09/50)=floor(8.72)=8
    const { shares } = calcCandidateLevels({ price: 50 })
    expect(shares).toBe(8)
  })

  it('returns 0 shares for very high priced stocks', () => {
    // price=1000, posEur≈400 → floor(436/1000)=0
    const { shares } = calcCandidateLevels({ price: 1000 })
    expect(shares).toBe(0)
  })

  it('posEur cap at 595 applies when sd is very small (guard test)', () => {
    // Force a hypothetical sd below the min clamp by faking a pre-calculated expectation
    // Within normal sd range (0.025–0.055), posEur is always 218–480, never reaching 595.
    // Verify the boundary: at sd=0.025 (tightest), posEur=480 < 595.
    const { posEur } = calcCandidateLevels({ price: 100, ema20: 95, ema50: 100 })
    expect(posEur).toBeCloseTo(480)
    expect(posEur).toBeLessThan(595)
  })
})
