'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from '@/components/ui/Modal'
import { Badge, pnlSign, pnlColor } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'

interface Trade {
  id:          string
  tradeDate:   string
  sym:         string
  entryPrice:  number
  stopPrice:   number
  t1Price:     number
  t2Price?:    number | null
  riskEur:     number
  shares:      number
  status:      string
  exitPrice?:  number | null
  exitReason?: string | null
  pnlEur?:     number | null
  setupQuality?: string | null
  ruleBreaksJson?: string[] | null
  notes?:      string | null
  closedAt?:   string | null
}

export default function TradesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null)

  const { data } = useQuery({
    queryKey: ['trades'],
    queryFn:  () => fetch('/api/trades').then(r => r.json()),
  })

  const trades: Trade[] = data?.trades ?? []
  const open   = trades.filter(t => t.status === 'OPEN')
  const closed = trades.filter(t => t.status === 'CLOSED')

  const totalPnl = closed.reduce((s, t) => s + (t.pnlEur ?? 0), 0)
  const wins     = closed.filter(t => (t.pnlEur ?? 0) > 0).length
  const winRate  = closed.length > 0 ? (wins / closed.length) * 100 : 0

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Trade Log</h1>
          <p className="text-text-muted text-sm font-mono mt-0.5">Actual trades only — not recommendations</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent hover:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Log Trade
        </button>
      </div>

      {/* Summary stats */}
      {closed.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total P&L"
            value={pnlSign(totalPnl)}
            accent={totalPnl >= 0 ? 'gain' : 'loss'}
          />
          <StatCard
            label="Win Rate"
            value={`${winRate.toFixed(0)}%`}
            sub={`${wins}W / ${closed.length - wins}L`}
            accent={winRate >= 55 ? 'gain' : winRate >= 45 ? 'warn' : 'loss'}
          />
          <StatCard
            label="Total Trades"
            value={closed.length}
            sub={`${open.length} open`}
          />
          <StatCard
            label="Avg Trade"
            value={closed.length > 0 ? pnlSign(totalPnl / closed.length) : '—'}
            accent={totalPnl / Math.max(1, closed.length) >= 0 ? 'gain' : 'loss'}
          />
        </div>
      )}

      {/* Open positions */}
      {open.length > 0 && (
        <div>
          <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest mb-3">
            Open Positions ({open.length})
          </h2>
          <TradeTable
            trades={open}
            onClose={t => setClosingTrade(t)}
            showClose
          />
        </div>
      )}

      {/* Closed trades */}
      <div>
        <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest mb-3">
          Closed Trades ({closed.length})
        </h2>
        {closed.length === 0 ? (
          <div className="bg-desk-surface border border-desk-border rounded-xl p-8 text-center">
            <p className="text-text-muted font-mono text-sm">No closed trades yet</p>
          </div>
        ) : (
          <TradeTable trades={closed} />
        )}
      </div>

      {/* Modals */}
      <CreateTradeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { qc.invalidateQueries({ queryKey: ['trades'] }); setShowCreate(false) }}
      />

      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onClosed={() => { qc.invalidateQueries({ queryKey: ['trades', 'pnl'] }); setClosingTrade(null) }}
        />
      )}
    </div>
  )
}

// ── Trade Table ───────────────────────────────────────────────────────────────

function TradeTable({ trades, onClose, showClose }: {
  trades: Trade[]
  onClose?: (t: Trade) => void
  showClose?: boolean
}) {
  return (
    <div className="bg-desk-surface border border-desk-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Entry</th>
              <th>Stop</th>
              <th>T1</th>
              <th>Risk €</th>
              <th>Shares</th>
              <th>Exit</th>
              <th>P&L</th>
              <th>Quality</th>
              {showClose && <th></th>}
            </tr>
          </thead>
          <tbody>
            {trades.map(t => {
              const rrActual = t.pnlEur != null && t.riskEur > 0 ? t.pnlEur / t.riskEur : null
              return (
                <tr key={t.id}>
                  <td>
                    <span className="text-xs font-mono text-text-muted">
                      {new Date(t.tradeDate).toLocaleDateString('en-NL', {
                        month: 'short', day: 'numeric', timeZone: 'Europe/Amsterdam'
                      })}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-ticker">{t.sym}</span>
                      {t.ruleBreaksJson && t.ruleBreaksJson.length > 0 && (
                        <span className="text-xxs text-warn" title={t.ruleBreaksJson.join(', ')}>⚠</span>
                      )}
                    </div>
                  </td>
                  <td><span className="font-mono tabular text-sm">${t.entryPrice.toFixed(2)}</span></td>
                  <td><span className="font-mono tabular text-sm text-loss">${t.stopPrice.toFixed(2)}</span></td>
                  <td><span className="font-mono tabular text-sm text-gain">${t.t1Price.toFixed(2)}</span></td>
                  <td><span className="font-mono tabular text-sm text-warn">€{t.riskEur.toFixed(2)}</span></td>
                  <td><span className="font-mono tabular text-sm">{t.shares}</span></td>
                  <td>
                    {t.exitPrice != null
                      ? <span className="font-mono tabular text-sm">${t.exitPrice.toFixed(2)}</span>
                      : <span className="text-text-muted">—</span>
                    }
                  </td>
                  <td>
                    {t.pnlEur != null ? (
                      <div>
                        <span className={`font-mono tabular text-sm font-semibold ${pnlColor(t.pnlEur)}`}>
                          {pnlSign(t.pnlEur)}
                        </span>
                        {rrActual != null && (
                          <span className="text-xxs font-mono text-text-muted ml-1">
                            ({rrActual >= 0 ? '+' : ''}{rrActual.toFixed(1)}R)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted">Open</span>
                    )}
                  </td>
                  <td>
                    {t.setupQuality
                      ? <Badge variant={t.setupQuality === 'HIGH' ? 'gain' : t.setupQuality === 'MEDIUM' ? 'warn' : 'loss'}>
                          {t.setupQuality}
                        </Badge>
                      : <span className="text-text-muted">—</span>
                    }
                  </td>
                  {showClose && onClose && (
                    <td>
                      <button
                        onClick={() => onClose(t)}
                        className="text-xs font-mono text-accent hover:text-indigo-300 transition-colors"
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

// ── Create Trade Modal ────────────────────────────────────────────────────────

function CreateTradeModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<{
    sym: string; entryPrice: number; stopPrice: number; t1Price: number
    t2Price: number; riskEur: number; shares: number; notes: string
    setupQuality: string
  }>()

  const [apiError, setApiError]     = useState('')
  const [warnings, setWarnings]     = useState<string[]>([])
  const [ruleBreaks, setRuleBreaks] = useState<string[]>([])

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/trades', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) { setApiError(data.error); return }
      setWarnings(data.sizing?.warnings ?? [])
      setRuleBreaks(data.ruleBreaks ?? [])
      if ((data.ruleBreaks ?? []).length === 0) {
        onCreated()
      }
    },
  })

  function onSubmit(values: Record<string, unknown>) {
    setApiError('')
    setWarnings([])
    setRuleBreaks([])
    mutation.mutate({
      ...values,
      entryPrice: parseFloat(values.entryPrice as string),
      stopPrice:  parseFloat(values.stopPrice as string),
      t1Price:    parseFloat(values.t1Price as string),
      t2Price:    values.t2Price ? parseFloat(values.t2Price as string) : undefined,
      riskEur:    parseFloat(values.riskEur as string),
      shares:     parseInt(values.shares as string),
    })
  }

  const inputCls = 'w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent'
  const labelCls = 'block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1'

  return (
    <Modal open={open} onClose={onClose} title="Log Trade" width="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Symbol</label>
            <input {...register('sym', { required: true })} className={inputCls} placeholder="AAPL" />
          </div>
          <div>
            <label className={labelCls}>Setup Quality</label>
            <select {...register('setupQuality')} className={inputCls}>
              <option value="">Select…</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Entry Price $</label>
            <input {...register('entryPrice', { required: true })} type="number" step="0.01" className={inputCls} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>Stop Price $</label>
            <input {...register('stopPrice', { required: true })} type="number" step="0.01" className={`${inputCls} border-loss/30`} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>Target 1 $</label>
            <input {...register('t1Price', { required: true })} type="number" step="0.01" className={`${inputCls} border-gain/30`} placeholder="0.00" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Target 2 $ (opt)</label>
            <input {...register('t2Price')} type="number" step="0.01" className={inputCls} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>Risk €</label>
            <input {...register('riskEur', { required: true })} type="number" step="0.01" className={`${inputCls} border-warn/30`} placeholder="12.00" defaultValue="12" />
          </div>
          <div>
            <label className={labelCls}>Shares</label>
            <input {...register('shares', { required: true })} type="number" className={inputCls} placeholder="0" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea {...register('notes')} rows={2} className={`${inputCls} resize-none`} placeholder="Entry thesis, observations…" />
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-warn/5 border border-warn/20 rounded-lg px-3 py-2.5 space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs font-mono text-warn">⚠ {w}</p>
            ))}
          </div>
        )}

        {/* Rule breaks — require confirmation */}
        {ruleBreaks.length > 0 && (
          <div className="bg-loss/5 border border-loss/30 rounded-lg px-3 py-2.5 space-y-1">
            <p className="text-sm font-mono font-semibold text-loss mb-1">Rule violations detected:</p>
            {ruleBreaks.map((r, i) => <p key={i} className="text-xs font-mono text-loss">✗ {r}</p>)}
            <p className="text-xxs font-mono text-text-muted mt-2">
              Log anyway? This will be recorded in trade history.
            </p>
            <button
              type="button"
              onClick={() => { setRuleBreaks([]); onCreated() }}
              className="mt-1 text-xxs font-mono text-loss hover:text-red-300 underline"
            >
              Accept & log despite violations
            </button>
          </div>
        )}

        {apiError && (
          <div className="bg-loss/5 border border-loss/30 rounded-lg px-3 py-2.5">
            <p className="text-sm font-mono text-loss">{apiError}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 bg-desk-raised border border-desk-border text-text-secondary text-sm font-semibold py-2.5 rounded-lg hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending}
            className="flex-1 bg-accent hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {mutation.isPending ? 'Logging…' : 'Log Trade'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Close Trade Modal ─────────────────────────────────────────────────────────

function CloseTradeModal({ trade, onClose, onClosed }: {
  trade: Trade; onClose: () => void; onClosed: () => void
}) {
  const [exitPrice, setExitPrice]   = useState('')
  const [exitReason, setExitReason] = useState('MANUAL')
  const [apiError, setApiError]     = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/trades?id=${trade.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ exitPrice: parseFloat(exitPrice), exitReason }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) { setApiError(data.error); return }
      onClosed()
    },
  })

  const pnlPreview = exitPrice
    ? (parseFloat(exitPrice) - trade.entryPrice) * trade.shares
    : null

  return (
    <Modal open onClose={onClose} title={`Close ${trade.sym}`}>
      <div className="space-y-4">
        {/* Trade info */}
        <div className="bg-desk-raised rounded-lg px-3 py-2.5 grid grid-cols-3 gap-2 text-xs font-mono">
          <div><span className="text-text-muted">Entry: </span><span className="text-text-primary">${trade.entryPrice.toFixed(2)}</span></div>
          <div><span className="text-text-muted">Stop: </span><span className="text-loss">${trade.stopPrice.toFixed(2)}</span></div>
          <div><span className="text-text-muted">T1: </span><span className="text-gain">${trade.t1Price.toFixed(2)}</span></div>
        </div>

        <div>
          <label className="block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1">Exit Price $</label>
          <input
            type="number" step="0.01"
            value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            className="w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
            placeholder="0.00"
          />
        </div>

        {pnlPreview != null && (
          <div className={`text-center text-xl font-mono font-semibold tabular ${pnlPreview >= 0 ? 'text-gain' : 'text-loss'}`}>
            {pnlPreview >= 0 ? '+' : ''}€{pnlPreview.toFixed(2)}
            <span className="text-xs text-text-muted ml-2">
              ({pnlPreview >= 0 ? '+' : ''}{(pnlPreview / trade.riskEur).toFixed(1)}R)
            </span>
          </div>
        )}

        <div>
          <label className="block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1">Exit Reason</label>
          <select
            value={exitReason}
            onChange={e => setExitReason(e.target.value)}
            className="w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="STOP_HIT">Stop Hit</option>
            <option value="TARGET_1">Target 1 Hit</option>
            <option value="TARGET_2">Target 2 Hit</option>
            <option value="TRAILING_STOP">Trailing Stop</option>
            <option value="MANUAL">Manual Close</option>
            <option value="END_OF_WEEK">End of Week</option>
            <option value="EARNINGS_RISK">Earnings Risk</option>
          </select>
        </div>

        {apiError && <p className="text-sm font-mono text-loss">{apiError}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-desk-raised border border-desk-border text-text-secondary text-sm font-semibold py-2.5 rounded-lg hover:text-text-primary">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!exitPrice || mutation.isPending}
            className={`flex-1 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 ${
              pnlPreview != null && pnlPreview >= 0 ? 'bg-gain hover:bg-emerald-400' : 'bg-loss hover:bg-red-400'
            }`}
          >
            {mutation.isPending ? 'Closing…' : 'Confirm Close'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
