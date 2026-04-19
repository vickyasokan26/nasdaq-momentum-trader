'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      setError('Invalid credentials. Check your email and password.')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-desk-bg px-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo / header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-ticker/10 border border-ticker/30 rounded flex items-center justify-center">
              <span className="text-ticker text-xs font-mono font-bold">M</span>
            </div>
            <span className="text-text-primary font-display font-semibold tracking-tight">
              Momentum Desk
            </span>
          </div>
          <p className="text-text-muted text-sm font-mono">
            NASDAQ · PRIVATE TERMINAL
          </p>
        </div>

        {/* Form */}
        <div className="bg-desk-surface border border-desk-border rounded-xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="trader@example.com"
              />
            </div>

            <div>
              <label className="block text-xxs font-mono font-semibold text-text-muted uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-desk-raised border border-desk-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="••••••••••••"
              />
            </div>

            {error && (
              <div className="bg-loss/10 border border-loss/30 rounded-lg px-3 py-2.5 text-sm text-loss font-mono animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all duration-150 text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating…
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-text-muted text-xs font-mono mt-6">
          Private access only · Not a broker
        </p>
      </div>
    </div>
  )
}
