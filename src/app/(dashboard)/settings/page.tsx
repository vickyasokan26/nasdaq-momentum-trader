'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { ACCOUNT } from '@/constants/screener'

interface Settings {
  accountSizeEur:     number
  maxRiskPerTradeEur: number
  maxDailyLossEur:    number
  maxWeeklyLossEur:   number
  newsScanEnabled:    boolean
  timezone:           string
}

const card: React.CSSProperties = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 20,
}
const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 600,
  color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em',
  marginBottom: 16,
}
const hint: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginTop: 5,
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => fetch('/api/settings').then(r => r.json()),
  })

  const { register, handleSubmit, reset, watch } = useForm<Settings>()

  useEffect(() => {
    if (data?.settings) reset(data.settings)
  }, [data, reset])

  const mutation = useMutation({
    mutationFn: (values: Partial<Settings>) =>
      fetch('/api/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(values),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['pnl'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const watchedAccount = watch('accountSizeEur') ?? ACCOUNT.SIZE_EUR
  const watchedDaily   = watch('maxDailyLossEur')
  const watchedWeekly  = watch('maxWeeklyLossEur')
  const dailyPct       = watchedAccount > 0 && watchedDaily  ? ((watchedDaily  / watchedAccount) * 100).toFixed(1) : null
  const weeklyPct      = watchedAccount > 0 && watchedWeekly ? ((watchedWeekly / watchedAccount) * 100).toFixed(1) : null

  return (
    <div style={{ padding: 24, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>Settings</h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text3)', marginTop: 3 }}>Account parameters and guardrails</p>
      </div>

      <form onSubmit={handleSubmit(values => mutation.mutate(values))} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Account ── */}
        <div style={card}>
          <div style={sectionTitle}>Account</div>
          <div className="responsive-grid-2" style={{ gap: 16 }}>
            <div>
              <label className="modal-label">Account Size €</label>
              <input {...register('accountSizeEur', { valueAsNumber: true, min: 100 })}
                type="number" step="10" className="modal-input" />
            </div>
            <div>
              <label className="modal-label">Risk Per Trade €</label>
              <input {...register('maxRiskPerTradeEur', { valueAsNumber: true, min: 1, max: 100 })}
                type="number" step="0.5" className="modal-input" />
              <p style={hint}>Allowed range: €{ACCOUNT.MIN_RISK_EUR} – €{ACCOUNT.MAX_RISK_EUR}</p>
            </div>
          </div>
        </div>

        {/* ── Drawdown guardrails ── */}
        <div style={{ ...card, border: '1px solid rgba(255,77,109,0.18)' }}>
          <div style={{ ...sectionTitle, color: 'rgba(255,77,109,0.6)' }}>Drawdown Guardrails</div>
          <div className="responsive-grid-2" style={{ gap: 16 }}>
            <div>
              <label className="modal-label">Max Daily Loss €</label>
              <input {...register('maxDailyLossEur', { valueAsNumber: true, min: 1 })}
                type="number" step="1" className="modal-input"
                style={{ borderColor: 'rgba(255,77,109,0.3)' }} />
              <p style={hint}>
                Stop trading when hit
                {dailyPct && <span style={{ color: 'var(--red)', marginLeft: 6 }}>{dailyPct}% of account</span>}
              </p>
            </div>
            <div>
              <label className="modal-label">Max Weekly Loss €</label>
              <input {...register('maxWeeklyLossEur', { valueAsNumber: true, min: 1 })}
                type="number" step="1" className="modal-input"
                style={{ borderColor: 'rgba(255,77,109,0.3)' }} />
              <p style={hint}>
                Review before next week
                {weeklyPct && <span style={{ color: 'var(--red)', marginLeft: 6 }}>{weeklyPct}% of account</span>}
              </p>
            </div>
          </div>
        </div>

        {/* ── Features ── */}
        <div style={card}>
          <div style={sectionTitle}>Features</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* News scan toggle */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <div style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
                <input {...register('newsScanEnabled')} type="checkbox"
                  style={{ width: 16, height: 16, accentColor: 'var(--blue)', cursor: 'pointer' }} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>AI News Risk Scan</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', lineHeight: 1.5 }}>
                  Uses Anthropic API + web search to flag news risk on top picks before entry
                </p>
              </div>
            </label>

            {/* Timezone */}
            <div>
              <label className="modal-label">Display Timezone</label>
              <select {...register('timezone')} className="modal-input">
                <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
                <option value="America/New_York">America/New_York (ET)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Save ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <button
            type="submit"
            disabled={mutation.isPending}
            style={{
              background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600,
              padding: '11px 28px', cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              opacity: mutation.isPending ? 0.6 : 1, transition: 'opacity 0.15s',
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--green)', animation: 'fadeIn 0.2s ease' }}>
              ✓ Saved
            </span>
          )}
        </div>
      </form>

      {/* ── Screener constants reference ── */}
      <div style={{ ...card, marginTop: 16, border: '1px solid var(--border)' }}>
        <div style={sectionTitle}>Active Screener Constants</div>
        <div className="responsive-grid-2" style={{ gap: '6px 24px' }}>
          {[
            ['Price Floor',        '> $10'],
            ['RSI Range',          '45–75'],
            ['Rel Vol Min',        '≥ 0.8×'],
            ['Weekly Spike Guard', '≤ 20% change'],
            ['Earnings Blackout',  '10 calendar days'],
            ['52W High Range',     '3%–20% below'],
            ['Market Cap Floor',   '> $500M'],
            ['Min R:R',            '2:1'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text3)' }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--blue)' }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginTop: 12, lineHeight: 1.6 }}>
          Defined in <code style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>src/constants/screener.ts</code> — changing requires a code change and redeploy.
        </p>
      </div>

    </div>
  )
}
