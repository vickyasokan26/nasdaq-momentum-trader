'use client'

import { useState } from 'react'
import { StatCard } from '@/components/ui/StatCard'
import { ACCOUNT } from '@/constants/screener'

interface SizerResult {
  stopDistancePct:  number
  positionValueEur: number
  cappedValueEur:   number
  wasCapped:        boolean
  actualRiskEur:    number
  shares:           number
  rrToT1:           number
  rrToT2?:          number
  warnings:         string[]
  tradingWindow:    string
}

export default function SizerPage() {
  const [entry,   setEntry]   = useState('')
  const [stop,    setStop]    = useState('')
  const [t1,      setT1]      = useState('')
  const [t2,      setT2]      = useState('')
  const [risk,    setRisk]    = useState('12')
  const [result,  setResult]  = useState<SizerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function calculate() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/sizer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryPrice: parseFloat(entry),
          stopPrice:  parseFloat(stop),
          t1Price:    parseFloat(t1),
          t2Price:    t2 ? parseFloat(t2) : undefined,
          riskEur:    parseFloat(risk),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Calculation failed'); return }
      setResult(data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted'
  const labelCls = 'block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1.5'

  return (
    <div className="p-6 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Position Sizer</h1>
        <p className="text-text-muted text-sm font-mono mt-0.5">
          Structure-based sizing — stop distance is variable, risk is fixed
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="bg-desk-surface border border-desk-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest">Trade Parameters</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Entry Price $</label>
              <input type="number" step="0.01" value={entry} onChange={e => setEntry(e.target.value)}
                className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Stop Price $</label>
              <input type="number" step="0.01" value={stop} onChange={e => setStop(e.target.value)}
                className={`${inputCls} border-loss/30`} placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Target 1 $</label>
              <input type="number" step="0.01" value={t1} onChange={e => setT1(e.target.value)}
                className={`${inputCls} border-gain/30`} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Target 2 $ (opt)</label>
              <input type="number" step="0.01" value={t2} onChange={e => setT2(e.target.value)}
                className={inputCls} placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Risk Amount €</label>
            <input type="number" step="0.01" value={risk} onChange={e => setRisk(e.target.value)}
              className={`${inputCls} border-warn/30`} placeholder="12.00" />
            <p className="text-xxs font-mono text-text-muted mt-1">Range: €{ACCOUNT.MIN_RISK_EUR}–€{ACCOUNT.MAX_RISK_EUR}</p>
          </div>

          {error && (
            <div className="bg-loss/5 border border-loss/30 rounded-lg px-3 py-2.5">
              <p className="text-sm font-mono text-loss">{error}</p>
            </div>
          )}

          <button
            onClick={calculate}
            disabled={!entry || !stop || !t1 || loading}
            className="w-full bg-accent hover:bg-indigo-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Calculating…' : 'Calculate'}
          </button>
        </div>

        {/* Result panel */}
        <div className="space-y-4">
          {!result ? (
            <div className="bg-desk-surface border border-desk-border rounded-xl p-8 text-center">
              <p className="text-text-muted font-mono text-sm">Enter trade parameters to calculate size</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Shares"
                  value={result.shares}
                  sub={result.wasCapped ? 'Position capped' : undefined}
                  accent={result.shares > 0 ? 'accent' : 'loss'}
                />
                <StatCard
                  label="Position Value"
                  value={`€${result.cappedValueEur.toFixed(0)}`}
                  sub={result.wasCapped ? `Raw: €${result.positionValueEur.toFixed(0)}` : undefined}
                  accent={result.wasCapped ? 'warn' : 'neutral'}
                />
                <StatCard
                  label="Actual Risk"
                  value={`€${result.actualRiskEur.toFixed(2)}`}
                  accent={result.actualRiskEur > ACCOUNT.MAX_RISK_EUR ? 'loss' : 'warn'}
                />
                <StatCard
                  label="Stop Distance"
                  value={`${result.stopDistancePct.toFixed(2)}%`}
                  accent={result.stopDistancePct < 1 ? 'loss' : 'neutral'}
                />
              </div>

              {/* R:R display */}
              <div className="bg-desk-surface border border-desk-border rounded-xl p-4">
                <div className="text-xxs font-mono text-text-muted uppercase tracking-widest mb-3">Reward : Risk</div>
                <div className="flex items-end gap-4">
                  <div>
                    <div className="text-xxs font-mono text-text-muted mb-1">To Target 1</div>
                    <div className={`text-2xl font-mono font-semibold tabular ${result.rrToT1 >= ACCOUNT.MIN_RR ? 'text-gain' : 'text-loss'}`}>
                      {result.rrToT1.toFixed(1)}:1
                    </div>
                  </div>
                  {result.rrToT2 != null && (
                    <div>
                      <div className="text-xxs font-mono text-text-muted mb-1">To Target 2</div>
                      <div className="text-xl font-mono font-semibold tabular text-accent">
                        {result.rrToT2.toFixed(1)}:1
                      </div>
                    </div>
                  )}
                  <div className="ml-auto text-right">
                    <div className="text-xxs font-mono text-text-muted mb-1">Minimum</div>
                    <div className="text-lg font-mono text-text-muted">{ACCOUNT.MIN_RR}:1</div>
                  </div>
                </div>

                {/* R:R bar */}
                <div className="mt-3 h-1.5 bg-desk-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${result.rrToT1 >= ACCOUNT.PREFERRED_RR ? 'bg-gain' : result.rrToT1 >= ACCOUNT.MIN_RR ? 'bg-warn' : 'bg-loss'}`}
                    style={{ width: `${Math.min(100, (result.rrToT1 / 5) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="space-y-2">
                  {result.warnings.map((w, i) => (
                    <div key={i} className={`
                      border rounded-lg px-3 py-2.5 text-xs font-mono
                      ${w.includes('DO NOT') || w.includes('WILL be hunted')
                        ? 'bg-loss/5 border-loss/30 text-loss'
                        : 'bg-warn/5 border-warn/20 text-warn'
                      }
                    `}>
                      {w.includes('DO NOT') || w.includes('WILL') ? '✗' : '⚠'} {w}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reference table */}
      <div className="mt-6 bg-desk-surface border border-desk-border rounded-xl p-5">
        <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest mb-4">
          Size Reference — €{ACCOUNT.SIZE_EUR} Account
        </h2>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Stop Distance</th>
                <th>Risk €10</th>
                <th>Risk €12</th>
                <th>Risk €14</th>
                <th>Shares @ $30</th>
                <th>Shares @ $50</th>
              </tr>
            </thead>
            <tbody>
              {[1.5, 2.0, 2.5, 3.0, 3.5, 5.0].map(dist => {
                const pos10 = Math.min(10 / (dist / 100), ACCOUNT.SIZE_EUR * ACCOUNT.MAX_POSITION_PCT)
                const pos12 = Math.min(12 / (dist / 100), ACCOUNT.SIZE_EUR * ACCOUNT.MAX_POSITION_PCT)
                const pos14 = Math.min(14 / (dist / 100), ACCOUNT.SIZE_EUR * ACCOUNT.MAX_POSITION_PCT)
                return (
                  <tr key={dist}>
                    <td><span className="font-mono tabular">{dist}%</span></td>
                    <td><span className="font-mono tabular text-text-secondary">€{pos10.toFixed(0)}</span></td>
                    <td><span className="font-mono tabular text-warn">€{pos12.toFixed(0)}</span></td>
                    <td><span className="font-mono tabular text-text-secondary">€{pos14.toFixed(0)}</span></td>
                    <td><span className="font-mono tabular text-text-secondary">~{Math.floor(pos12 / 30)}</span></td>
                    <td><span className="font-mono tabular text-text-secondary">~{Math.floor(pos12 / 50)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
