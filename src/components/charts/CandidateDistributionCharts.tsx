'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Candidate {
  sector?: string | null
  score:   number
}

const SECTOR_COLORS = ['var(--blue)', 'var(--green)', 'var(--amber)', 'var(--red)', 'rgba(77,159,255,0.5)', 'rgba(0,214,124,0.5)']

const tooltipStyle = {
  contentStyle: { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' },
  labelStyle:   { color: 'var(--text2)' },
  cursor:       { fill: 'var(--bg3)' },
}

const axisTick  = { fontSize: 10, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }

// recharts right-anchors category axis tick text against the axis line, so a label
// wider than the reserved axis `width` overflows leftward and gets clipped at the
// chart boundary — truncate instead of letting that happen. Full name is still in the tooltip.
function truncateLabel(value: string, maxLen = 14): string {
  return value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value
}

function SectorChart({ candidates }: { candidates: Candidate[] }) {
  const counts = new Map<string, number>()
  for (const c of candidates) {
    const sector = c.sector ?? 'Unknown'
    counts.set(sector, (counts.get(sector) ?? 0) + 1)
  }
  const data = [...counts.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return (
    <div className="chart-card">
      <div className="chart-title">Sector distribution</div>
      {data.length === 0 ? (
        <div className="chart-empty">No candidates yet.</div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category" dataKey="sector" tick={axisTick} axisLine={false} tickLine={false}
                width={110} tickFormatter={(value: string) => truncateLabel(value)}
              />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [value, 'Candidates']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function ScoreChart({ candidates }: { candidates: Candidate[] }) {
  const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80]
  const data = buckets.slice(0, -1).map((lo, i) => {
    const hi = buckets[i + 1]
    return {
      range: `${lo}-${hi}`,
      count: candidates.filter(c => c.score >= lo && c.score < hi).length,
    }
  })

  return (
    <div className="chart-card">
      <div className="chart-title">Score distribution</div>
      {candidates.length === 0 ? (
        <div className="chart-empty">No candidates yet.</div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="range" tick={axisTick} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [value, 'Candidates']} labelFormatter={(l) => `Score ${l}`} />
              <Bar dataKey="count" fill="var(--blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function CandidateDistributionCharts({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="chart-grid-2">
      <SectorChart candidates={candidates} />
      <ScoreChart candidates={candidates} />
    </div>
  )
}
