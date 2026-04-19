'use client'

import { useQuery } from '@tanstack/react-query'
import { CandidatesTable } from '@/components/candidates/CandidatesTable'
import { useState } from 'react'

export default function CandidatesPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn:  () => fetch('/api/screen/sessions').then(r => r.json()),
  })

  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ['candidates', sessionId ?? 'latest'],
    queryFn:  () => {
      const url = sessionId
        ? `/api/candidates?sessionId=${sessionId}`
        : '/api/candidates?latest=true'
      return fetch(url).then(r => r.json())
    },
  })

  const sessions = sessionsData?.sessions ?? []
  const candidates = candidatesData?.candidates ?? []

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Candidates</h1>
          <p className="text-text-muted text-sm font-mono mt-0.5">
            {candidates.length} stocks passed filters
          </p>
        </div>

        {/* Session selector */}
        {sessions.length > 0 && (
          <select
            value={sessionId ?? ''}
            onChange={e => setSessionId(e.target.value || null)}
            className="bg-desk-raised border border-desk-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">Latest session</option>
            {sessions.map((s: { id: string; filename: string; uploadedAt: string; passedRows: number }) => (
              <option key={s.id} value={s.id}>
                {new Date(s.uploadedAt).toLocaleDateString('en-NL', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  timeZone: 'Europe/Amsterdam',
                })} · {s.filename} ({s.passedRows} passed)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sector concentration warning */}
      {candidates.length > 0 && <SectorWarning candidates={candidates} />}

      {isLoading ? (
        <div className="bg-desk-surface border border-desk-border rounded-xl p-8 text-center">
          <div className="inline-flex items-center gap-2 text-text-muted font-mono text-sm">
            <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
            Loading candidates…
          </div>
        </div>
      ) : (
        <CandidatesTable candidates={candidates} showAll maxRows={100} />
      )}
    </div>
  )
}

function SectorWarning({ candidates }: { candidates: Array<{ sector?: string | null }> }) {
  const counts: Record<string, number> = {}
  for (const c of candidates.slice(0, 5)) {
    const s = c.sector ?? 'Unknown'
    counts[s] = (counts[s] ?? 0) + 1
  }

  const concentrated = Object.entries(counts).filter(([, v]) => v >= 3)
  if (concentrated.length === 0) return null

  return (
    <div className="bg-warn/5 border border-warn/20 rounded-xl px-4 py-3 animate-fade-in">
      <p className="text-sm font-mono text-warn font-semibold">
        ⚠ Sector concentration in top picks
      </p>
      <p className="text-xs font-mono text-text-muted mt-1">
        {concentrated.map(([s, n]) => `${s}: ${n} of top 5`).join(' · ')}.
        {' '}Consider diversifying across sectors to reduce correlated risk.
      </p>
    </div>
  )
}
