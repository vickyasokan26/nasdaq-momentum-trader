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

export default function SettingsPage() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => fetch('/api/settings').then(r => r.json()),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Settings>()

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
      qc.invalidateQueries({ queryKey: ['settings', 'pnl'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const inputCls = 'w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent'
  const labelCls = 'block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1.5'

  return (
    <div className="p-6 max-w-[640px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Settings</h1>
        <p className="text-text-muted text-sm font-mono mt-0.5">Account parameters and guardrails</p>
      </div>

      <form onSubmit={handleSubmit(values => mutation.mutate(values))} className="space-y-6">
        {/* Account */}
        <div className="bg-desk-surface border border-desk-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest">Account</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Account Size €</label>
              <input {...register('accountSizeEur', { valueAsNumber: true, min: 100, max: 1_000_000 })}
                type="number" step="10" className={inputCls} />
              <p className="text-xxs font-mono text-text-muted mt-1">Current: €{ACCOUNT.SIZE_EUR}</p>
            </div>
            <div>
              <label className={labelCls}>Default Risk Per Trade €</label>
              <input {...register('maxRiskPerTradeEur', { valueAsNumber: true, min: 1, max: 100 })}
                type="number" step="0.5" className={inputCls} />
              <p className="text-xxs font-mono text-text-muted mt-1">Range €{ACCOUNT.MIN_RISK_EUR}–€{ACCOUNT.MAX_RISK_EUR}</p>
            </div>
          </div>
        </div>

        {/* Drawdown guardrails */}
        <div className="bg-desk-surface border border-desk-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest">Drawdown Guardrails</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Max Daily Loss €</label>
              <input {...register('maxDailyLossEur', { valueAsNumber: true, min: 1 })}
                type="number" step="1" className={`${inputCls} border-loss/20`} />
              <p className="text-xxs font-mono text-text-muted mt-1">Stop trading when hit</p>
            </div>
            <div>
              <label className={labelCls}>Max Weekly Loss €</label>
              <input {...register('maxWeeklyLossEur', { valueAsNumber: true, min: 1 })}
                type="number" step="1" className={`${inputCls} border-loss/20`} />
              <p className="text-xxs font-mono text-text-muted mt-1">Review before next week</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-desk-surface border border-desk-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest">Features</h2>

          <label className="flex items-center gap-3 cursor-pointer">
            <input {...register('newsScanEnabled')} type="checkbox"
              className="w-4 h-4 rounded border-desk-border bg-desk-raised accent-accent" />
            <div>
              <p className="text-sm text-text-primary">AI News Risk Scan</p>
              <p className="text-xxs font-mono text-text-muted">Uses Anthropic API + web search to flag news risk on top picks</p>
            </div>
          </label>

          <div>
            <label className={labelCls}>Display Timezone</label>
            <select {...register('timezone')} className={inputCls}>
              <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
              <option value="America/New_York">America/New_York (ET)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-accent hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            {mutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && (
            <span className="text-sm font-mono text-gain animate-fade-in">✓ Saved</span>
          )}
        </div>
      </form>

      {/* Screener constants reference */}
      <div className="mt-8 bg-desk-surface border border-desk-border rounded-xl p-5">
        <h2 className="text-xs font-mono font-semibold text-text-muted uppercase tracking-widest mb-4">
          Active Screener Constants
        </h2>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-xs font-mono">
          {[
            ['Price Floor',         `> $10`],
            ['RSI Range',           `45–75 (screener)`],
            ['Rel Vol Min',         `≥ 0.8×`],
            ['Weekly Spike Guard',  `≤ 20% change`],
            ['Earnings Blackout',   `10 calendar days`],
            ['52W High Range',      `3%–20% below`],
            ['Market Cap Floor',    `> $500M`],
            ['Min R:R',             `2:1`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-text-muted">{k}</span>
              <span className="text-accent">{v}</span>
            </div>
          ))}
        </div>
        <p className="text-xxs font-mono text-text-muted mt-3">
          These are strategy constants defined in <code className="text-accent">src/constants/screener.ts</code>.
          Changing them requires a code change and redeploy.
        </p>
      </div>
    </div>
  )
}
