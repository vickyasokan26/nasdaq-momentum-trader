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
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)

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
            onEdit={t => setEditingTrade(t)}
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
          <TradeTable trades={closed} onEdit={t => setEditingTrade(t)} />
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

      {editingTrade && (
        <EditTradeModal
          trade={editingTrade}
          onClose={() => setEditingTrade(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['trades'] }); setEditingTrade(null) }}
        />
      )}
    </div>
  )
}

// ── Trade Table ───────────────────────────────────────────────────────────────

function TradeTable({ trades, onClose, onEdit, showClose }: {
  trades: Trade[]
  onClose?: (t: Trade) => void
  onEdit?:  (t: Trade) => void
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
              <th></th>
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
                  <td>
                    <div className="flex items-center gap-3">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(t)}
                          className="text-xs font-mono text-text-muted hover:text-accent transition-colors"
                          title="Edit trade"
                        >
                          Edit
                        </button>
                      )}
                      {showClose && onClose && (
                        <button
                          onClick={() => onClose(t)}
                          className="text-xs font-mono text-accent hover:text-indigo-300 transition-colors"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </td>
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

  return (
    <Modal open={open} onClose={onClose} title="Log Trade" width="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="modal-grid-2">
          <div className="modal-field">
            <label className="modal-label">Symbol</label>
            <input {...register('sym', { required: true })} className="modal-input" placeholder="AAPL" />
          </div>
          <div className="modal-field">
            <label className="modal-label">Setup Quality</label>
            <select {...register('setupQuality')} className="modal-input">
              <option value="">Select…</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        <div className="modal-grid-3">
          <div className="modal-field">
            <label className="modal-label">Entry Price $</label>
            <input {...register('entryPrice', { required: true })} type="number" step="0.01" className="modal-input" placeholder="0.00" />
          </div>
          <div className="modal-field">
            <label className="modal-label">Stop Price $</label>
            <input {...register('stopPrice', { required: true })} type="number" step="0.01" className="modal-input" placeholder="0.00" style={{ borderColor: 'rgba(255,77,109,0.35)' }} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Target 1 $</label>
            <input {...register('t1Price', { required: true })} type="number" step="0.01" className="modal-input" placeholder="0.00" style={{ borderColor: 'rgba(0,214,124,0.35)' }} />
          </div>
        </div>

        <div className="modal-grid-3">
          <div className="modal-field">
            <label className="modal-label">Target 2 $ (opt)</label>
            <input {...register('t2Price')} type="number" step="0.01" className="modal-input" placeholder="0.00" />
          </div>
          <div className="modal-field">
            <label className="modal-label">Risk €</label>
            <input {...register('riskEur', { required: true })} type="number" step="0.01" className="modal-input" placeholder="12.00" defaultValue="12" style={{ borderColor: 'rgba(245,166,35,0.35)' }} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Shares</label>
            <input {...register('shares', { required: true })} type="number" className="modal-input" placeholder="0" />
          </div>
        </div>

        <div className="modal-field">
          <label className="modal-label">Notes (optional)</label>
          <textarea {...register('notes')} rows={2} className="modal-input" style={{ resize: 'none' }} placeholder="Entry thesis, observations…" />
        </div>

        {warnings.length > 0 && (
          <div style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {warnings.map((w, i) => (
              <p key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--amber)' }}>⚠ {w}</p>
            ))}
          </div>
        )}

        {ruleBreaks.length > 0 && (
          <div style={{ background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.25)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>Rule violations detected:</p>
            {ruleBreaks.map((r, i) => <p key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--red)' }}>✗ {r}</p>)}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4 }}>Log anyway? This will be recorded in trade history.</p>
            <button type="button" onClick={() => { setRuleBreaks([]); onCreated() }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left', marginTop: 2 }}>
              Accept &amp; log despite violations
            </button>
          </div>
        )}

        {apiError && (
          <div style={{ background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.25)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--red)' }}>{apiError}</p>
          </div>
        )}

        <div className="modal-row">
          <button type="button" onClick={onClose} className="modal-btn modal-btn-cancel">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="modal-btn modal-btn-primary">
            {mutation.isPending ? 'Logging…' : 'Log Trade'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit Trade Modal ──────────────────────────────────────────────────────────

function EditTradeModal({ trade, onClose, onSaved }: {
  trade: Trade; onClose: () => void; onSaved: () => void
}) {
  const isClosed = trade.status === 'CLOSED'

  // Format ISO datetime to YYYY-MM-DD for <input type="date">
  const tradeDateDefault = trade.tradeDate
    ? new Date(trade.tradeDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  const { register, handleSubmit } = useForm<{
    sym: string; tradeDate: string; entryPrice: number; stopPrice: number
    t1Price: number; t2Price: number; riskEur: number; shares: number
    notes: string; setupQuality: string
  }>({
    defaultValues: {
      sym:          trade.sym,
      tradeDate:    tradeDateDefault,
      entryPrice:   trade.entryPrice,
      stopPrice:    trade.stopPrice,
      t1Price:      trade.t1Price,
      t2Price:      trade.t2Price ?? undefined,
      riskEur:      trade.riskEur,
      shares:       trade.shares,
      notes:        trade.notes ?? '',
      setupQuality: trade.setupQuality ?? '',
    },
  })

  const [apiError, setApiError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/trades?id=${trade.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      }).then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? `Server error ${r.status}`)
        return json
      }),
    onSuccess: (data) => {
      if (data.error) { setApiError(data.error); return }
      onSaved()
    },
    onError: (err: unknown) => {
      setApiError(err instanceof Error ? err.message : 'Save failed — please try again')
    },
  })

  function onSubmit(values: Record<string, unknown>) {
    setApiError('')
    if (isClosed) {
      // Closed trades: notes + quality only — financial fields are locked
      mutation.mutate({
        notes:        (values.notes as string) || null,
        setupQuality: (values.setupQuality as string) || null,
      })
      return
    }
    mutation.mutate({
      sym:          (values.sym as string).toUpperCase(),
      tradeDate:    values.tradeDate
                      ? new Date(values.tradeDate as string).toISOString()
                      : undefined,
      entryPrice:   parseFloat(values.entryPrice as string),
      stopPrice:    parseFloat(values.stopPrice as string),
      t1Price:      parseFloat(values.t1Price as string),
      t2Price:      values.t2Price ? parseFloat(values.t2Price as string) : null,
      riskEur:      parseFloat(values.riskEur as string),
      shares:       parseInt(values.shares as string),
      notes:        (values.notes as string) || null,
      setupQuality: (values.setupQuality as string) || null,
    })
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${trade.sym}`} width="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {isClosed && (
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text3)' }}>
              Trade is closed — financial fields are locked. You can update notes and setup quality.
            </p>
          </div>
        )}

        <div className="modal-grid-3">
          <div className="modal-field">
            <label className="modal-label">Symbol</label>
            <input {...register('sym', { required: !isClosed })} className="modal-input" disabled={isClosed} placeholder="AAPL" />
          </div>
          <div className="modal-field">
            <label className="modal-label">Trade Date</label>
            <input {...register('tradeDate', { required: !isClosed })} type="date" className="modal-input" disabled={isClosed} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Setup Quality</label>
            <select {...register('setupQuality')} className="modal-input">
              <option value="">Select…</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        <div className="modal-grid-3">
          <div className="modal-field">
            <label className="modal-label">Entry Price $</label>
            <input {...register('entryPrice', { required: !isClosed })} type="number" step="0.01" className="modal-input" disabled={isClosed} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Stop Price $</label>
            <input {...register('stopPrice', { required: !isClosed })} type="number" step="0.01" className="modal-input" disabled={isClosed} style={{ borderColor: 'rgba(255,77,109,0.35)' }} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Target 1 $</label>
            <input {...register('t1Price', { required: !isClosed })} type="number" step="0.01" className="modal-input" disabled={isClosed} style={{ borderColor: 'rgba(0,214,124,0.35)' }} />
          </div>
        </div>

        <div className="modal-grid-3">
          <div className="modal-field">
            <label className="modal-label">Target 2 $ (opt)</label>
            <input {...register('t2Price')} type="number" step="0.01" className="modal-input" disabled={isClosed} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Risk €</label>
            <input {...register('riskEur', { required: !isClosed })} type="number" step="0.01" className="modal-input" disabled={isClosed} style={{ borderColor: 'rgba(245,166,35,0.35)' }} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Shares</label>
            <input {...register('shares', { required: !isClosed })} type="number" className="modal-input" disabled={isClosed} />
          </div>
        </div>

        <div className="modal-field">
          <label className="modal-label">Notes</label>
          <textarea {...register('notes')} rows={3} className="modal-input" style={{ resize: 'none' }} placeholder="Entry thesis, observations, corrections…" />
        </div>

        {apiError && (
          <div style={{ background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.25)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--red)' }}>✗ {apiError}</p>
          </div>
        )}

        <div className="modal-row">
          <button type="button" onClick={onClose} className="modal-btn modal-btn-cancel">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="modal-btn modal-btn-primary">
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}


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

  const confirmCls = `modal-btn ${pnlPreview != null && pnlPreview >= 0 ? 'modal-btn-gain' : 'modal-btn-loss'}`

  return (
    <Modal open onClose={onClose} title={`Close ${trade.sym}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Trade info strip */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
          <div><span style={{ color: 'var(--text3)' }}>Entry </span><span style={{ color: 'var(--text)' }}>${trade.entryPrice.toFixed(2)}</span></div>
          <div><span style={{ color: 'var(--text3)' }}>Stop </span><span style={{ color: 'var(--red)' }}>${trade.stopPrice.toFixed(2)}</span></div>
          <div><span style={{ color: 'var(--text3)' }}>T1 </span><span style={{ color: 'var(--green)' }}>${trade.t1Price.toFixed(2)}</span></div>
        </div>

        <div className="modal-field">
          <label className="modal-label">Exit Price $</label>
          <input
            type="number" step="0.01"
            value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            className="modal-input"
            placeholder="0.00"
            autoFocus
          />
        </div>

        {pnlPreview != null && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pnlPreview >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {pnlPreview >= 0 ? '+' : ''}€{pnlPreview.toFixed(2)}
            <span style={{ fontSize: '0.8rem', color: 'var(--text3)', marginLeft: 8 }}>
              ({pnlPreview >= 0 ? '+' : ''}{(pnlPreview / trade.riskEur).toFixed(1)}R)
            </span>
          </div>
        )}

        <div className="modal-field">
          <label className="modal-label">Exit Reason</label>
          <select value={exitReason} onChange={e => setExitReason(e.target.value)} className="modal-input">
            <option value="STOP_HIT">Stop Hit</option>
            <option value="TARGET_1">Target 1 Hit</option>
            <option value="TARGET_2">Target 2 Hit</option>
            <option value="TRAILING_STOP">Trailing Stop</option>
            <option value="MANUAL">Manual Close</option>
            <option value="END_OF_WEEK">End of Week</option>
            <option value="EARNINGS_RISK">Earnings Risk</option>
          </select>
        </div>

        {apiError && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--red)' }}>{apiError}</p>
        )}

        <div className="modal-row">
          <button onClick={onClose} className="modal-btn modal-btn-cancel">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!exitPrice || mutation.isPending}
            className={confirmCls}
          >
            {mutation.isPending ? 'Closing…' : 'Confirm Close'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
