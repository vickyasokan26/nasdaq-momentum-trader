'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { calcCandidateLevels } from '@/features/trades/levels'

const CHECKLIST_ITEMS = [
  { key: 'priceAtEma', label: 'Price is retesting EMA20 or EMA50 from above and holding' },
  { key: 'rsi1hOk',   label: '1H RSI is 45–65, above 9-period MA, with higher lows over last 3 candles' },
  { key: 'vol1hOk',   label: 'Volume on last 3 completed 1H candles exceeds the 10-day average' },
] as const

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: () => void
}

export function CreateTradeModal({ open, onClose, onCreated }: Props) {
  const qc = useQueryClient()
  const { register, handleSubmit, setValue } = useForm<{
    sym: string; entryPrice: number; stopPrice: number; t1Price: number
    t2Price: number; riskEur: number; shares: number; notes: string
    setupQuality: string
  }>()

  const [apiError,   setApiError]   = useState('')
  const [warnings,   setWarnings]   = useState<string[]>([])
  const [ruleBreaks, setRuleBreaks] = useState<string[]>([])
  const [autoFilled, setAutoFilled] = useState(false)
  const [lookingUp,  setLookingUp]  = useState(false)
  const [checklist,  setChecklist]  = useState({ priceAtEma: false, rsi1hOk: false, vol1hOk: false })

  const checklistComplete = checklist.priceAtEma && checklist.rsi1hOk && checklist.vol1hOk

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/trades', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      }).then(r => r.json()),
  })

  async function lookupScreener(sym: string) {
    if (!sym.trim()) return
    setLookingUp(true)
    try {
      const res  = await fetch(`/api/candidates?latest=true&sym=${encodeURIComponent(sym.trim().toUpperCase())}`)
      const data = await res.json()
      const c    = data?.candidates?.[0]
      if (c) {
        const lvl = calcCandidateLevels(c)
        setValue('entryPrice', parseFloat(lvl.entryLow.toFixed(2)))
        setValue('stopPrice',  parseFloat(lvl.stop.toFixed(2)))
        setValue('t1Price',    parseFloat(lvl.t1.toFixed(2)))
        setValue('t2Price',    parseFloat(lvl.t2.toFixed(2)))
        setValue('shares',     lvl.shares)
        setAutoFilled(true)
      } else {
        setAutoFilled(false)
      }
    } catch { /* ignore */ }
    setLookingUp(false)
  }

  async function onSubmit(values: Record<string, unknown>) {
    setApiError('')
    setWarnings([])
    setRuleBreaks([])
    if (!checklistComplete) {
      setApiError('Complete the 1H entry checklist before logging.')
      return
    }
    let data
    try {
      data = await mutation.mutateAsync({
        ...values,
        entryPrice:     parseFloat(values.entryPrice as string),
        stopPrice:      parseFloat(values.stopPrice as string),
        t1Price:        parseFloat(values.t1Price as string),
        t2Price:        values.t2Price ? parseFloat(values.t2Price as string) : undefined,
        riskEur:        parseFloat(values.riskEur as string),
        shares:         parseInt(values.shares as string),
        entryChecklist: checklist,
      })
    } catch {
      setApiError('Network error — check your connection and try again.')
      return
    }
    if (data.error) { setApiError(data.error); return }
    setWarnings(data.sizing?.warnings ?? [])
    setRuleBreaks(data.ruleBreaks ?? [])
    if ((data.ruleBreaks ?? []).length === 0) {
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['pnl'] })
      onCreated()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Trade" width="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="modal-grid-2">
          <div className="modal-field">
            <label className="modal-label">Symbol</label>
            <input
              {...register('sym', { required: true })}
              className="modal-input"
              placeholder="AAPL"
              onBlur={e => lookupScreener(e.target.value)}
              onChange={() => setAutoFilled(false)}
            />
            {lookingUp && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginTop: 4 }}>
                Looking up screener data…
              </p>
            )}
            {autoFilled && !lookingUp && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--green)', marginTop: 4 }}>
                ✓ Levels pre-filled from latest screener — adjust as needed
              </p>
            )}
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

        <div style={{ background: 'var(--bg3)', border: `1px solid ${checklistComplete ? 'rgba(0,214,124,0.3)' : 'var(--border)'}`, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            1H Entry Checklist — all required
          </p>
          {CHECKLIST_ITEMS.map(item => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checklist[item.key]}
                onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                style={{ marginTop: 2, accentColor: 'var(--green)', width: 14, height: 14, flexShrink: 0 }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: checklist[item.key] ? 'var(--text)' : 'var(--text2)', lineHeight: 1.4 }}>
                {item.label}
              </span>
            </label>
          ))}
          {!checklistComplete && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--amber)', marginTop: 2 }}>
              ⚠ Check all 3 conditions before logging
            </p>
          )}
        </div>

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
