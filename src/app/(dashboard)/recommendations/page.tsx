'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, riskBadge, pnlSign, pnlColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

interface Rec {
  id:            string
  sym:           string
  description?:  string | null
  baselinePrice: number
  createdAt:     string
  expiresAt:     string
  status:        string
  closeReason?:  string | null
  closedAt?:     string | null
  closePrice?:   number | null
  pct?:          number | null
  notes?:        string | null
  candidate?:    { rsi: number | null; sector: string | null; dist52wh: number | null; score: number } | null
}

export default function RecommendationsPage() {
  const qc = useQueryClient()
  const [closingRec, setClosingRec] = useState<Rec | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn:  () => fetch('/api/recommendations').then(r => r.json()),
  })

  const recs: Rec[] = data?.recommendations ?? []
  const open   = recs.filter(r => r.status === 'OPEN')
  const closed = recs.filter(r => r.status === 'CLOSED')

  const closedWithPct = closed.filter(r => r.pct != null)
  const avgPct = closedWithPct.length > 0
    ? closedWithPct.reduce((s, r) => s + (r.pct ?? 0), 0) / closedWithPct.length
    : null

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Recommendations</h1>
          <p className="text-text-muted text-sm font-mono mt-0.5">
            App-generated ideas — separate from your actual trades
          </p>
        </div>
      </div>

      {/* Stats row */}
      {closedWithPct.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-desk-surface border border-desk-border rounded-xl p-4">
            <div className="text-xxs font-mono text-text-muted uppercase tracking-widest mb-1.5">Avg Outcome</div>
            <div className={`text-2xl font-mono font-semibold tabular ${avgPct != null && avgPct >= 0 ? 'text-gain' : 'text-loss'}`}>
              {avgPct != null ? `${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(2)}%` : '—'}
            </div>
            <p className="text-xxs font-mono text-text-muted mt-1">From baseline price at screen time</p>
          </div>
          <div className="bg-desk-surface border border-desk-border rounded-xl p-4">
            <div className="text-xxs font-mono text-text-muted uppercase tracking-widest mb-1.5">Hit Rate</div>
            <div className="text-2xl font-mono font-semibold tabular text-text-primary">
              {closedWithPct.length > 0
                ? `${Math.round(closedWithPct.filter(r => (r.pct ?? 0) > 0).length / closedWithPct.length * 100)}%`
                : '—'}
            </div>
            <p className="text-xxs font-mono text-text-muted mt-1">Closed above baseline</p>
          </div>
          <div className="bg-desk-surface border border-desk-border rounded-xl p-4">
            <div className="text-xxs font-mono text-text-muted uppercase tracking-widest mb-1.5">Total Tracked</div>
            <div className="text-2xl font-mono font-semibold tabular text-text-primary">{recs.length}</div>
            <p className="text-xxs font-mono text-text-muted mt-1">{open.length} open · {closed.length} closed</p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
        <p className="text-xs font-mono text-accent">
          ℹ Recommendations track candidate price from screen time using time-based outcomes.
          They are <strong>not simulated trades</strong> with fixed stops/targets.
          P&amp;L shown here does not represent actual account changes.
        </p>
      </div>

      {/* Open recs */}
      <div>
        <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest mb-3">
          Open ({open.length})
        </h2>
        {isLoading ? (
          <div className="bg-desk-surface border border-desk-border rounded-xl p-6 text-center">
            <span className="text-text-muted font-mono text-sm">Loading…</span>
          </div>
        ) : open.length === 0 ? (
          <div className="bg-desk-surface border border-desk-border rounded-xl p-6 text-center">
            <p className="text-text-muted font-mono text-sm">No open recommendations — upload a CSV to generate</p>
          </div>
        ) : (
          <RecTable recs={open} onClose={r => setClosingRec(r)} showClose />
        )}
      </div>

      {/* Closed recs */}
      {closed.length > 0 && (
        <div>
          <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest mb-3">
            Closed ({closed.length})
          </h2>
          <RecTable recs={closed} />
        </div>
      )}

      {closingRec && (
        <CloseRecModal
          rec={closingRec}
          onClose={() => setClosingRec(null)}
          onClosed={() => { qc.invalidateQueries({ queryKey: ['recommendations'] }); setClosingRec(null) }}
        />
      )}
    </div>
  )
}

function RecTable({ recs, onClose, showClose }: {
  recs: Rec[]; onClose?: (r: Rec) => void; showClose?: boolean
}) {
  return (
    <div className="bg-desk-surface border border-desk-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Baseline $</th>
              <th>RSI</th>
              <th>Score</th>
              <th>Sector</th>
              <th>Screened</th>
              <th>Expires / Closed</th>
              <th>Outcome</th>
              <th>Reason</th>
              {showClose && <th></th>}
            </tr>
          </thead>
          <tbody>
            {recs.map(r => {
              const daysLeft = r.status === 'OPEN'
                ? Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / 86400000))
                : null

              return (
                <tr key={r.id}>
                  <td>
                    <div className="font-mono font-semibold text-ticker text-sm">{r.sym}</div>
                    {r.description && (
                      <div className="text-xxs text-text-muted truncate max-w-[120px]">{r.description}</div>
                    )}
                  </td>
                  <td><span className="font-mono tabular">${r.baselinePrice.toFixed(2)}</span></td>
                  <td>
                    <span className="font-mono tabular text-sm">
                      {r.candidate?.rsi?.toFixed(1) ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono tabular text-sm text-accent">
                      {r.candidate?.score?.toFixed(0) ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-text-muted">{r.candidate?.sector ?? '—'}</span>
                  </td>
                  <td>
                    <span className="text-xs font-mono text-text-muted">
                      {new Date(r.createdAt).toLocaleDateString('en-NL', {
                        month: 'short', day: 'numeric', timeZone: 'Europe/Amsterdam'
                      })}
                    </span>
                  </td>
                  <td>
                    {r.status === 'OPEN' && daysLeft != null ? (
                      <span className={`text-xs font-mono ${daysLeft <= 2 ? 'text-warn' : 'text-text-muted'}`}>
                        {daysLeft}d left
                      </span>
                    ) : r.closedAt ? (
                      <span className="text-xs font-mono text-text-muted">
                        {new Date(r.closedAt).toLocaleDateString('en-NL', {
                          month: 'short', day: 'numeric', timeZone: 'Europe/Amsterdam'
                        })}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {r.pct != null ? (
                      <span className={`font-mono tabular text-sm font-semibold ${r.pct >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {r.pct >= 0 ? '+' : ''}{r.pct.toFixed(2)}%
                      </span>
                    ) : <span className="text-text-muted">—</span>}
                  </td>
                  <td>
                    {r.closeReason ? (
                      <Badge variant={
                        r.closeReason === 'TARGET_REACHED' ? 'gain' :
                        r.closeReason === 'INVALIDATED' || r.closeReason === 'EXPIRED' ? 'loss' : 'muted'
                      }>
                        {r.closeReason.replace('_', ' ')}
                      </Badge>
                    ) : <span className="text-text-muted">—</span>}
                  </td>
                  {showClose && onClose && (
                    <td>
                      <button
                        onClick={() => onClose(r)}
                        className="text-xs font-mono text-accent hover:text-indigo-300"
                      >
                        Close
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CloseRecModal({ rec, onClose, onClosed }: {
  rec: Rec; onClose: () => void; onClosed: () => void
}) {
  const [closePrice,  setClosePrice]  = useState('')
  const [closeReason, setCloseReason] = useState('MANUAL')
  const [notes,       setNotes]       = useState('')
  const [error,       setError]       = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/recommendations?id=${rec.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          closeReason,
          closePrice: closePrice ? parseFloat(closePrice) : undefined,
          notes:      notes || undefined,
        }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) { setError(data.error); return }
      onClosed()
    },
  })

  const pct = closePrice
    ? ((parseFloat(closePrice) - rec.baselinePrice) / rec.baselinePrice) * 100
    : null

  return (
    <Modal open onClose={onClose} title={`Close Recommendation: ${rec.sym}`}>
      <div className="space-y-4">
        <div className="bg-desk-raised rounded-lg px-3 py-2.5 text-xs font-mono">
          <span className="text-text-muted">Baseline: </span>
          <span className="text-text-primary">${rec.baselinePrice.toFixed(2)}</span>
          <span className="text-text-muted ml-4">Screened: </span>
          <span className="text-text-secondary">
            {new Date(rec.createdAt).toLocaleDateString('en-NL', { timeZone: 'Europe/Amsterdam' })}
          </span>
        </div>

        <div>
          <label className="block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1.5">
            Close Price $ (optional)
          </label>
          <input
            type="number" step="0.01"
            value={closePrice}
            onChange={e => setClosePrice(e.target.value)}
            className="w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
            placeholder="Leave blank if unknown"
          />
          {pct != null && (
            <p className={`text-sm font-mono font-semibold mt-1.5 tabular ${pct >= 0 ? 'text-gain' : 'text-loss'}`}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(2)}% from baseline
            </p>
          )}
        </div>

        <div>
          <label className="block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1.5">
            Reason
          </label>
          <select
            value={closeReason}
            onChange={e => setCloseReason(e.target.value)}
            className="w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="TARGET_REACHED">Target Reached</option>
            <option value="INVALIDATED">Setup Invalidated</option>
            <option value="EARNINGS_RISK">Earnings Risk</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>

        <div>
          <label className="block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent resize-none"
          />
        </div>

        {error && <p className="text-sm font-mono text-loss">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-desk-raised border border-desk-border text-text-secondary text-sm font-semibold py-2.5 rounded-lg">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 bg-accent hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg">
            {mutation.isPending ? 'Closing…' : 'Close Recommendation'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
