'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GroupStat, RuleBreakStat } from '@/features/insights/analyze'

const tooltipStyle = {
  contentStyle: { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' },
  labelStyle:   { color: 'var(--text2)' },
  cursor:       { fill: 'var(--bg3)' },
}
const axisTick = { fontSize: 10, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }

// recharts right-anchors category axis tick text against the axis line, so a label
// wider than the reserved axis `width` overflows leftward and gets clipped rather
// than wrapped — truncate defensively. Full name is still in the tooltip.
function truncateLabel(value: string, maxLen = 16): string {
  return value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value
}

export function GroupPnlChart({ title, data, valueKey, unit }: {
  title:    string
  data:     GroupStat[]
  valueKey: 'avgPnlEur' | 'avgPct'
  unit:     string
}) {
  const rows = data.map(d => ({ group: d.group, value: d[valueKey] ?? 0, count: d.count }))

  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {rows.length === 0 ? (
        <div className="chart-empty">Not enough closed data yet.</div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="group" tick={axisTick} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
              <Tooltip {...tooltipStyle} formatter={(value: number, _name, item) => [`${unit === '€' ? '€' : ''}${value.toFixed(1)}${unit === '%' ? '%' : ''}`, `n=${item.payload.count}`]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {rows.map((r, i) => <Cell key={i} fill={r.value >= 0 ? 'var(--green)' : 'var(--red)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function RuleBreakChart({ data }: { data: RuleBreakStat[] }) {
  return (
    <div className="chart-card">
      <div className="chart-title">Rule breaks at entry — frequency &amp; avg outcome</div>
      {data.length === 0 ? (
        <div className="chart-empty">No rule breaks recorded — clean entries so far.</div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category" dataKey="rule" tick={{ ...axisTick, fontSize: 9 }} axisLine={false} tickLine={false}
                width={130} tickFormatter={(value: string) => truncateLabel(value)}
              />
              <Tooltip {...tooltipStyle} formatter={(value: number, _name, item) => [value, `avg €${item.payload.avgPnlEur.toFixed(1)}`]} />
              <Bar dataKey="count" fill="var(--amber)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
