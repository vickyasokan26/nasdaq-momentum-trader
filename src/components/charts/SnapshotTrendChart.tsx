'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Candidate {
  id:    string
  sym:   string
  rank?: number | null
}

interface Snapshot {
  candidateId:   string
  snapshotDay:   number
  pctFromScreen: number
}

const DAYS = [1, 2, 3, 4, 5]
const LINE_COLORS = ['var(--blue)', 'var(--green)', 'var(--amber)', 'var(--red)', 'rgba(77,159,255,0.6)']

export function SnapshotTrendChart({ candidates, snapshots }: { candidates: Candidate[]; snapshots: Snapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-title">D+1…D+5 % from screen price</div>
        <div className="chart-empty">
          No close prices logged yet for this session — click a — cell in the grid below to
          start tracking how these picks actually performed.
        </div>
      </div>
    )
  }

  const top = candidates
    .slice()
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    .slice(0, 5)

  const snapMap = new Map<string, Snapshot>()
  for (const s of snapshots) snapMap.set(`${s.candidateId}-${s.snapshotDay}`, s)

  const data = DAYS.map(day => {
    const row: Record<string, number | string> = { day: `D+${day}` }
    for (const c of top) {
      const snap = snapMap.get(`${c.id}-${day}`)
      if (snap) row[c.sym] = snap.pctFromScreen
    }
    return row
  })

  return (
    <div className="chart-card">
      <div className="chart-title">D+1…D+5 % from screen price — top {top.length} by rank</div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={40} unit="%" />
            <Tooltip
              contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
              labelStyle={{ color: 'var(--text2)' }}
              formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }} />
            {top.map((c, i) => (
              <Line
                key={c.id}
                type="monotone"
                dataKey={c.sym}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
