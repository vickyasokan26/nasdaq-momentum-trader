'use client'

import { useQuery } from '@tanstack/react-query'
import { StatCard } from '@/components/ui/StatCard'
import { GroupPnlChart, RuleBreakChart } from '@/components/charts/InsightsCharts'
import type { TradeInsights, RecommendationInsights, ScoringInsights } from '@/features/insights/analyze'

interface InsightsResponse {
  tradeInsights:          TradeInsights
  recommendationInsights: RecommendationInsights
  scoringInsights:        ScoringInsights
}

function NotEnoughData({ sampleSize, minSampleSize, what }: { sampleSize: number; minSampleSize: number; what: string }) {
  return (
    <div className="chart-card">
      <div className="chart-empty">
        {sampleSize} of {minSampleSize} {what} closed so far — close {minSampleSize - sampleSize} more to unlock these insights.
      </div>
    </div>
  )
}

export default function InsightsPage() {
  const { data, isLoading } = useQuery<InsightsResponse>({
    queryKey: ['insights'],
    queryFn:  () => fetch('/api/insights').then(r => r.json()),
  })

  const trades = data?.tradeInsights
  const recs   = data?.recommendationInsights
  const scoring = data?.scoringInsights

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Insights</h1>
        <p className="text-text-muted text-sm font-mono mt-0.5">
          Patterns from your closed trades and closed recommendations — read-only, nothing here changes your strategy automatically.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-desk-surface border border-desk-border rounded-xl p-8 text-center">
          <span className="text-text-muted font-mono text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="chart-grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatCard
              label="Trade win rate"
              value={trades?.ready ? `${trades.winRatePct.toFixed(0)}%` : '—'}
              accent={trades?.ready ? (trades.winRatePct >= 50 ? 'gain' : 'loss') : 'neutral'}
              sub={`${trades?.sampleSize ?? 0} closed trades`}
            />
            <StatCard
              label="Avg R-multiple"
              value={trades?.ready ? `${trades.avgRMultiple >= 0 ? '+' : ''}${trades.avgRMultiple.toFixed(2)}R` : '—'}
              accent={trades?.ready ? (trades.avgRMultiple >= 0 ? 'gain' : 'loss') : 'neutral'}
            />
            <StatCard
              label="Recommendation win rate"
              value={recs?.ready ? `${recs.winRatePct.toFixed(0)}%` : '—'}
              accent={recs?.ready ? (recs.winRatePct >= 50 ? 'gain' : 'loss') : 'neutral'}
              sub={`${recs?.sampleSize ?? 0} closed recs`}
            />
            <StatCard
              label="Avg recommendation outcome"
              value={recs?.ready ? `${recs.avgPct >= 0 ? '+' : ''}${recs.avgPct.toFixed(1)}%` : '—'}
              accent={recs?.ready ? (recs.avgPct >= 0 ? 'gain' : 'loss') : 'neutral'}
            />
          </div>

          {/* Trade outcome charts */}
          <div className="chart-grid-2">
            {trades?.ready ? (
              <GroupPnlChart title="Avg P&L by setup quality" data={trades.bySetupQuality} valueKey="avgPnlEur" unit="€" />
            ) : (
              <NotEnoughData sampleSize={trades?.sampleSize ?? 0} minSampleSize={trades?.minSampleSize ?? 5} what="trades" />
            )}
            {trades?.ready ? (
              <RuleBreakChart data={trades.ruleBreakFrequency} />
            ) : (
              <NotEnoughData sampleSize={trades?.sampleSize ?? 0} minSampleSize={trades?.minSampleSize ?? 5} what="trades" />
            )}
          </div>

          {/* Recommendation outcome chart */}
          {recs?.ready ? (
            <GroupPnlChart title="Avg outcome by close reason" data={recs.byCloseReason} valueKey="avgPct" unit="%" />
          ) : (
            <NotEnoughData sampleSize={recs?.sampleSize ?? 0} minSampleSize={recs?.minSampleSize ?? 5} what="recommendations" />
          )}

          {/* Scoring suggestions */}
          <div className="chart-card">
            <div className="chart-title">Suggested scoring tweaks — read only, nothing auto-applied</div>
            {scoring?.ready ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scoring.suggestions.map((s, i) => (
                  <div key={i} className="suggestion-card">{s.text}</div>
                ))}
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4 }}>
                  These are observations only. Ranking weights live in <code>src/constants/screener.ts</code> and are never
                  changed automatically — ask explicitly if you want one of these adjustments made.
                </p>
              </div>
            ) : (
              <div className="chart-empty">
                {scoring?.sampleSize ?? 0} of {scoring?.minSampleSize ?? 5} closed recommendations with linked candidate data —
                close {Math.max(0, (scoring?.minSampleSize ?? 5) - (scoring?.sampleSize ?? 0))} more to unlock scoring suggestions.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
