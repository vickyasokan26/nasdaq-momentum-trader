'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface Candidate {
  id:             string
  sym:            string
  description?:   string | null
  price:          number
  rsi?:           number | null
  ema20?:         number | null
  ema50?:         number | null
  sma50?:         number | null
  relVol?:        number | null
  dist52wh?:      number | null
  chg1w?:         number | null
  high52w?:       number | null
  sector?:        string | null
  earningsDate?:  string | null
  earningsRaw?:   string | null
  score:          number
  rank?:          number | null
  candidateState: string
}

interface Props {
  candidates: Candidate[]
  showAll?:   boolean
  maxRows?:   number
}

function calcEmaGap(ema20?: number | null, ema50?: number | null): number {
  if (!ema20 || !ema50 || ema50 === 0) return 0
  return ((ema20 - ema50) / ema50) * 100
}

function daysUntilEarnings(dateStr?: string | null): number {
  if (!dateStr) return 999
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 999
  return Math.round((d.getTime() - Date.now()) / 86400000)
}

interface VerdictResult {
  v:     'ENTER' | 'WAIT' | 'SKIP'
  label: string
  text:  string
}

function calcVerdict(c: Candidate): VerdictResult {
  const emaGap   = calcEmaGap(c.ema20, c.ema50)
  const rsi      = c.rsi ?? 0
  const earnDays = daysUntilEarnings(c.earningsDate)

  if (c.price > 100 && (c.relVol ?? 0) < 0.8)
    return { v: 'SKIP', label: 'Account size constraint',
      text: `At $${c.price.toFixed(2)}/share, position sizing is very tight on €700. Monitor for account scaling to €1,000+.` }

  if (emaGap < 0.5)
    return { v: 'WAIT', label: 'EMA gap too thin',
      text: `EMA gap is only ${emaGap.toFixed(1)}% — EMAs are compressing, momentum stalling. Wait for gap to expand before looking for a 1H entry.` }

  if (earnDays >= 0 && earnDays <= 10)
    return { v: 'SKIP', label: 'Inside earnings blackout',
      text: `Earnings in ${earnDays}d. Hard blackout — pre-earnings pump risk is too high. Do not enter.` }

  if (earnDays >= 11 && earnDays < 20)
    return { v: 'WAIT', label: 'Earnings approaching',
      text: `Earnings in ${earnDays}d. Entry possible but must be fully out by day ${earnDays - 8} latest.` }

  if (rsi > 65)
    return { v: 'WAIT', label: 'RSI elevated on daily',
      text: `Daily RSI ${rsi.toFixed(1)} is running hot. Wait for a 1H pullback to cool below 60. Do not chase.` }

  if (rsi < 52 && emaGap > 2)
    return { v: 'ENTER', label: 'Enter on 1H confirmation',
      text: `RSI ${rsi.toFixed(1)} mid-pullback with clean EMA structure (${emaGap.toFixed(1)}% gap). Drop to 1H — EMA 20/50 retest + RSI 45–65 above 9MA + 3×1H candles above avg volume.` }

  return { v: 'ENTER', label: 'Enter on 1H confirmation',
    text: `Clean daily setup. Drop to 1H — wait for EMA 20/50 retest, RSI 45–65 above its 9MA, and last 3×1H candles above average volume.` }
}

interface Levels {
  entryLow:  number
  entryHigh: number
  stop:      number
  t1:        number
  t2:        number
  rr:        number
  posEur:    number
  shares:    number
  stopPct:   number
}

function calcLevels(c: Candidate): Levels {
  const emaGap    = calcEmaGap(c.ema20, c.ema50)
  const sd        = Math.max(0.025, Math.min(0.055, 0.03 + (emaGap / 100)))
  const entryLow  = c.price * 0.985
  const entryHigh = c.price * 0.997
  const stop      = entryLow * (1 - sd)
  const t1        = c.price * (1 + sd * 2.5)
  const t2        = c.price * (1 + sd * 4)
  const rr        = (t1 - entryLow) / (entryLow - stop)
  const posEur    = Math.min(12 / sd, 595)
  const shares    = Math.floor((posEur * 1.09) / c.price)
  return { entryLow, entryHigh, stop, t1, t2, rr, posEur, shares, stopPct: sd * 100 }
}

interface Signal {
  key:     string
  val:     string
  status:  'ok' | 'warn' | 'fail' | 'neutral'
  tooltip: string
}

function buildSignals(c: Candidate): Signal[] {
  const emaGap   = calcEmaGap(c.ema20, c.ema50)
  const earnDays = daysUntilEarnings(c.earningsDate)
  const earnLabel = earnDays < 999 ? (c.earningsRaw ?? `${earnDays}d`) : 'Clear'

  return [
    {
      key:    'EMA Gap',
      val:    `${emaGap.toFixed(1)}%`,
      status: emaGap < 1 ? 'warn' : emaGap > 8 ? 'warn' : 'ok',
      tooltip: emaGap < 1
        ? 'Too thin — EMAs compressing, momentum stalling. Wait for expansion.'
        : emaGap > 8
          ? 'Extended — enter only on deep 1H pullback to 50 EMA, not 20.'
          : 'Daily trend confirmed. Drop to 1H and wait for EMA retest.',
    },
    {
      key:    'RSI',
      val:    c.rsi != null ? c.rsi.toFixed(1) : '—',
      status: c.rsi == null ? 'neutral' : c.rsi < 65 ? 'ok' : 'warn',
      tooltip: c.rsi == null ? 'No RSI data.'
        : c.rsi < 52
          ? 'Mid-pullback — most room to run. Still need 1H RSI 45–65 above 9MA at entry.'
          : c.rsi < 65
            ? 'Mid-range. Confirm 1H RSI 45–65 and rising at entry.'
            : 'Warm — wait for 1H pullback before entry.',
    },
    {
      key:    'Rel Vol',
      val:    c.relVol != null ? `${c.relVol.toFixed(2)}×` : '—',
      status: c.relVol == null ? 'neutral'
        : c.relVol >= 1.2 ? 'ok'
        : c.relVol >= 0.8 ? 'warn'
        : 'fail',
      tooltip: c.relVol == null ? 'No volume data.'
        : c.relVol >= 1.2
          ? 'Above average. Still confirm last 3×1H candles at entry.'
          : c.relVol >= 0.8
            ? 'Borderline. Avg of last 3×1H candles must exceed 10D hourly avg.'
            : 'Weak daily volume. 1H candles must clearly exceed 10D average hourly.',
    },
    {
      key:    'Earnings',
      val:    earnLabel,
      status: earnDays <= 10 ? 'fail' : earnDays <= 20 ? 'warn' : 'ok',
      tooltip: earnDays <= 10
        ? `Blackout — DO NOT enter. Earnings in ${earnDays}d.`
        : earnDays <= 20
          ? `Earnings in ${earnDays}d. Must be out by day ${earnDays - 8} latest.`
          : 'Clear runway — no earnings pressure this week or next.',
    },
    {
      key:    '52W Dist',
      val:    c.dist52wh != null ? `-${c.dist52wh.toFixed(1)}%` : '—',
      status: c.dist52wh == null ? 'neutral'
        : c.dist52wh >= 3 && c.dist52wh <= 12 ? 'ok' : 'warn',
      tooltip: c.dist52wh == null ? 'No 52W high data.'
        : c.dist52wh < 3
          ? 'Too close to 52W high — potential ATH chase.'
          : c.dist52wh <= 12
            ? 'Sweet spot — room for momentum leg without being over-extended.'
            : 'Further below 52W high — check daily for base structure quality.',
    },
    {
      key:    '1W Chg',
      val:    c.chg1w != null ? `${c.chg1w > 0 ? '+' : ''}${c.chg1w.toFixed(1)}%` : '—',
      status: c.chg1w == null ? 'neutral'
        : c.chg1w > 20 ? 'fail'
        : c.chg1w > 0 ? 'ok'
        : 'warn',
      tooltip: c.chg1w == null ? 'No weekly change data.'
        : c.chg1w > 20
          ? 'Weekly spike >20% — blow-off risk. Skip.'
          : c.chg1w > 5
            ? 'Strong weekly momentum — confirm not extended on daily.'
            : c.chg1w > 0
              ? 'Constructive weekly move — healthy momentum building.'
              : 'Negative weekly change — watch for further weakness.',
    },
  ]
}

function StatusIcon({ status }: { status: Signal['status'] }) {
  if (status === 'ok')   return <span className="text-gain text-xs">✓</span>
  if (status === 'warn') return <span className="text-warn text-xs">⚠</span>
  if (status === 'fail') return <span className="text-loss text-xs">✗</span>
  return <span className="text-text-muted text-xs">·</span>
}

const CHIP_COLOR: Record<Signal['status'], { color: string; border: string; bg: string }> = {
  ok:      { color: 'var(--green)', border: 'rgba(0,214,124,0.28)',  bg: 'rgba(0,214,124,0.07)'  },
  warn:    { color: 'var(--amber)', border: 'rgba(245,166,35,0.28)', bg: 'rgba(245,166,35,0.07)' },
  fail:    { color: 'var(--red)',   border: 'rgba(255,77,109,0.28)', bg: 'rgba(255,77,109,0.07)' },
  neutral: { color: 'var(--text2)', border: 'var(--border)',         bg: 'var(--bg3)'            },
}

const VERDICT_COLOR = {
  ENTER: { main: 'var(--green)', dim: 'rgba(0,214,124,0.08)',   border: 'rgba(0,214,124,0.22)',   badge: 'bg-gain/15 text-gain border-gain/25'  },
  WAIT:  { main: 'var(--amber)', dim: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.22)',  badge: 'bg-warn/15 text-warn border-warn/25'  },
  SKIP:  { main: 'var(--red)',   dim: 'rgba(255,77,109,0.08)',  border: 'rgba(255,77,109,0.22)',  badge: 'bg-loss/15 text-loss border-loss/25'  },
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
              <th className="w-8 text-center">#</th>
              <th>Ticker</th>
              <th className="text-right">Price</th>
              <th className="text-right">RSI</th>
              <th className="text-right">EMA Gap</th>
              <th className="text-right">52W Dist</th>
              <th>Earnings</th>
              <th>Sector</th>
              <th className="text-center">Signal</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(c => {
              const emaGap     = calcEmaGap(c.ema20, c.ema50)
              const earnDays   = daysUntilEarnings(c.earningsDate)
              const isExpanded = expandedId === c.id
              const verdict    = calcVerdict(c)
              const isInactive = ['INVALIDATED', 'EXPIRED', 'ARCHIVED'].includes(c.candidateState)

              const rsiColor    = c.rsi != null
                ? (c.rsi < 50 ? 'text-warn' : c.rsi < 65 ? 'text-gain' : 'text-text-secondary')
                : 'text-text-muted'
              const emaGapColor = emaGap < 1 ? 'text-warn' : emaGap > 8 ? 'text-warn' : 'text-gain'
              const vc          = VERDICT_COLOR[verdict.v]

              return (
                <>
                  <tr
                    key={c.id}
                    className={`cursor-pointer transition-colors hover:bg-white/[0.025] ${isInactive ? 'opacity-40' : ''} ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <td className="text-center">
                      <span className="text-xxs font-mono text-text-muted">{c.rank ?? '—'}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-ticker text-sm tracking-wide">{c.sym}</span>
                        {c.rank != null && c.rank <= 3 && (
                          <span className="text-xxs font-mono bg-warn/10 text-warn border border-warn/20 px-1.5 py-0.5 rounded-md leading-none">TOP</span>
                        )}
                        {c.candidateState === 'SETUP_CONFIRMED' && (
                          <span className="text-xxs font-mono bg-gain/10 text-gain border border-gain/20 px-1.5 py-0.5 rounded-md leading-none">✓</span>
                        )}
                        {c.candidateState === 'TRADED' && (
                          <span className="text-xxs font-mono bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded-md leading-none">T</span>
                        )}
                      </div>
                      {c.description && (
                        <div className="text-xxs text-text-muted truncate max-w-[150px] mt-0.5 leading-none">{c.description}</div>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="font-mono tabular text-sm">${c.price.toFixed(2)}</span>
                    </td>
                    <td className="text-right">
                      {c.rsi != null
                        ? <span className={`font-mono tabular text-sm font-semibold ${rsiColor}`}>{c.rsi.toFixed(1)}</span>
                        : <span className="text-text-muted text-sm">—</span>}
                    </td>
                    <td className="text-right">
                      {c.ema20 != null && c.ema50 != null
                        ? <span className={`font-mono tabular text-sm font-semibold ${emaGapColor}`}>{emaGap.toFixed(1)}%</span>
                        : <span className="text-text-muted text-sm">—</span>}
                    </td>
                    <td className="text-right">
                      {c.dist52wh != null
                        ? <span className="font-mono tabular text-sm text-text-secondary">-{c.dist52wh.toFixed(1)}%</span>
                        : <span className="text-text-muted text-sm">—</span>}
                    </td>
                    <td>
                      {c.earningsDate ? (
                        <span className={`text-xs font-mono ${
                          earnDays <= 10 ? 'text-loss font-bold' :
                          earnDays <= 20 ? 'text-warn' : 'text-text-muted'
                        }`}>
                          {earnDays <= 10 && '⚠ '}
                          {new Date(c.earningsDate).toLocaleDateString('en-NL', {
                            month: 'short', day: 'numeric', timeZone: 'Europe/Amsterdam'
                          })}
                          {earnDays < 999 && ` · ${earnDays}d`}
                        </span>
                      ) : (
                        <span className="text-gain text-xs font-mono">Clear</span>
                      )}
                    </td>
                    <td>
                      <span className="text-xxs text-text-muted truncate max-w-[90px] block">{c.sector ?? '—'}</span>
                    </td>
                    <td className="text-center">
                      <span className={`text-xxs font-mono font-bold px-2.5 py-1 rounded-md border ${vc.badge}`}>
                        {verdict.v}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-text-muted text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${c.id}-exp`}>
                      <td colSpan={10} className="p-0">
                        <VerdictPanel
                          candidate={c}
                          onStateChange={state => updateState.mutate({ id: c.id, state })}
                          isPending={updateState.isPending}
                        />
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

function VerdictPanel({
  candidate, onStateChange, isPending,
}: {
  candidate:     Candidate
  onStateChange: (state: string) => void
  isPending:     boolean
}) {
  const c       = candidate
  const verdict = calcVerdict(c)
  const levels  = calcLevels(c)
  const signals = buildSignals(c)
  const vc      = VERDICT_COLOR[verdict.v]

  const tile: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 20,
    flex: '1 1 0',
  }
  const tileLabel: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: 12,
  }
  const tileVal: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '1.85rem',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1,
  }
  const tileSub: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    color: 'var(--text2)',
    marginTop: 6,
  }
  const tileNote: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    color: 'var(--text3)',
    marginTop: 12,
    lineHeight: 1.4,
  }

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.012)' }}>

      {/* ── Verdict banner ── */}
      <div style={{ background: vc.dim, border: `1px solid ${vc.border}`, borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3.5rem', fontWeight: 900, color: vc.main, letterSpacing: '0.08em', lineHeight: 1, flexShrink: 0 }}>
          {verdict.v}
        </div>
        <div style={{ width: 1, height: 64, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: vc.main, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 7, opacity: 0.85 }}>
            {verdict.label}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.65 }}>
            {verdict.text}
          </div>
        </div>
      </div>

      {/* ── 4 level tiles ── */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Entry */}
        <div style={tile}>
          <div style={tileLabel}>Entry Zone</div>
          <div style={tileVal}>${levels.entryLow.toFixed(2)}</div>
          <div style={tileSub}>– ${levels.entryHigh.toFixed(2)}</div>
          <div style={tileNote}>1H EMA retest — confirm on chart</div>
        </div>

        {/* Stop */}
        <div style={{ ...tile, border: '1px solid rgba(255,77,109,0.2)' }}>
          <div style={tileLabel}>Stop</div>
          <div style={{ ...tileVal, color: 'var(--red)' }}>${levels.stop.toFixed(2)}</div>
          <div style={{ ...tileSub, color: 'rgba(255,77,109,0.5)' }}>-{levels.stopPct.toFixed(1)}% from entry</div>
          <div style={tileNote}>Structure-based, not fixed %</div>
        </div>

        {/* Targets */}
        <div style={{ ...tile, border: '1px solid rgba(0,214,124,0.2)' }}>
          <div style={tileLabel}>Targets</div>
          <div style={{ ...tileVal, color: 'var(--green)' }}>T1 ${levels.t1.toFixed(2)}</div>
          <div style={{ ...tileSub, color: 'rgba(0,214,124,0.55)' }}>T2 ${levels.t2.toFixed(2)}</div>
          <div style={tileNote}>Take 50–60% at T1, trail rest</div>
        </div>

        {/* Position / Risk */}
        <div style={{ ...tile, border: levels.rr < 2 ? '1px solid rgba(255,77,109,0.2)' : '1px solid var(--border)' }}>
          <div style={tileLabel}>Position / Risk</div>
          <div style={tileVal}>€{Math.round(levels.posEur)}</div>
          <div style={tileSub}>~{levels.shares} shares</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, marginTop: 12, color: levels.rr < 2 ? 'var(--red)' : 'var(--green)' }}>
            R:R {levels.rr.toFixed(1)}:1{levels.rr < 2 ? ' ⚠' : ''}
          </div>
        </div>
      </div>

      {/* ── Signal chips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {signals.map(s => {
          const cc = CHIP_COLOR[s.status]
          return (
            <div
              key={s.key}
              title={s.tooltip}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999, border: `1px solid ${cc.border}`, background: cc.bg, color: cc.color, fontFamily: 'var(--font-mono)', fontSize: '0.78rem', cursor: 'help', whiteSpace: 'nowrap' }}
            >
              <span style={{ fontSize: '0.7rem' }}>
                {s.status === 'ok' ? '✓' : s.status === 'warn' ? '⚠' : s.status === 'fail' ? '✗' : '·'}
              </span>
              <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.65 }}>{s.key}</span>
              <span style={{ fontWeight: 600 }}>{s.val}</span>
            </div>
          )
        })}
      </div>

      {/* ── State buttons ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginRight: 4 }}>Mark as:</span>
        {(['SETUP_CONFIRMED', 'INVALIDATED', 'TRADED', 'CANDIDATE'] as const).map(state => (
          <button
            key={state}
            disabled={isPending}
            onClick={e => { e.stopPropagation(); onStateChange(state) }}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
              border: c.candidateState === state ? '1px solid rgba(77,159,255,0.5)' : '1px solid var(--border2)',
              background: c.candidateState === state ? 'rgba(77,159,255,0.15)' : 'rgba(255,255,255,0.06)',
              color: c.candidateState === state ? 'var(--blue)' : 'var(--text)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            {state.replace('_', ' ')}
          </button>
        ))}
        {isPending && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginLeft: 4 }}>Saving…</span>}
      </div>
    </div>
  )
}
