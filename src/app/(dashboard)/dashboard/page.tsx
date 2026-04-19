'use client'

import { useQuery } from '@tanstack/react-query'
import { CsvUploadZone } from '@/components/screener/CsvUploadZone'
import { ValidationSummary } from '@/components/screener/ValidationSummary'
import { CandidatesTable } from '@/components/candidates/CandidatesTable'
import { DrawdownPanel } from '@/components/pnl/DrawdownPanel'
import { TradingWindowBadge } from '@/components/ui/TradingWindowBadge'
import { useState } from 'react'
import type { ValidationReport } from '@/types'

export default function DashboardPage() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

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
        <TradingWindowBadge />
      </div>

      {/* Top row: Drawdown + Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DrawdownPanel data={pnlData} />
        </div>
        <div>
          <CsvUploadZone onSuccess={handleUploadSuccess} />
        </div>
      </div>

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
