/**
 * Ranking Engine
 */

import type { CanonicalRow, ScoredCandidate } from '@/types'
import { RANKING } from '@/constants/screener'

export interface ScoreBreakdown {
  rsiProximity: number
  relVol:       number
  emaStack:     number
  dist52wh:     number
  chg1w:        number
  perf1y:       number
  total:        number
}

export function scoreCandidate(row: CanonicalRow): ScoreBreakdown {
  let rsiProximity = 0
  let relVol       = 0
  let emaStack     = 0
  let dist52wh     = 0
  let chg1w        = 0
  let perf1y       = 0

  // RSI proximity to 50 (ideal = 50, score decreases with distance)
  if (row.rsi14 !== undefined) {
    rsiProximity = Math.max(0, RANKING.RSI_PROXIMITY_MAX - Math.abs(row.rsi14 - 50))
  }

  // Relative volume (higher = better momentum, capped)
  if (row.relativeVolume !== undefined) {
    relVol = Math.min(row.relativeVolume * 10, RANKING.REL_VOL_MAX)
  }

  // EMA stack bonus
  if (row.ema20 !== undefined && row.ema50 !== undefined && row.ema20 > row.ema50) {
    emaStack = RANKING.EMA_STACK_BONUS
  }

  // 52-week high distance (sweet spot around 7% below high)
  const dist = (row as CanonicalRow & { dist52wh?: number }).dist52wh
  if (dist !== undefined) {
    dist52wh = Math.max(0, RANKING.DIST_52WH_MAX - Math.abs(dist - RANKING.DIST_52WH_IDEAL))
  } else if (row.high52w !== undefined && row.high52w > 0) {
    const computedDist = ((row.high52w - row.price) / row.high52w) * 100
    dist52wh = Math.max(0, RANKING.DIST_52WH_MAX - Math.abs(computedDist - RANKING.DIST_52WH_IDEAL))
  }

  // Weekly change momentum bonus (ideal: 1–10%)
  if (row.chg1w !== undefined) {
    if (row.chg1w > RANKING.CHG_1W_MIN && row.chg1w < RANKING.CHG_1W_MAX) {
      chg1w = RANKING.CHG_1W_BONUS
    }
  }

  // 1-year performance bonus — stronger momentum = higher score (capped)
  if (row.perf1y !== undefined) {
    // Bonus for 100–300% range (sweet spot), diminishing above 300% (potential exhaustion)
    if (row.perf1y >= 100 && row.perf1y <= 300) {
      perf1y = Math.round((row.perf1y - 100) / 200 * 10) // 0–10 pts
    } else if (row.perf1y > 300) {
      perf1y = 5 // still good but reduce score — extreme runs can be exhausted
    }
  }

  const total = rsiProximity + relVol + emaStack + dist52wh + chg1w + perf1y

  return { rsiProximity, relVol, emaStack, dist52wh, chg1w, perf1y, total }
}

export function rankCandidates(candidates: CanonicalRow[]): ScoredCandidate[] {
  const scored: ScoredCandidate[] = candidates.map(row => {
    const breakdown = scoreCandidate(row)
    const dist = (row as CanonicalRow & { dist52wh?: number }).dist52wh

    return {
      ...row,
      dist52wh: dist,
      score:    breakdown.total,
    }
  })

  // Sort descending by score, then alphabetical for stability
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.symbol.localeCompare(b.symbol)
  })

  scored.forEach((c, i) => { c.rank = i + 1 })

  return scored
}

export function getScoreBreakdown(candidate: ScoredCandidate): ScoreBreakdown {
  return scoreCandidate(candidate)
}
