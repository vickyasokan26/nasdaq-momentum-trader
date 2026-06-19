export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  analyzeTradeOutcomes,
  analyzeRecommendationOutcomes,
  suggestScoringAdjustments,
} from '@/features/insights/analyze'

async function getUserId() {
  const user = await db.user.findFirst({ select: { id: true } })
  return user?.id
}

export async function GET(_req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

  const [trades, recommendations] = await Promise.all([
    db.trade.findMany({
      where:  { userId, status: 'CLOSED' },
      select: { pnlEur: true, riskEur: true, setupQuality: true, exitReason: true, ruleBreaksJson: true },
    }),
    db.recommendation.findMany({
      where:  { userId, status: 'CLOSED' },
      select: {
        pct: true, closeReason: true,
        candidate: { select: { rsi: true, ema20: true, ema50: true, dist52wh: true } },
      },
    }),
  ])

  const tradeInsights = analyzeTradeOutcomes(trades)
  const recommendationInsights = analyzeRecommendationOutcomes(recommendations)

  const candidateOutcomes = recommendations
    .filter(r => r.pct !== null && r.candidate !== null)
    .map(r => ({
      pct:      r.pct as number,
      rsi:      r.candidate?.rsi,
      ema20:    r.candidate?.ema20,
      ema50:    r.candidate?.ema50,
      dist52wh: r.candidate?.dist52wh,
    }))
  const scoringInsights = suggestScoringAdjustments(candidateOutcomes)

  return NextResponse.json({ tradeInsights, recommendationInsights, scoringInsights })
}
