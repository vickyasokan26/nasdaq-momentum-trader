'use client'

import { useEffect, useState } from 'react'
import { getTradingWindow, formatUserTime, type TradingWindow } from '@/lib/timezone'

const WINDOW_CONFIG: Record<TradingWindow, { label: string; color: string; dot: string }> = {
  pre_market:          { label: 'Pre-Market',        color: 'text-text-muted border-desk-border',        dot: 'bg-text-muted' },
  opening_prohibited:  { label: 'OPEN — Avoid',      color: 'text-loss border-loss/30 bg-loss/5',        dot: 'bg-loss animate-pulse' },
  preferred_morning:   { label: 'Preferred Window',  color: 'text-gain border-gain/30 bg-gain/5',        dot: 'bg-gain animate-pulse-slow' },
  caution_midday:      { label: 'Higher Caution',    color: 'text-warn border-warn/30 bg-warn/5',        dot: 'bg-warn' },
  preferred_afternoon: { label: 'Preferred Window',  color: 'text-gain border-gain/30 bg-gain/5',        dot: 'bg-gain animate-pulse-slow' },
  friday_prohibited:   { label: 'Friday — No Entry', color: 'text-loss border-loss/30 bg-loss/5',        dot: 'bg-loss animate-pulse' },
  after_hours:         { label: 'After Hours',        color: 'text-text-muted border-desk-border',        dot: 'bg-text-muted' },
  market_closed:       { label: 'Market Closed',      color: 'text-text-muted border-desk-border',        dot: 'bg-text-muted' },
}

export function TradingWindowBadge() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const window = getTradingWindow(now)
  const cfg    = WINDOW_CONFIG[window]

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
      <span className="opacity-50 ml-1">{formatUserTime(now, 'HH:mm')} CET</span>
    </div>
  )
}

/** Compact inline version for the sidebar */
export function TradingWindowDot() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const window = getTradingWindow(now)
  const cfg    = WINDOW_CONFIG[window]

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <span className={`text-xxs font-mono ${cfg.color.split(' ')[0]}`}>{cfg.label}</span>
    </div>
  )
}
