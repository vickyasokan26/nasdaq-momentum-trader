'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CsvUploadZone } from '@/components/screener/CsvUploadZone'
import { ValidationSummary } from '@/components/screener/ValidationSummary'
import { CandidatesTable } from '@/components/candidates/CandidatesTable'
import { DrawdownPanel } from '@/components/pnl/DrawdownPanel'
import { WeeklyPnlChart } from '@/components/charts/WeeklyPnlChart'
import { TradingWindowBadge } from '@/components/ui/TradingWindowBadge'
import { CreateTradeModal } from '@/components/trades/CreateTradeModal'
import { useState } from 'react'
import type { ValidationReport } from '@/types'

export default function DashboardPage() {
  const qc = useQueryClient()
  const [uploadResult,  setUploadResult]  = useState<UploadResult | null>(null)
  const [showLogTrade,  setShowLogTrade]  = useState(false)

  const { data: pnlData } = useQuery({
    queryKey: ['pnl'],
    queryFn:  () => fetch('/api/pnl').then(r => r.json()),
    refetchInterval: 60_000, // refresh every minute
  })

  const { data: candidatesData, refetch: refetchCandidates } = useQuery({
    queryKey: ['candidates', 'latest'],
    queryFn:  () => fetch('/api/candidates?latest=true').then(r => r.json()),
  })

  function handleUploadSuccess(result: UploadResult) {
    setUploadResult(result)
    refetchCandidates()
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Dashboard</h1>
          <p className="text-text-muted text-sm font-mono mt-0.5">
            {new Date().toLocaleDateString('en-NL', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              timeZone: 'Europe/Amsterdam'
            })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TradingWindowBadge />
          <button
            onClick={() => setShowLogTrade(true)}
            className="bg-accent hover:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Log Trade
          </button>
        </div>
      </div>

      <CreateTradeModal
        open={showLogTrade}
        onClose={() => setShowLogTrade(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['pnl'] })
          setShowLogTrade(false)
        }}
      />

      {/* Top row: Drawdown + Upload */}
      <div className="dashboard-top-row">
        <div>
          <DrawdownPanel data={pnlData} />
        </div>
        <div>
          <CsvUploadZone onSuccess={handleUploadSuccess} />
        </div>
      </div>

      {/* Weekly P&L trend */}
      <WeeklyPnlChart weeklyHistory={pnlData?.weeklyHistory} />

      {/* Validation summary (shown after upload) */}
      {uploadResult && (
        <ValidationSummary result={uploadResult} onDismiss={() => setUploadResult(null)} />
      )}

      {/* Candidates table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest font-mono">
            Top Candidates
          </h2>
          {candidatesData?.session && (
            <span className="text-xxs font-mono text-text-muted">
              Session: {new Date(candidatesData.session.uploadedAt).toLocaleDateString('en-NL', {
                timeZone: 'Europe/Amsterdam', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })} · {candidatesData.session.filename}
            </span>
          )}
        </div>
        <CandidatesTable
          candidates={candidatesData?.candidates ?? []}
          showAll={false}
          maxRows={10}
        />
      </div>
    </div>
  )
}

interface UploadResult {
  sessionId:     string
  report:        ValidationReport
  topCandidates: unknown[]
}
