import {
  analyzeTradeOutcomes,
  analyzeRecommendationOutcomes,
  suggestScoringAdjustments,
  MIN_SAMPLE_SIZE,
  type TradeOutcomeInput,
  type RecommendationOutcomeInput,
  type CandidateOutcome,
} from '@/features/insights/analyze'
import { scoreCandidate } from '@/features/screener/ranking'
import type { CanonicalRow } from '@/types'

function trade(overrides: Partial<TradeOutcomeInput>): TradeOutcomeInput {
  return { pnlEur: 10, riskEur: 12, setupQuality: 'HIGH', exitReason: 'TARGET_1', ruleBreaksJson: null, ...overrides }
}

function rec(overrides: Partial<RecommendationOutcomeInput>): RecommendationOutcomeInput {
  return { pct: 5, closeReason: 'TARGET_REACHED', ...overrides }
}

describe('analyzeTradeOutcomes', () => {
  it('reports not-ready below MIN_SAMPLE_SIZE', () => {
    const trades = Array.from({ length: MIN_SAMPLE_SIZE - 1 }, () => trade({}))
    const result = analyzeTradeOutcomes(trades)
    expect(result.ready).toBe(false)
    expect(result.sampleSize).toBe(MIN_SAMPLE_SIZE - 1)
  })

  it('computes win rate and avg R-multiple once enough samples exist', () => {
    const trades = [
      trade({ pnlEur: 24, riskEur: 12 }),  // +2R win
      trade({ pnlEur: 12, riskEur: 12 }),  // +1R win
      trade({ pnlEur: -12, riskEur: 12 }), // -1R loss
      trade({ pnlEur: -12, riskEur: 12 }), // -1R loss
      trade({ pnlEur: 36, riskEur: 12 }),  // +3R win
    ]
    const result = analyzeTradeOutcomes(trades)
    expect(result.ready).toBe(true)
    expect(result.sampleSize).toBe(5)
    expect(result.winRatePct).toBeCloseTo(60)
    expect(result.avgRMultiple).toBeCloseTo((2 + 1 - 1 - 1 + 3) / 5)
    expect(result.totalPnlEur).toBeCloseTo(24 + 12 - 12 - 12 + 36)
  })

  it('ignores trades with no recorded pnlEur (still open or unclosed)', () => {
    const trades = [
      ...Array.from({ length: MIN_SAMPLE_SIZE }, () => trade({})),
      trade({ pnlEur: null }),
      trade({ pnlEur: undefined }),
    ]
    const result = analyzeTradeOutcomes(trades)
    expect(result.sampleSize).toBe(MIN_SAMPLE_SIZE)
  })

  it('groups by setup quality', () => {
    const trades = [
      trade({ setupQuality: 'HIGH', pnlEur: 20 }),
      trade({ setupQuality: 'HIGH', pnlEur: 10 }),
      trade({ setupQuality: 'LOW', pnlEur: -10 }),
      trade({ setupQuality: 'LOW', pnlEur: -5 }),
      trade({ setupQuality: null, pnlEur: 5 }),
    ]
    const result = analyzeTradeOutcomes(trades)
    const high = result.bySetupQuality.find(g => g.group === 'HIGH')
    const low = result.bySetupQuality.find(g => g.group === 'LOW')
    const unset = result.bySetupQuality.find(g => g.group === 'UNSET')
    expect(high?.count).toBe(2)
    expect(high?.avgPnlEur).toBeCloseTo(15)
    expect(low?.count).toBe(2)
    expect(low?.winRatePct).toBe(0)
    expect(unset?.count).toBe(1)
  })

  it('counts rule-break frequency and normalizes the rule name before the colon', () => {
    const trades = [
      trade({ ruleBreaksJson: ['STOP_TOO_TIGHT: 0.50%'], pnlEur: -10 }),
      trade({ ruleBreaksJson: ['STOP_TOO_TIGHT: 0.80%'], pnlEur: -5 }),
      trade({ ruleBreaksJson: ['RR_BELOW_MIN: 1.2'], pnlEur: 8 }),
      trade({ ruleBreaksJson: null, pnlEur: 12 }),
      trade({ ruleBreaksJson: [], pnlEur: 6 }),
    ]
    const result = analyzeTradeOutcomes(trades)
    const stopTooTight = result.ruleBreakFrequency.find(r => r.rule === 'STOP_TOO_TIGHT')
    expect(stopTooTight?.count).toBe(2)
    expect(stopTooTight?.avgPnlEur).toBeCloseTo(-7.5)
  })
})

describe('analyzeRecommendationOutcomes', () => {
  it('reports not-ready below MIN_SAMPLE_SIZE', () => {
    const recs = Array.from({ length: 2 }, () => rec({}))
    expect(analyzeRecommendationOutcomes(recs).ready).toBe(false)
  })

  it('computes win rate, avg pct, and groups by close reason', () => {
    const recs = [
      rec({ pct: 8, closeReason: 'TARGET_REACHED' }),
      rec({ pct: 4, closeReason: 'TARGET_REACHED' }),
      rec({ pct: -3, closeReason: 'INVALIDATED' }),
      rec({ pct: -1, closeReason: 'EXPIRED' }),
      rec({ pct: 2, closeReason: 'MANUAL' }),
    ]
    const result = analyzeRecommendationOutcomes(recs)
    expect(result.ready).toBe(true)
    expect(result.winRatePct).toBeCloseTo(60)
    expect(result.avgPct).toBeCloseTo((8 + 4 - 3 - 1 + 2) / 5)
    const targetReached = result.byCloseReason.find(g => g.group === 'TARGET_REACHED')
    expect(targetReached?.count).toBe(2)
    expect(targetReached?.avgPct).toBeCloseTo(6)
  })

  it('excludes recommendations without a recorded pct (still open)', () => {
    const recs = [...Array.from({ length: MIN_SAMPLE_SIZE }, () => rec({})), rec({ pct: null })]
    expect(analyzeRecommendationOutcomes(recs).sampleSize).toBe(MIN_SAMPLE_SIZE)
  })
})

describe('suggestScoringAdjustments', () => {
  function outcome(overrides: Partial<CandidateOutcome>): CandidateOutcome {
    return { pct: 0, rsi: 50, ema20: 105, ema50: 100, dist52wh: 7, ...overrides }
  }

  it('reports not-ready below MIN_SAMPLE_SIZE', () => {
    const items = Array.from({ length: 3 }, () => outcome({}))
    expect(suggestScoringAdjustments(items).ready).toBe(false)
  })

  it('never produces an empty suggestions list once ready — falls back to a "keep logging" message', () => {
    // All buckets identical -> no meaningful gap anywhere
    const items = Array.from({ length: MIN_SAMPLE_SIZE + 1 }, () => outcome({ pct: 3 }))
    const result = suggestScoringAdjustments(items)
    expect(result.ready).toBe(true)
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions[0].text).toMatch(/keep (closing|logging)/i)
  })

  it('surfaces a real RSI-proximity gap as plain language mentioning the actual weight constant', () => {
    const items: CandidateOutcome[] = [
      outcome({ rsi: 49, pct: 10 }), outcome({ rsi: 51, pct: 12 }),
      outcome({ rsi: 70, pct: -2 }), outcome({ rsi: 68, pct: -1 }),
      outcome({ rsi: 50, pct: 11 }),
    ]
    const result = suggestScoringAdjustments(items)
    expect(result.ready).toBe(true)
    expect(result.suggestions.some(s => s.text.includes('RSI proximity'))).toBe(true)
    expect(result.suggestions.some(s => s.text.includes('RANKING.RSI_PROXIMITY_MAX'))).toBe(true)
  })

  it('never mutates anything outside its return value (read-only, no side effects)', () => {
    const items = Array.from({ length: MIN_SAMPLE_SIZE }, () => outcome({}))
    const snapshot = JSON.stringify(items)
    suggestScoringAdjustments(items)
    expect(JSON.stringify(items)).toBe(snapshot)
  })
})

describe('scoreCandidate breakdown regression guard', () => {
  it('breakdown components always sum to the same total the ranking engine produces', () => {
    const row: CanonicalRow = {
      symbol: 'TEST', price: 50, rsi14: 48, ema20: 52, ema50: 48, sma50: 45,
      relativeVolume: 1.4, chg1w: 4, high52w: 58, marketCap: 2_000_000_000, perf1y: 150,
    }
    const breakdown = scoreCandidate(row)
    const sum = breakdown.rsiProximity + breakdown.relVol + breakdown.emaStack
      + breakdown.dist52wh + breakdown.chg1w + breakdown.perf1y
    expect(breakdown.total).toBeCloseTo(sum)
  })
})
