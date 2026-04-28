'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

const DAYS = [1, 2, 3, 4, 5]

interface Session {
  id:         string
  filename:   string
  uploadedAt: string
  totalRows:  number
  passedRows: number
}

interface Candidate {
  id:       string
  sym:      string
  price:    number
  rank?:    number | null
  sector?:  string | null
  rsi?:     number | null
  dist52wh?: number | null
  candidateState: string
}

interface Snapshot {
  candidateId:   string
  snapshotDay:   number
  closePrice:    number
  pctFromScreen: number
}

function pctColor(pct: number): string {
  if (pct >= 5)   return 'var(--green)'
  if (pct >= 1)   return 'rgba(0,214,124,0.7)'
  if (pct >= 0)   return 'var(--text2)'
  if (pct >= -1)  return 'rgba(255,77,109,0.7)'
  return 'var(--red)'
}

// ── Cell editor ───────────────────────────────────────────────────────────────

function SnapshotCell({
  candidateId, snapshotDay, screenPrice, snapshot, sessionId,
}: {
  candidateId:  string
  snapshotDay:  number
  screenPrice:  number
  snapshot?:    Snapshot
  sessionId:    string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const qc                    = useQueryClient()

  const save = useMutation({
    mutationFn: (closePrice: number) =>
      fetch('/api/snapshots', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ candidateId, snapshotDay, closePrice, screenPrice }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots', sessionId] })
      setEditing(false)
      setVal('')
    },
  })

  const clear = useMutation({
    mutationFn: () =>
      fetch(`/api/snapshots?candidateId=${candidateId}&snapshotDay=${snapshotDay}`, {
        method: 'DELETE',
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snapshots', sessionId] }),
  })

  if (editing) {
    return (
      <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <input
          autoFocus
          type="number"
          step="0.01"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && val) save.mutate(parseFloat(val))
            if (e.key === 'Escape') { setEditing(false); setVal('') }
          }}
          style={{
            width: 72, background: 'var(--bg3)', border: '1px solid var(--blue)',
            borderRadius: 5, padding: '4px 6px', fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem', color: 'var(--text)', outline: 'none',
          }}
          placeholder="price"
        />
      </td>
    )
  }

  if (snapshot) {
    const pct = snapshot.pctFromScreen
    return (
      <td
        title="Click to edit · Right-click to clear"
        onClick={() => { setVal(snapshot.closePrice.toFixed(2)); setEditing(true) }}
        onContextMenu={e => { e.preventDefault(); clear.mutate() }}
        style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'right' }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: pctColor(pct), fontVariantNumeric: 'tabular-nums' }}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 1 }}>
          ${snapshot.closePrice.toFixed(2)}
        </div>
      </td>
    )
  }

  return (
    <td
      onClick={() => setEditing(true)}
      title="Click to enter close price"
      style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'right' }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text3)', opacity: 0.4 }}>—</span>
    </td>
  )
}

// ── Performance grid ──────────────────────────────────────────────────────────

function PerformanceGrid({ sessionId }: { sessionId: string }) {
  const { data: candData } = useQuery({
    queryKey: ['candidates', sessionId],
    queryFn:  () => fetch(`/api/candidates?sessionId=${sessionId}`).then(r => r.json()),
  })

  const { data: snapData } = useQuery({
    queryKey: ['snapshots', sessionId],
    queryFn:  () => fetch(`/api/snapshots?sessionId=${sessionId}`).then(r => r.json()),
  })

  const candidates: Candidate[] = candData?.candidates ?? []
  const snapshots:  Snapshot[]  = snapData?.snapshots  ?? []

  const snapMap = new Map<string, Snapshot>()
  for (const s of snapshots) snapMap.set(`${s.candidateId}-${s.snapshotDay}`, s)

  if (candidates.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text3)' }}>No candidates in this session</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', padding: '8px 16px 4px', letterSpacing: '0.08em' }}>
        Click any — cell to enter close price · Right-click a filled cell to clear
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Ticker</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Screened $</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Sector</th>
            {DAYS.map(d => (
              <th key={d} style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}>D+{d}</th>
            ))}
            <th style={{ ...thStyle, textAlign: 'right' }}>Best day</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map(c => {
            const daySnaps = DAYS.map(d => snapMap.get(`${c.id}-${d}`))
            const filled   = daySnaps.filter(Boolean) as Snapshot[]
            const best     = filled.length > 0 ? filled.reduce((a, b) => a.pctFromScreen > b.pctFromScreen ? a : b) : null

            return (
              <tr key={c.id} style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={tdStyle}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }}>{c.rank ?? '—'}</span>
                </td>
                <td style={tdStyle}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--blue)' }}>{c.sym}</div>
                  {c.rsi != null && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', marginTop: 1 }}>RSI {c.rsi.toFixed(0)}</div>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${c.price.toFixed(2)}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', maxWidth: 90, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sector ?? '—'}</span>
                </td>
                {DAYS.map(d => (
                  <SnapshotCell
                    key={d}
                    candidateId={c.id}
                    snapshotDay={d}
                    screenPrice={c.price}
                    snapshot={snapMap.get(`${c.id}-${d}`)}
                    sessionId={sessionId}
                  />
                ))}
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {best ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: pctColor(best.pctFromScreen), fontVariantNumeric: 'tabular-nums' }}>
                      {best.pctFromScreen >= 0 ? '+' : ''}{best.pctFromScreen.toFixed(1)}% D+{best.snapshotDay}
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text3)', opacity: 0.4 }}>—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', fontSize: '0.6rem', fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--text3)', padding: '0 8px 10px',
  borderBottom: '1px solid var(--border)',
  fontFamily: 'var(--font-mono)',
}
const tdStyle: React.CSSProperties = {
  padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab]               = useState<'screener' | 'performance'>('performance')

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn:  () => fetch('/api/screen/sessions?limit=30').then(r => r.json()),
  })

  const { data: candidatesData } = useQuery({
    queryKey: ['candidates', selectedId],
    queryFn:  () => fetch(`/api/candidates?sessionId=${selectedId}`).then(r => r.json()),
    enabled:  !!selectedId && tab === 'screener',
  })

  const sessions: Session[] = sessionsData?.sessions ?? []

  return (
    <div style={{ padding: 24, maxWidth: 1400, display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>Screen History</h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text3)', marginTop: 2 }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} on record
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>

        {/* ── Session list ── */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Sessions</h2>
          </div>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {sessions.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text3)' }}>No sessions yet</p>
              </div>
            ) : sessions.map(s => {
              const active = selectedId === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 16px',
                    background: active ? 'rgba(77,159,255,0.08)' : 'transparent',
                    borderLeft: active ? '2px solid var(--blue)' : '2px solid transparent',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: active ? 'var(--blue)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                      {s.filename}
                    </p>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--green)', fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>{s.passedRows}</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', marginTop: 3 }}>
                    {new Date(s.uploadedAt).toLocaleDateString('en-NL', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      timeZone: 'Europe/Amsterdam',
                    })} CET
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {!selectedId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text3)' }}>Select a session to view</p>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                {(['performance', 'screener'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                      fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: tab === t ? 'var(--blue)' : 'var(--text3)',
                      borderBottom: tab === t ? '2px solid var(--blue)' : '2px solid transparent',
                      background: 'none', border: 'none',
                      cursor: 'pointer', transition: 'color 0.15s',
                    }}
                  >
                    {t === 'performance' ? 'Week Performance' : 'Screener View'}
                  </button>
                ))}
              </div>

              {tab === 'performance' && <PerformanceGrid sessionId={selectedId} />}

              {tab === 'screener' && (
                <div style={{ padding: 16 }}>
                  {candidatesData?.candidates?.length > 0 ? (
                    <CandidatesTableLight candidates={candidatesData.candidates} />
                  ) : (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text3)', padding: 32, textAlign: 'center' }}>Loading…</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Lightweight read-only screener table ──────────────────────────────────────

function CandidatesTableLight({ candidates }: { candidates: Candidate[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['#', 'Ticker', 'Price', 'RSI', '52W Dist', 'Sector', 'State'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c: Candidate) => (
            <tr key={c.id}>
              <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }}>{c.rank ?? '—'}</span></td>
              <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--blue)' }}>{c.sym}</span></td>
              <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${c.price.toFixed(2)}</span></td>
              <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{c.rsi?.toFixed(1) ?? '—'}</span></td>
              <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{c.dist52wh != null ? `-${c.dist52wh.toFixed(1)}%` : '—'}</span></td>
              <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }}>{c.sector ?? '—'}</span></td>
              <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase' }}>{c.candidateState.replace('_', ' ')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
