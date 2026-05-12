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

const card: React.CSSProperties = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 20,
}

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 600,
  color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16,
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

  const rrBarPct  = result ? Math.min(100, (result.rrToT1 / 5) * 100) : 0
  const rrBarColor = result
    ? result.rrToT1 >= ACCOUNT.PREFERRED_RR ? 'var(--green)'
    : result.rrToT1 >= ACCOUNT.MIN_RR       ? 'var(--amber)'
    : 'var(--red)'
    : 'var(--border)'

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Position Sizer
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text3)', marginTop: 3 }}>
          Structure-based sizing — stop distance is variable, risk is fixed
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Input panel ── */}
        <div style={card}>
          <div style={sectionTitle}>Trade Parameters</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="modal-label">Entry Price $</label>
                <input type="number" step="0.01" value={entry}
                  onChange={e => setEntry(e.target.value)}
                  className="modal-input" placeholder="0.00" />
              </div>
              <div>
                <label className="modal-label">Stop Price $</label>
                <input type="number" step="0.01" value={stop}
                  onChange={e => setStop(e.target.value)}
                  className="modal-input" placeholder="0.00"
                  style={{ borderColor: 'rgba(255,77,109,0.35)' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="modal-label">Target 1 $</label>
                <input type="number" step="0.01" value={t1}
                  onChange={e => setT1(e.target.value)}
                  className="modal-input" placeholder="0.00"
                  style={{ borderColor: 'rgba(0,214,124,0.35)' }} />
              </div>
              <div>
                <label className="modal-label">Target 2 $ (opt)</label>
                <input type="number" step="0.01" value={t2}
                  onChange={e => setT2(e.target.value)}
                  className="modal-input" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="modal-label">Risk Amount €</label>
              <input type="number" step="0.01" value={risk}
                onChange={e => setRisk(e.target.value)}
                className="modal-input" placeholder="12.00"
                style={{ borderColor: 'rgba(245,166,35,0.35)' }} />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginTop: 5 }}>
                Range: €{ACCOUNT.MIN_RISK_EUR}–€{ACCOUNT.MAX_RISK_EUR}
              </p>
            </div>

            {error && (
              <div style={{ background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.25)', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--red)' }}>{error}</p>
              </div>
            )}

            <button
              onClick={calculate}
              disabled={!entry || !stop || !t1 || loading}
              style={{
                background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8,
                fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600,
                padding: '11px 0', cursor: (!entry || !stop || !t1 || loading) ? 'not-allowed' : 'pointer',
                opacity: (!entry || !stop || !t1 || loading) ? 0.45 : 1,
                transition: 'opacity 0.15s', width: '100%',
              }}
            >
              {loading ? 'Calculating…' : 'Calculate'}
            </button>
          </div>
        </div>

        {/* ── Result panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!result ? (
            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text3)' }}>
                Enter trade parameters to calculate size
              </p>
            </div>
          ) : (
            <>
              {/* Stat grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

              {/* R:R card */}
              <div style={card}>
                <div style={sectionTitle}>Reward : Risk</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginBottom: 4 }}>To Target 1</div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700,
                      color: result.rrToT1 >= ACCOUNT.MIN_RR ? 'var(--green)' : 'var(--red)',
                      fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                    }}>
                      {result.rrToT1.toFixed(1)}:1
                    </div>
                  </div>
                  {result.rrToT2 != null && (
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginBottom: 4 }}>To Target 2</div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 600,
                        color: 'var(--blue)', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                      }}>
                        {result.rrToT2.toFixed(1)}:1
                      </div>
                    </div>
                  )}
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginBottom: 4 }}>Minimum</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                      {ACCOUNT.MIN_RR}:1
                    </div>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${rrBarPct}%`,
                    background: rrBarColor, borderRadius: 999,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.warnings.map((w, i) => {
                    const isHard = w.includes('DO NOT') || w.includes('WILL be hunted')
                    return (
                      <div key={i} style={{
                        background: isHard ? 'rgba(255,77,109,0.06)' : 'rgba(245,166,35,0.06)',
                        border: `1px solid ${isHard ? 'rgba(255,77,109,0.25)' : 'rgba(245,166,35,0.2)'}`,
                        borderRadius: 8, padding: '10px 14px',
                      }}>
                        <p style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
                          color: isHard ? 'var(--red)' : 'var(--amber)', lineHeight: 1.5,
                        }}>
                          {isHard ? '✗' : '⚠'} {w}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Size Reference table ── */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={sectionTitle}>Size Reference — €{ACCOUNT.SIZE_EUR} Account</div>
        <div style={{ overflowX: 'auto' }}>
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
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{dist}%</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>€{pos10.toFixed(0)}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--amber)' }}>€{pos12.toFixed(0)}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>€{pos14.toFixed(0)}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>~{Math.floor(pos12 / 30)}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>~{Math.floor(pos12 / 50)}</span></td>
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
