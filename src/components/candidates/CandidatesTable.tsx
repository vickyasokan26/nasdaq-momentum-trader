'use client'

import { useState } from 'react'
import { Badge, riskBadge } from '@/components/ui/Badge'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface Candidate {
  id:            string
  sym:           string
  description?:  string | null
  price:         number
  rsi?:          number | null
  ema20?:        number | null
  ema50?:        number | null
  relVol?:       number | null
  dist52wh?:     number | null
  chg1w?:        number | null
  sector?:       string | null
  earningsDate?: string | null
  score:         number
  rank?:         number | null
  candidateState: string
}

interface Props {
  candidates: Candidate[]
  showAll?:   boolean
  maxRows?:   number
}

const STATE_COLORS: Record<string, string> = {
  CANDIDATE:        'text-text-secondary',
  SETUP_CONFIRMED:  'text-gain',
  INVALIDATED:      'text-loss line-through opacity-50',
  TRADED:           'text-accent',
  EXPIRED:          'text-text-muted opacity-50',
  ARCHIVED:         'text-text-muted opacity-30',
}

export function CandidatesTable({ candidates, showAll = false, maxRows = 20 }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const updateState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      fetch('/api/candidates', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, candidateState: state }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidates'] }),
  })

  const displayed = showAll ? candidates : candidates.slice(0, maxRows)

  if (displayed.length === 0) {
    return (
      <div className="bg-desk-surface border border-desk-border rounded-xl p-8 text-center">
        <p className="text-text-muted font-mono text-sm">No candidates — upload a TradingView CSV to populate</p>
      </div>
    )
  }

  return (
    <div className="bg-desk-surface border border-desk-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Symbol</th>
              <th>Price</th>
              <th>RSI</th>
              <th>EMA20/50</th>
              <th>RelVol</th>
              <th>Dist 52W</th>
              <th>1W Chg</th>
              <th>Sector</th>
              <th>Earnings</th>
              <th>Score</th>
              <th>State</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(c => {
              const emaStack  = c.ema20 != null && c.ema50 != null && c.ema20 > c.ema50
              const rsiColor  = c.rsi != null ? (c.rsi < 50 ? 'text-warn' : c.rsi < 65 ? 'text-gain' : 'text-text-secondary') : ''
              const chgColor  = c.chg1w != null ? (c.chg1w > 0 ? 'text-gain' : 'text-loss') : ''
              const isExpanded = expandedId === c.id

              return (
                <>
                  <tr
                    key={c.id}
                    className={`cursor-pointer ${STATE_COLORS[c.candidateState] ?? ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    {/* Rank */}
                    <td>
                      <span className="text-xxs font-mono text-text-muted tabular">{c.rank ?? '—'}</span>
                    </td>

                    {/* Symbol */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-ticker text-sm">{c.sym}</span>
                        {c.rank != null && c.rank <= 3 && (
                          <span className="text-xxs font-mono text-warn">TOP</span>
                        )}
                      </div>
                      {c.description && (
                        <div className="text-xxs text-text-muted truncate max-w-[140px]">{c.description}</div>
                      )}
                    </td>

                    {/* Price */}
                    <td>
                      <span className="font-mono tabular text-sm">${c.price.toFixed(2)}</span>
                    </td>

                    {/* RSI */}
                    <td>
                      {c.rsi != null
                        ? <span className={`font-mono tabular text-sm ${rsiColor}`}>{c.rsi.toFixed(1)}</span>
                        : <span className="text-text-muted">—</span>
                      }
                    </td>

                    {/* EMA stack */}
                    <td>
                      {c.ema20 != null && c.ema50 != null ? (
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-mono ${emaStack ? 'text-gain' : 'text-loss'}`}>
                            {emaStack ? '↑ Stack' : '↓ Cross'}
                          </span>
                        </div>
                      ) : <span className="text-text-muted">—</span>}
                    </td>

                    {/* Rel Vol */}
                    <td>
                      {c.relVol != null ? (
                        <span className={`font-mono tabular text-sm ${c.relVol >= 1.5 ? 'text-gain' : c.relVol < 0.9 ? 'text-warn' : 'text-text-secondary'}`}>
                          {c.relVol.toFixed(1)}×
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>

                    {/* Dist 52W */}
                    <td>
                      {c.dist52wh != null ? (
                        <span className="font-mono tabular text-sm text-text-secondary">
                          -{c.dist52wh.toFixed(1)}%
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>

                    {/* 1W change */}
                    <td>
                      {c.chg1w != null ? (
                        <span className={`font-mono tabular text-sm ${chgColor}`}>
                          {c.chg1w > 0 ? '+' : ''}{c.chg1w.toFixed(1)}%
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>

                    {/* Sector */}
                    <td>
                      {c.sector
                        ? <span className="text-xs text-text-muted truncate max-w-[100px] block">{c.sector}</span>
                        : <span className="text-text-muted">—</span>
                      }
                    </td>

                    {/* Earnings */}
                    <td>
                      {c.earningsDate ? (
                        <span className="text-xs font-mono text-warn">
                          {new Date(c.earningsDate).toLocaleDateString('en-NL', { month: 'short', day: 'numeric' })}
                        </span>
                      ) : <span className="text-gain text-xs font-mono">Clear</span>}
                    </td>

                    {/* Score */}
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-desk-muted rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${Math.min(100, (c.score / 80) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xxs font-mono tabular text-text-muted">{c.score.toFixed(0)}</span>
                      </div>
                    </td>

                    {/* State */}
                    <td>
                      <Badge variant={
                        c.candidateState === 'SETUP_CONFIRMED' ? 'gain' :
                        c.candidateState === 'INVALIDATED'     ? 'loss' :
                        c.candidateState === 'TRADED'          ? 'accent' : 'muted'
                      }>
                        {c.candidateState.replace('_', ' ')}
                      </Badge>
                    </td>

                    {/* Expand toggle */}
                    <td>
                      <span className="text-text-muted text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </td>
                  </tr>

                  {/* Expanded action row */}
                  {isExpanded && (
                    <tr key={`${c.id}-exp`} className="bg-desk-raised/50">
                      <td colSpan={13} className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xxs font-mono text-text-muted mr-2">Mark as:</span>
                          {['SETUP_CONFIRMED', 'INVALIDATED', 'TRADED', 'CANDIDATE'].map(state => (
                            <button
                              key={state}
                              disabled={updateState.isPending}
                              onClick={e => {
                                e.stopPropagation()
                                updateState.mutate({ id: c.id, state })
                              }}
                              className={`
                                px-2.5 py-1 rounded text-xxs font-mono font-semibold border transition-colors
                                ${c.candidateState === state
                                  ? 'bg-accent/20 text-accent border-accent/30'
                                  : 'bg-desk-raised text-text-secondary border-desk-border hover:border-accent/30 hover:text-accent'
                                }
                              `}
                            >
                              {state.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {!showAll && candidates.length > maxRows && (
        <div className="px-4 py-3 border-t border-desk-border text-center">
          <span className="text-xs font-mono text-text-muted">
            Showing {maxRows} of {candidates.length} — view all on Candidates page
          </span>
        </div>
      )}
    </div>
  )
}
