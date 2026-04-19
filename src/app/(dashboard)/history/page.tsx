'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CandidatesTable } from '@/components/candidates/CandidatesTable'

export default function HistoryPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn:  () => fetch('/api/screen/sessions?limit=30').then(r => r.json()),
  })

  const { data: candidatesData } = useQuery({
    queryKey: ['candidates', selectedId],
    queryFn:  () => fetch(`/api/candidates?sessionId=${selectedId}`).then(r => r.json()),
    enabled:  !!selectedId,
  })

  const sessions = sessionsData?.sessions ?? []

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Screen History</h1>
        <p className="text-text-muted text-sm font-mono mt-0.5">{sessions.length} sessions on record</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session list */}
        <div className="bg-desk-surface border border-desk-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-desk-border">
            <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest">Sessions</h2>
          </div>
          <div className="divide-y divide-desk-border max-h-[600px] overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-text-muted font-mono text-sm">No sessions yet</p>
              </div>
            ) : sessions.map((s: {
              id: string; filename: string; uploadedAt: string
              totalRows: number; passedRows: number; _count: { picks: number }
            }) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`
                  w-full text-left px-4 py-3 transition-colors
                  ${selectedId === s.id ? 'bg-accent/10' : 'hover:bg-desk-raised'}
                `}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-mono text-text-primary truncate max-w-[160px]">
                      {s.filename}
                    </p>
                    <p className="text-xxs font-mono text-text-muted mt-0.5">
                      {new Date(s.uploadedAt).toLocaleDateString('en-NL', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        timeZone: 'Europe/Amsterdam',
                      })} CET
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-sm font-mono text-gain font-semibold">{s.passedRows}</span>
                    <span className="text-xxs font-mono text-text-muted"> / {s.totalRows}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Candidates for selected session */}
        <div className="lg:col-span-2">
          {!selectedId ? (
            <div className="bg-desk-surface border border-desk-border rounded-xl p-8 text-center h-full flex items-center justify-center">
              <p className="text-text-muted font-mono text-sm">Select a session to view candidates</p>
            </div>
          ) : (
            <CandidatesTable
              candidates={candidatesData?.candidates ?? []}
              showAll
              maxRows={100}
            />
          )}
        </div>
      </div>
    </div>
  )
}
