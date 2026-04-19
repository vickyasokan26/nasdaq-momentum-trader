import { calculatePositionSize } from '@/features/trades/sizing'
import { ACCOUNT } from '@/constants/screener'

const BASE = {
  entryPrice:     30.00,
  stopPrice:      28.50,  // 5% stop
  t1Price:        33.00,  // 10% target → 2:1 R:R
  riskEur:        12,
  accountSizeEur: 700,
}

describe('calculatePositionSize', () => {
  it('calculates correct stop distance', () => {
    const result = calculatePositionSize(BASE)
    // (30 - 28.50) / 30 = 5%
    expect(result.stopDistancePct).toBeCloseTo(5.0, 1)
  })

  it('calculates correct position value', () => {
    const result = calculatePositionSize(BASE)
    // 12 / 0.05 = 240
    expect(result.positionValueEur).toBeCloseTo(240, 0)
  })

  it('calculates correct shares', () => {
    const result = calculatePositionSize(BASE)
    // floor(240 / 30) = 8
    expect(result.shares).toBe(8)
  })

  it('calculates correct R:R to T1', () => {
    const result = calculatePositionSize(BASE)
    // gain = (33-30)/30 = 10%, stop = 5% → R:R = 2.0
    expect(result.rrToT1).toBeCloseTo(2.0, 1)
  })

  it('calculates R:R to T2 when provided', () => {
    const result = calculatePositionSize({ ...BASE, t2Price: 36.00 })
    // gain = (36-30)/30 = 20%, stop = 5% → R:R = 4.0
    expect(result.rrToT2).toBeCloseTo(4.0, 1)
  })

  it('does not include T2 R:R when t2Price is not provided', () => {
    const result = calculatePositionSize(BASE)
    expect(result.rrToT2).toBeUndefined()
  })

  it('caps position at 85% of account', () => {
    // Tight 1% stop → huge raw position
    const result = calculatePositionSize({
      ...BASE,
      stopPrice:  29.70,  // ~1% stop
      t1Price:    32.00,
      riskEur:    12,
    })
    const cap = 700 * 0.85
    expect(result.cappedValueEur).toBeLessThanOrEqual(cap + 0.01)
    expect(result.wasCapped).toBe(true)
  })

  it('does not cap when position is within account limits', () => {
    const result = calculatePositionSize(BASE) // 5% stop → small position
    expect(result.wasCapped).toBe(false)
    expect(result.positionValueEur).toBe(result.cappedValueEur)
  })

  it('warns on stop distance below 1%', () => {
    const result = calculatePositionSize({
      ...BASE,
      stopPrice: 29.80,  // 0.67% stop
    })
    const hasWickWarning = result.warnings.some(w =>
      w.includes('below minimum') || w.includes('hunted')
    )
    expect(hasWickWarning).toBe(true)
  })

  it('warns when R:R to T1 is below minimum', () => {
    const result = calculatePositionSize({
      ...BASE,
      stopPrice: 28.50,  // 5% stop
      t1Price:   30.50,  // barely above entry → terrible R:R
    })
    const hasRRWarning = result.warnings.some(w =>
      w.includes('R:R') || w.includes('DO NOT ENTER')
    )
    expect(hasRRWarning).toBe(true)
  })

  it('warns when stop is near a round number', () => {
    const result = calculatePositionSize({
      ...BASE,
      entryPrice: 52.00,
      stopPrice:  50.00,  // exact round number
      t1Price:    57.00,
    })
    const hasRoundWarning = result.warnings.some(w =>
      w.toLowerCase().includes('round number')
    )
    expect(hasRoundWarning).toBe(true)
  })

  it('warns when risk exceeds maximum allowed', () => {
    const result = calculatePositionSize({ ...BASE, riskEur: 20 })
    const hasRiskWarning = result.warnings.some(w =>
      w.includes('exceeds maximum')
    )
    expect(hasRiskWarning).toBe(true)
  })

  it('returns zero shares when stop is above entry', () => {
    const result = calculatePositionSize({
      ...BASE,
      stopPrice: 31.00,  // above entry
    })
    expect(result.shares).toBe(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('computes actual risk as shares * entry * stopDistanceFraction', () => {
    const result = calculatePositionSize(BASE)
    const expected = result.shares * BASE.entryPrice * (result.stopDistancePct / 100)
    expect(result.actualRiskEur).toBeCloseTo(expected, 2)
  })

  describe('scaling table', () => {
    const cases = [
      { stop: 1.5, expectedShares: 20,  desc: '1.5% stop, $30 entry, €12 risk → capped' },
      { stop: 2.5, expectedShares: 16,  desc: '2.5% stop, $30 entry, €12 risk' },
      { stop: 3.5, expectedShares: 11,  desc: '3.5% stop, $30 entry, €12 risk' },
      { stop: 5.0, expectedShares: 8,   desc: '5.0% stop, $30 entry, €12 risk' },
    ]

    cases.forEach(({ stop, expectedShares, desc }) => {
      it(desc, () => {
        const entry = 30
        const stopPrice = entry * (1 - stop / 100)
        const result = calculatePositionSize({
          entryPrice:     entry,
          stopPrice,
          t1Price:        entry * 1.1,
          riskEur:        12,
          accountSizeEur: 700,
        })
        // Allow ±1 share due to cap and floor()
        expect(Math.abs(result.shares - expectedShares)).toBeLessThanOrEqual(2)
      })
    })
  })
})
