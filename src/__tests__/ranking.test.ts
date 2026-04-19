import { rankCandidates, scoreCandidate } from '@/features/screener/ranking'
import { RANKING } from '@/constants/screener'
import type { CanonicalRow } from '@/types'

const BASE: CanonicalRow = {
  symbol:         'TEST',
  price:          50,
  rsi14:          50,
  ema20:          52,
  ema50:          48,
  relativeVolume: 1.5,
  chg1w:          3,
  high52w:        54, // ~7.4% below high
}

function make(overrides: Partial<CanonicalRow>): CanonicalRow {
  return { ...BASE, ...overrides }
}

describe('scoreCandidate', () => {
  it('gives maximum RSI proximity score when RSI is exactly 50', () => {
    const { rsiProximity } = scoreCandidate(make({ rsi14: 50 }))
    expect(rsiProximity).toBe(RANKING.RSI_PROXIMITY_MAX)
  })

  it('gives zero RSI proximity score when RSI is 70 (20 away from 50)', () => {
    const { rsiProximity } = scoreCandidate(make({ rsi14: 70 }))
    expect(rsiProximity).toBe(0)
  })

  it('gives partial RSI proximity score for intermediate RSI', () => {
    const { rsiProximity } = scoreCandidate(make({ rsi14: 55 })) // 5 away
    expect(rsiProximity).toBe(15)
  })

  it('adds EMA stack bonus when ema20 > ema50', () => {
    const { emaStack } = scoreCandidate(make({ ema20: 55, ema50: 50 }))
    expect(emaStack).toBe(RANKING.EMA_STACK_BONUS)
  })

  it('gives no EMA stack bonus when ema20 <= ema50', () => {
    const { emaStack } = scoreCandidate(make({ ema20: 50, ema50: 50 }))
    expect(emaStack).toBe(0)
  })

  it('gives bonus when weekly change is in ideal range', () => {
    const { chg1w } = scoreCandidate(make({ chg1w: 5 }))
    expect(chg1w).toBe(RANKING.CHG_1W_BONUS)
  })

  it('gives no bonus when weekly change is 0', () => {
    const { chg1w } = scoreCandidate(make({ chg1w: 0 }))
    expect(chg1w).toBe(0)
  })

  it('gives no bonus when weekly change exceeds ideal range', () => {
    const { chg1w } = scoreCandidate(make({ chg1w: 15 }))
    expect(chg1w).toBe(0)
  })

  it('gives zero score for undefined optional fields', () => {
    const breakdown = scoreCandidate({
      symbol: 'BARE',
      price:  50,
    })
    expect(breakdown.rsiProximity).toBe(0)
    expect(breakdown.relVol).toBe(0)
    expect(breakdown.emaStack).toBe(0)
    expect(breakdown.chg1w).toBe(0)
  })

  it('produces a deterministic score for the same input', () => {
    const a = scoreCandidate(make({}))
    const b = scoreCandidate(make({}))
    expect(a.total).toBe(b.total)
  })
})

describe('rankCandidates', () => {
  it('ranks candidates in descending score order', () => {
    const high = make({ symbol: 'HIGH', rsi14: 50, relativeVolume: 2.5 })
    const low  = make({ symbol: 'LOW',  rsi14: 70, relativeVolume: 0.8 })
    const ranked = rankCandidates([low, high])

    expect(ranked[0].symbol).toBe('HIGH')
    expect(ranked[1].symbol).toBe('LOW')
  })

  it('assigns rank 1 to the top candidate', () => {
    const ranked = rankCandidates([make({ symbol: 'A' }), make({ symbol: 'B' })])
    expect(ranked[0].rank).toBe(1)
    expect(ranked[1].rank).toBe(2)
  })

  it('uses alphabetical tiebreak for equal scores', () => {
    // Same base setup → same score
    const ranked = rankCandidates([
      make({ symbol: 'ZZZ' }),
      make({ symbol: 'AAA' }),
    ])
    expect(ranked[0].symbol).toBe('AAA')
    expect(ranked[1].symbol).toBe('ZZZ')
  })

  it('handles a single candidate', () => {
    const ranked = rankCandidates([make({ symbol: 'SOLO' })])
    expect(ranked).toHaveLength(1)
    expect(ranked[0].rank).toBe(1)
  })

  it('handles an empty array', () => {
    const ranked = rankCandidates([])
    expect(ranked).toHaveLength(0)
  })

  it('attaches score to each candidate', () => {
    const ranked = rankCandidates([make({})])
    expect(typeof ranked[0].score).toBe('number')
    expect(ranked[0].score).toBeGreaterThan(0)
  })
})
