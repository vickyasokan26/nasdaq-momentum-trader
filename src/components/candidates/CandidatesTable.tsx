'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
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

const STATE_COLORS: Record<string, string> = {
  CANDIDATE:       'text-text-secondary',
  SETUP_CONFIRMED: 'text-gain',
  INVALIDATED:     'text-loss line-through opacity-50',
  TRADED:          'text-accent',
  EXPIRED:         'text-text-muted opacity-50',
  ARCHIVED:        'text-text-muted opacity-30',
}

// ── Verdict engine — mirrors the HTML prototype logic ──────────────────────

interface VerdictResult {
  v:     'ENTER' | 'WAIT' | 'SKIP'
  label: string
  text:  string
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

function calcVerdict(c: Candidate): VerdictResult {
  const emaGap  = calcEmaGap(c.ema20, c.ema50)
  const rsi     = c.rsi ?? 0
  const earnDays = daysUntilEarnings(c.earningsDate)

  if (c.price > 100 && (c.relVol ?? 0) < 0.8)
    return { v: 'SKIP', label: 'Skip — account size constraint',
      text: `At $${c.price.toFixed(2)}/share, position sizing is very tight at €700. Monitor for account scaling to €1,000+.` }

  if (emaGap < 0.5)
    return { v: 'WAIT', label: 'Wait — EMA gap too thin',
      text: `EMA gap only ${emaGap.toFixed(1)}%. EMAs compressing — momentum is stalling. Wait for gap to expand before looking for a 1H entry.` }

  if (earnDays >= 0 && earnDays <= 10)
    return { v: 'SKIP', label: 'Skip — inside earnings blackout',
      text: `Earnings in ${earnDays} days. Inside 10-day blackout window. Do not enter — pre-earnings pump risk is too high.` }

  if (earnDays >= 11 && earnDays < 20)
    return { v: 'WAIT', label: 'Wait — earnings approaching',
      text: `Earnings in ${earnDays} days. Plan any entry carefully — must be fully out by day ${earnDays - 8} latest.` }

  if (rsi > 65)
    return { v: 'WAIT', label: 'Wait — RSI elevated on daily',
      text: `Daily RSI ${rsi.toFixed(1)} is warm. Wait for a 1H pullback to cool RSI below 60 before entry. Do not chase.` }

  if (rsi < 52 && emaGap > 2)
    return { v: 'ENTER', label: 'Enter on 1H confirmation',
      text: `RSI ${rsi.toFixed(1)} mid-pullback with clean EMA structure (gap ${emaGap.toFixed(1)}%). Drop to 1H — wait for EMA 20/50 retest that holds, RSI 45–65 and above its 9MA, and last 3 x 1H candles above average volume.` }

  return { v: 'ENTER', label: 'Enter on 1H confirmation',
    text: `Clean daily setup. Drop to 1H — wait for EMA 20/50 retest that holds, RSI 45–65 and above its 9MA, and last 3 x 1H candles above average volume.` }
}

// ── Level estimates (indicative — use structure on actual chart) ──────────

interface Levels {
  entryLow:  number
  entryHigh: number
  stop:      number
  t1:        number
  t2:        number
  rr:        number
  posEur:    number
  shares:    number
}

function calcLevels(c: Candidate): Levels {
  const emaGap  = calcEmaGap(c.ema20, c.ema50)
  const sd      = Math.max(0.025, Math.min(0.055, 0.03 + (emaGap / 100)))
  const entryLow  = c.price * 0.985
  const entryHigh = c.price * 0.997
  const stop    = entryLow * (1 - sd)
  const t1      = c.price * (1 + sd * 2.5)
  const t2      = c.price * (1 + sd * 4)
  const rr      = (t1 - entryLow) / (entryLow - stop)
  const posEur  = Math.min(12 / sd, 595)
  const shares  = Math.floor((posEur * 1.09) / c.price)
  return { entryLow, entryHigh, stop, t1, t2, rr, posEur, shares }
}

// ── Signal checklist ──────────────────────────────────────────────────────

interface Signal {
  key:   string
  val:   string
  color: string
  note:  string
}

function buildSignals(c: Candidate): Signal[] {
  const emaGap   = calcEmaGap(c.ema20, c.ema50)
  const earnDays = daysUntilEarnings(c.earningsDate)
  const earnLabel = earnDays < 999
    ? `${c.earningsRaw ?? c.earningsDate} · ${earnDays}d`
    : 'No upcoming date'

  return [
    {
      key:   'EMA 20/50 gap · Daily',
      val:   `${emaGap.toFixed(1)}%`,
      color: emaGap < 1 ? 'text-warn' : emaGap > 8 ? 'text-warn' : 'text-gain',
      note:  emaGap < 1
        ? 'Too thin — EMAs compressing. Wait for gap to expand before 1H entry.'
        : emaGap > 8
          ? 'Extended — enter only on deep 1H pullback to 50 EMA, not 20 EMA.'
          : 'Daily trend confirmed. Drop to 1H and wait for EMA retest.',
    },
    {
      key:   'RSI(14) · Daily',
      val:   c.rsi != null ? c.rsi.toFixed(1) : '—',
      color: c.rsi == null ? 'text-text-muted'
        : c.rsi < 52 ? 'text-gain'
        : c.rsi < 65 ? 'text-gain'
        : 'text-warn',
      note: c.rsi == null ? 'No RSI data.'
        : c.rsi < 52
          ? 'Mid-pullback — most room to run. Still need 1H RSI 45–65 and above its 9MA at entry.'
          : c.rsi < 65
            ? 'Mid-range — valid. Confirm 1H RSI 45–65 and rising at entry.'
            : 'Warm — wait for 1H pullback. Do not enter when 1H RSI is also above 65.',
    },
    {
      key:   'Relative volume · Daily',
      val:   c.relVol != null ? `${c.relVol.toFixed(2)}×` : '—',
      color: c.relVol == null ? 'text-text-muted'
        : c.relVol >= 1.2 ? 'text-gain'
        : c.relVol >= 0.8 ? 'text-text-secondary'
        : 'text-loss',
      note: c.relVol == null ? 'No volume data.'
        : c.relVol >= 1.2
          ? 'Above average. Still check avg of last 3 × 1H candles at entry moment.'
          : c.relVol >= 0.8
            ? 'Borderline. 1H volume confirmation required — avg of last 3 × 1H candles above 10D avg hourly.'
            : 'Weak daily volume. Avg of last 3 × 1H candles must clearly exceed 10D average hourly volume.',
    },
    {
      key:   'Earnings date',
      val:   earnLabel,
      color: earnDays <= 10 ? 'text-loss'
        : earnDays <= 20 ? 'text-warn'
        : 'text-gain',
      note: earnDays <= 10
        ? `⚠ Inside blackout window — DO NOT enter. Earnings in ${earnDays} days.`
        : earnDays <= 20
          ? `Earnings in ${earnDays} days. Must be fully out by day ${earnDays - 8} latest.`
          : 'Clear runway — no earnings pressure this week or next.',
    },
    {
      key:   'Dist from 52W high',
      val:   c.dist52wh != null ? `-${c.dist52wh.toFixed(1)}%` : '—',
      color: c.dist52wh == null ? 'text-text-muted'
        : c.dist52wh >= 3 && c.dist52wh <= 12 ? 'text-gain'
        : 'text-warn',
      note: c.dist52wh == null ? 'No 52W high data.'
        : c.dist52wh < 3
          ? 'Too close to 52W high — potential ATH chase. Confirm breakout is genuine.'
          : c.dist52wh <= 12
            ? 'Sweet spot — enough room for momentum leg without being over-extended.'
            : 'Further below 52W high — check daily chart for base structure quality.',
    },
    {
      key:   '1W change',
      val:   c.chg1w != null ? `${c.chg1w > 0 ? '+' : ''}${c.chg1w.toFixed(1)}%` : '—',
      color: c.chg1w == null ? 'text-text-muted'
        : c.chg1w > 20 ? 'text-loss'
        : c.chg1w > 0 ? 'text-gain'
        : 'text-warn',
      note: c.chg1w == null ? 'No weekly change data.'
        : c.chg1w > 20
          ? '⚠ Weekly spike above 20% — blow-off risk. This should have been filtered. Skip.'
          : c.chg1w > 5
            ? 'Strong weekly momentum — confirm it is not an extended blow-off on the daily chart.'
            : c.chg1w > 0
              ? 'Constructive weekly move — healthy momentum building.'
              : 'Negative weekly change — daily trend still intact but watch for further weakness.',
    },
  ]
}

// ── Main component ────────────────────────────────────────────────────────

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
              <th>EMA Stack</th>
              <th>RelVol</th>
              <th>Dist 52W</th>
              <th>1W Chg</th>
              <th>Sector</th>
              <th>Earnings</th>
              <th>Score</th>
              <th>Signal</th>
              <th>State</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(c => {
              const emaStack   = c.ema20 != null && c.ema50 != null && c.ema20 > c.ema50
              const rsiColor   = c.rsi != null ? (c.rsi < 50 ? 'text-warn' : c.rsi < 65 ? 'text-gain' : 'text-text-secondary') : ''
              const chgColor   = c.chg1w != null ? (c.chg1w > 0 ? 'text-gain' : 'text-loss') : ''
              const isExpanded = expandedId === c.id
              const verdict    = calcVerdict(c)
              const earnDays   = daysUntilEarnings(c.earningsDate)

              const verdictBg = verdict.v === 'ENTER'
                ? 'bg-gain/10 text-gain border-gain/20'
                : verdict.v === 'WAIT'
                  ? 'bg-warn/10 text-warn border-warn/20'
                  : 'bg-loss/10 text-loss border-loss/20'

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
                        : <span className="text-text-muted">—</span>}
                    </td>

                    {/* EMA stack */}
                    <td>
                      {c.ema20 != null && c.ema50 != null ? (
                        <span className={`text-xs font-mono ${emaStack ? 'text-gain' : 'text-loss'}`}>
                          {emaStack ? '↑ Stack' : '↓ Cross'}
                        </span>
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
                      {c.dist52wh != null
                        ? <span className="font-mono tabular text-sm text-text-secondary">-{c.dist52wh.toFixed(1)}%</span>
                        : <span className="text-text-muted">—</span>}
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
                        : <span className="text-text-muted">—</span>}
                    </td>

                    {/* Earnings — colour-coded warning */}
                    <td>
                      {c.earningsDate ? (
                        <span className={`text-xs font-mono ${
                          earnDays <= 10 ? 'text-loss font-semibold' :
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

                    {/* Signal badge */}
                    <td>
                      <span className={`text-xxs font-mono font-semibold px-2 py-0.5 rounded border ${verdictBg}`}>
                        {verdict.v}
                      </span>
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

                  {/* ── Expanded verdict panel ── */}
                  {isExpanded && (
                    <tr key={`${c.id}-exp`} className="bg-desk-raised/30">
                      <td colSpan={14} className="px-5 py-4">
                        <VerdictPanel candidate={c} onStateChange={(state) => {
                          updateState.mutate({ id: c.id, state })
                        }} isPending={updateState.isPending} />
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

// ── Verdict panel component ───────────────────────────────────────────────

function VerdictPanel({
  candidate,
  onStateChange,
  isPending,
}: {
  candidate:     Candidate
  onStateChange: (state: string) => void
  isPending:     boolean
}) {
  const c       = candidate
  const verdict = calcVerdict(c)
  const levels  = calcLevels(c)
  const signals = buildSignals(c)

  const verdictStyles = {
    ENTER: { border: 'border-gain/30', bg: 'bg-gain/5',  label: 'text-gain',  bar: 'bg-gain' },
    WAIT:  { border: 'border-warn/30', bg: 'bg-warn/5',  label: 'text-warn',  bar: 'bg-warn' },
    SKIP:  { border: 'border-loss/30', bg: 'bg-loss/5',  label: 'text-loss',  bar: 'bg-loss' },
  }[verdict.v]

  return (
    <div className="space-y-4">

      {/* ── Levels row ── */}
      <div className="grid grid-cols-3 gap-3">
        <LevelTile
          label="Entry zone (indicative)"
          value={`$${levels.entryLow.toFixed(2)} – $${levels.entryHigh.toFixed(2)}`}
          sub="1H EMA 20/50 retest zone — confirm on chart"
        />
        <LevelTile
          label="Stop · T1 · T2 (indicative)"
          value={`$${levels.stop.toFixed(2)}`}
          valueColor="text-loss"
          sub={`T1: $${levels.t1.toFixed(2)}   T2: $${levels.t2.toFixed(2)}`}
          subColor="text-gain"
        />
        <LevelTile
          label="Size · Risk · R:R"
          value={`€${Math.round(levels.posEur)} · ~${levels.shares} shares`}
          sub={`Risk €12 · R:R ${levels.rr.toFixed(1)}:1 ${levels.rr < 2 ? '⚠ below 2:1 minimum' : ''}`}
          subColor={levels.rr < 2 ? 'text-loss' : 'text-warn'}
        />
      </div>

      {/* ── Signal checklist ── */}
      <div className="grid grid-cols-3 gap-2">
        {signals.map(s => (
          <div key={s.key} className="bg-desk-surface border border-desk-border rounded-lg p-3">
            <div className="text-xxs text-text-muted uppercase tracking-wider font-mono mb-1">{s.key}</div>
            <div className={`font-mono text-sm font-semibold mb-1 ${s.color}`}>{s.val}</div>
            <div className="text-xxs text-text-muted leading-relaxed">{s.note}</div>
          </div>
        ))}
      </div>

      {/* ── Verdict block ── */}
      <div className={`rounded-lg border-l-4 p-3 ${verdictStyles.border} ${verdictStyles.bg}`}>
        <div className={`text-xxs font-mono font-semibold uppercase tracking-widest mb-1 ${verdictStyles.label}`}>
          {verdict.label}
        </div>
        <div className="text-xs text-text-secondary leading-relaxed">{verdict.text}</div>
      </div>

      {/* ── State actions ── */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className="text-xxs font-mono text-text-muted mr-1">Mark as:</span>
        {(['SETUP_CONFIRMED', 'INVALIDATED', 'TRADED', 'CANDIDATE'] as const).map(state => (
          <button
            key={state}
            disabled={isPending}
            onClick={e => { e.stopPropagation(); onStateChange(state) }}
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
    </div>
  )
}

function LevelTile({
  label, value, valueColor = 'text-text-primary',
  sub, subColor = 'text-text-muted',
}: {
  label:       string
  value:       string
  valueColor?: string
  sub:         string
  subColor?:   string
}) {
  return (
    <div className="bg-desk-surface border border-desk-border rounded-lg p-3">
      <div className="text-xxs text-text-muted uppercase tracking-wider font-mono mb-2">{label}</div>
      <div className={`font-mono text-sm font-semibold ${valueColor}`}>{value}</div>
      <div className={`font-mono text-xxs mt-1 ${subColor}`}>{sub}</div>
    </div>
  )
}
