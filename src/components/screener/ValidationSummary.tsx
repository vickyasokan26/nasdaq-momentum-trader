'use client'

import { useState } from 'react'

interface ValidationReport {
  totalRows:         number
  validRows:         number
  passedRows:        number
  droppedRows:       number
  requiredMissing:   string[]
  importantMissing?: string[]
  ambiguousColumns:  string[]
  resolvedMapping:   Record<string, string>
  rowErrors:         Array<{ row: number; sym?: string; reason: string }>
  filterDropReasons: Record<string, number>
}

const IMPORTANT_FIELD_WARNINGS: Record<string, string> = {
  perf1y:         'Performance (1 year) column missing — the 100%+ annual gain gate is disabled. Stocks that haven\'t doubled in the past year will slip through. Add "Performance (1 year)" to your TradingView screener columns.',
  relativeVolume: 'Relative Volume column missing — the RelVol > 0.8 gate is disabled.',
  rsi14:          'RSI(14) column missing — the RSI 45–75 gate is disabled.',
  ema20:          'EMA(20) column missing — EMA stack filter and entry zone cannot be calculated.',
  ema50:          'EMA(50) column missing — EMA stack filter and structural stop cannot be calculated.',
  sma50:          'SMA(50) column missing — the price > SMA50 trend filter is disabled.',
  volume:         'Volume column missing — the avg 10D volume > 500K gate is disabled.',
}

interface Props {
  result:    { report: ValidationReport; sessionId: string }
  onDismiss: () => void
}

const FILTER_LABELS: Record<string, string> = {
  relVol:     'Relative Volume',
  earnings:   'Earnings Blackout',
  dist52wh:   '52W High Distance',
  marketCap:  'Market Cap',
  perfly:     'Perf 1Y Guard',
  sectorCap:  'Sector Cap (max 2)',
  rsi:        'RSI Range',
  price:      'Price Floor',
  ema:        'EMA Stack',
  volume:     'Avg Volume',
  spike:      'Weekly Spike',
  sma50:      'Price > SMA50',
}

function labelFor(key: string): string {
  const clean = key.replace(/Gate$/i, '').replace(/([A-Z])/g, ' $1').trim()
  const lower = clean.replace(/\s+/g, '').toLowerCase()
  for (const [k, v] of Object.entries(FILTER_LABELS)) {
    if (lower.includes(k.toLowerCase())) return v
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export function ValidationSummary({ result, onDismiss }: Props) {
  const [showMapping, setShowMapping] = useState(false)
  const r      = result.report
  const drops  = r.filterDropReasons ?? {}
  const passed = r.passedRows
  const total  = r.totalRows
  const filtered = total - passed - (r.droppedRows ?? 0)

  const sortedDrops = Object.entries(drops)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
  const maxDrop = sortedDrops[0]?.[1] ?? 1

  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0
  const isGood   = passed > 0

  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${isGood ? 'rgba(0,214,124,0.2)' : 'var(--border)'}`,
      borderRadius: 12, overflow: 'hidden', animation: 'slideUp 0.2s ease-out',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: isGood ? 'rgba(0,214,124,0.04)' : 'rgba(255,77,109,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 900, lineHeight: 1,
            color: isGood ? 'var(--green)' : 'var(--red)',
          }}>
            {passed}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              {passed === 1 ? 'stock passed' : 'stocks passed'} all filters
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 2 }}>
              {passRate}% pass rate · session {result.sessionId.slice(-8)}
            </div>
          </div>
        </div>
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', color: 'var(--text3)', fontSize: '1.4rem',
          cursor: 'pointer', lineHeight: 1, padding: '0 4px',
        }}>×</button>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Funnel ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { label: 'Total rows',     value: total,            color: 'var(--text2)' },
            { label: 'Parse errors',   value: r.droppedRows,    color: r.droppedRows > 0 ? 'var(--amber)' : 'var(--text3)' },
            { label: 'Filtered out',   value: total - passed - (r.droppedRows ?? 0), color: 'var(--text2)' },
            { label: 'Passed',         value: passed,           color: isGood ? 'var(--green)' : 'var(--red)' },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{
                flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {s.label}
                </div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text3)', padding: '0 6px', flexShrink: 0 }}>→</div>
              )}
            </div>
          ))}
        </div>

        {/* ── Filter drop bars ── */}
        {sortedDrops.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
              Why stocks were filtered out
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedDrops.map(([key, count]) => {
                const pct = (count / maxDrop) * 100
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text2)', width: 160, flexShrink: 0 }}>
                      {labelFor(key)}
                    </div>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(245,166,35,0.5)', borderRadius: 999, transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--amber)', fontVariantNumeric: 'tabular-nums', width: 28, textAlign: 'right', flexShrink: 0 }}>
                      {count}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Missing filter columns ── */}
        {(r.importantMissing ?? []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(r.importantMissing ?? []).map(field => {
              const msg = IMPORTANT_FIELD_WARNINGS[field]
              if (!msg) return null
              return (
                <div key={field} style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.22)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--amber)', flexShrink: 0 }}>⚠</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--amber)', lineHeight: 1.55 }}>{msg}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Warnings ── */}
        {r.ambiguousColumns.length > 0 && (
          <div style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--amber)' }}>
              ⚠ Ambiguous columns (first match used): {r.ambiguousColumns.join(', ')}
            </p>
          </div>
        )}
        {r.rowErrors.length > 0 && (
          <div style={{ background: 'rgba(255,77,109,0.05)', border: '1px solid rgba(255,77,109,0.18)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--red)', marginBottom: 6 }}>
              {r.rowErrors.length} rows skipped due to parse errors
            </p>
            {r.rowErrors.slice(0, 4).map((e, i) => (
              <p key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 2 }}>
                Row {e.row}{e.sym ? ` (${e.sym})` : ''}: {e.reason}
              </p>
            ))}
            {r.rowErrors.length > 4 && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4 }}>
                …and {r.rowErrors.length - 4} more
              </p>
            )}
          </div>
        )}

        {/* ── Column mapping toggle ── */}
        <div>
          <button
            onClick={() => setShowMapping(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)',
              textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: '0.55rem' }}>{showMapping ? '▼' : '▶'}</span>
            Column mapping ({Object.keys(r.resolvedMapping).length} columns detected)
          </button>
          {showMapping && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              {Object.entries(r.resolvedMapping).map(([canonical, header]) => (
                <div key={canonical} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                  <span style={{ color: 'var(--text3)' }}>{canonical}</span>
                  <span style={{ color: 'var(--border2)' }}>→</span>
                  <span style={{ color: 'var(--green)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{header}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
