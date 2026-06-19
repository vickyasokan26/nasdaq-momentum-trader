'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Props {
  weeklyHistory?: Array<{ pnlDate: string; netPnlEur: number }>
}

export function WeeklyPnlChart({ weeklyHistory }: Props) {
  const data = (weeklyHistory ?? [])
    .slice()
    .reverse()
    .map(d => ({
      date: new Date(d.pnlDate).toLocaleDateString('en-NL', { day: '2-digit', month: 'short', timeZone: 'Europe/Amsterdam' }),
      pnl:  d.netPnlEur,
    }))

  return (
    <div className="chart-card">
      <div className="chart-title">Daily P&amp;L — last 10 days</div>
      {data.length === 0 ? (
        <div className="chart-empty">No closed trading days yet — daily P&amp;L will show up here once trades close.</div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                cursor={{ fill: 'var(--bg3)' }}
                contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                labelStyle={{ color: 'var(--text2)' }}
                formatter={(value: number) => [`€${value.toFixed(2)}`, 'Net P&L']}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
