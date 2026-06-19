/**
 * Insights Engine
 *
 * Surfaces patterns from closed trades and closed recommendations. Read-only —
 * nothing here writes to the database or to src/constants/screener.ts. Below
 * MIN_SAMPLE_SIZE closed outcomes, every function returns `ready: false` rather
 * than risk a misleading stat from a tiny sample.
 */

import { toRMultiple } from '@/features/pnl/calculations'

export const MIN_SAMPLE_SIZE = 5

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((sum, n) => sum + n, 0) / nums.length
}

function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  return map
}

// ── Trade outcomes ──────────────────────────────────────────────────────────

export interface TradeOutcomeInput {
  pnlEur?:         number | null
  riskEur:         number
  setupQuality?:   string | null
  exitReason?:     string | null
  ruleBreaksJson?: unknown
}

export interface GroupStat {
  group:      string
  count:      number
  avgPnlEur?: number
  avgPct?:    number
  winRatePct: number
}

export interface RuleBreakStat {
  rule:       string
  count:      number
  avgPnlEur:  number
}

export interface TradeInsights {
  ready:              boolean
  sampleSize:         number
  minSampleSize:      number
  winRatePct:         number
  avgRMultiple:       number
  totalPnlEur:         number
  bySetupQuality:     GroupStat[]
  ruleBreakFrequency: RuleBreakStat[]
}

const NOT_READY_TRADE: Omit<TradeInsights, 'ready' | 'sampleSize' | 'minSampleSize'> = {
  winRatePct: 0, avgRMultiple: 0, totalPnlEur: 0, bySetupQuality: [], ruleBreakFrequency: [],
}

export function analyzeTradeOutcomes(trades: TradeOutcomeInput[]): TradeInsights {
  const closed = trades.filter(t => t.pnlEur !== null && t.pnlEur !== undefined)
  const sampleSize = closed.length

  if (sampleSize < MIN_SAMPLE_SIZE) {
    return { ready: false, sampleSize, minSampleSize: MIN_SAMPLE_SIZE, ...NOT_READY_TRADE }
  }

  const pnls = closed.map(t => t.pnlEur as number)
  const wins = pnls.filter(p => p > 0).length
  const winRatePct = (wins / sampleSize) * 100
  const avgRMultiple = avg(closed.map(t => toRMultiple(t.pnlEur as number, t.riskEur)))
  const totalPnlEur = pnls.reduce((sum, p) => sum + p, 0)

  const bySetupQuality: GroupStat[] = [...groupBy(closed, t => t.setupQuality ?? 'UNSET').entries()]
    .map(([group, items]) => {
      const groupPnls = items.map(i => i.pnlEur as number)
      return {
        group,
        count:      items.length,
        avgPnlEur:  avg(groupPnls),
        winRatePct: (groupPnls.filter(p => p > 0).length / items.length) * 100,
      }
    })
    .sort((a, b) => b.count - a.count)

  const ruleBreakMap = new Map<string, { count: number; pnlSum: number }>()
  for (const t of closed) {
    const breaks = Array.isArray(t.ruleBreaksJson) ? (t.ruleBreaksJson as unknown[]) : []
    for (const raw of breaks) {
      if (typeof raw !== 'string') continue
      const rule = raw.split(':')[0].trim()
      const entry = ruleBreakMap.get(rule) ?? { count: 0, pnlSum: 0 }
      entry.count += 1
      entry.pnlSum += t.pnlEur as number
      ruleBreakMap.set(rule, entry)
    }
  }
  const ruleBreakFrequency: RuleBreakStat[] = [...ruleBreakMap.entries()]
    .map(([rule, v]) => ({ rule, count: v.count, avgPnlEur: v.pnlSum / v.count }))
    .sort((a, b) => b.count - a.count)

  return { ready: true, sampleSize, minSampleSize: MIN_SAMPLE_SIZE, winRatePct, avgRMultiple, totalPnlEur, bySetupQuality, ruleBreakFrequency }
}

// ── Recommendation outcomes ─────────────────────────────────────────────────

export interface RecommendationOutcomeInput {
  pct?:          number | null
  closeReason?:  string | null
}

export interface RecommendationInsights {
  ready:         boolean
  sampleSize:    number
  minSampleSize: number
  winRatePct:    number
  avgPct:        number
  byCloseReason: GroupStat[]
}

export function analyzeRecommendationOutcomes(recs: RecommendationOutcomeInput[]): RecommendationInsights {
  const closed = recs.filter(r => r.pct !== null && r.pct !== undefined)
  const sampleSize = closed.length

  if (sampleSize < MIN_SAMPLE_SIZE) {
    return { ready: false, sampleSize, minSampleSize: MIN_SAMPLE_SIZE, winRatePct: 0, avgPct: 0, byCloseReason: [] }
  }

  const pcts = closed.map(r => r.pct as number)
  const wins = pcts.filter(p => p > 0).length
  const winRatePct = (wins / sampleSize) * 100
  const avgPct = avg(pcts)

  const byCloseReason: GroupStat[] = [...groupBy(closed, r => r.closeReason ?? 'UNKNOWN').entries()]
    .map(([group, items]) => {
      const groupPcts = items.map(i => i.pct as number)
      return {
        group,
        count:      items.length,
        avgPct:     avg(groupPcts),
        winRatePct: (groupPcts.filter(p => p > 0).length / items.length) * 100,
      }
    })
    .sort((a, b) => b.count - a.count)

  return { ready: true, sampleSize, minSampleSize: MIN_SAMPLE_SIZE, winRatePct, avgPct, byCloseReason }
}

// ── Scoring suggestions (read-only — never auto-applied, never touches screener.ts) ──

export interface CandidateOutcome {
  pct:       number
  rsi?:      number | null
  ema20?:    number | null
  ema50?:    number | null
  dist52wh?: number | null
}

export interface ScoringSuggestion {
  text: string
}

export interface ScoringInsights {
  ready:         boolean
  sampleSize:    number
  minSampleSize: number
  suggestions:   ScoringSuggestion[]
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

/** Compares two buckets and appends a suggestion if the gap is meaningful and both sides have enough samples. */
function compareBuckets(
  suggestions: ScoringSuggestion[],
  label: string,
  near: number[], far: number[],
  nearLabel: string, farLabel: string,
  weightNote: string,
): void {
  if (near.length < 2 || far.length < 2) return
  const a = avg(near)
  const b = avg(far)
  if (Math.abs(a - b) < 1) return // not a meaningful gap

  const verdict = a > b
    ? 'the current weighting looks justified by outcomes so far'
    : 'consider reducing this weight — it has not been predictive in your closed history yet'

  suggestions.push({
    text: `${label}: ${nearLabel} averaged ${fmtPct(a)} (n=${near.length}) vs ${farLabel} at ${fmtPct(b)} (n=${far.length}). ${weightNote} — ${verdict}.`,
  })
}

export function suggestScoringAdjustments(items: CandidateOutcome[]): ScoringInsights {
  const sampleSize = items.length
  if (sampleSize < MIN_SAMPLE_SIZE) {
    return { ready: false, sampleSize, minSampleSize: MIN_SAMPLE_SIZE, suggestions: [] }
  }

  const suggestions: ScoringSuggestion[] = []

  const withRsi = items.filter((i): i is CandidateOutcome & { rsi: number } => i.rsi !== null && i.rsi !== undefined)
  compareBuckets(
    suggestions, 'RSI proximity',
    withRsi.filter(i => Math.abs(i.rsi - 50) <= 10).map(i => i.pct),
    withRsi.filter(i => Math.abs(i.rsi - 50) > 10).map(i => i.pct),
    'entries within 10 of RSI 50', 'entries further from RSI 50',
    'current weight: RANKING.RSI_PROXIMITY_MAX = 20',
  )

  const withGap = items
    .filter((i): i is CandidateOutcome & { ema20: number; ema50: number } =>
      i.ema20 !== null && i.ema20 !== undefined && i.ema50 !== null && i.ema50 !== undefined && i.ema50 !== 0)
    .map(i => ({ ...i, gap: ((i.ema20 - i.ema50) / i.ema50) * 100 }))
  compareBuckets(
    suggestions, 'EMA 20/50 gap',
    withGap.filter(i => i.gap > 5).map(i => i.pct),
    withGap.filter(i => i.gap > 0 && i.gap <= 5).map(i => i.pct),
    'wide-gap entries (>5%)', 'tight-gap entries (0-5%)',
    'current weight: RANKING.EMA_STACK_BONUS = 15',
  )

  const withDist = items.filter((i): i is CandidateOutcome & { dist52wh: number } =>
    i.dist52wh !== null && i.dist52wh !== undefined)
  compareBuckets(
    suggestions, '52-week high distance',
    withDist.filter(i => Math.abs(i.dist52wh - 7) <= 4).map(i => i.pct),
    withDist.filter(i => Math.abs(i.dist52wh - 7) > 4).map(i => i.pct),
    'entries near the 7% sweet spot', 'entries further from it',
    'current weight: RANKING.DIST_52WH_IDEAL = 7, max 15 points',
  )

  if (suggestions.length === 0) {
    suggestions.push({
      text: 'No statistically meaningful gaps found yet across RSI / EMA-gap / 52W-distance buckets — keep closing trades and recommendations to build up the sample.',
    })
  }

  return { ready: true, sampleSize, minSampleSize: MIN_SAMPLE_SIZE, suggestions }
}
