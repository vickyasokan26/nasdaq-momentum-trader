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
    <div className="login-shell">
      <div className="login-bg-grid" />

      <div className="login-content">
        <div className="login-header">
          <div className="login-logo-row">
            <div className="login-mark">M</div>
            <span className="login-name">Momentum Desk</span>
          </div>
          <p className="login-sub">NASDAQ · PRIVATE TERMINAL</p>
        </div>

        <div className="login-card">
          <form onSubmit={handleSubmit} className="login-form">
            <div>
              <label className="modal-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="modal-input"
                placeholder="trader@example.com"
              />
            </div>

            <div>
              <label className="modal-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="modal-input"
                placeholder="••••••••••••"
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" disabled={loading} className="login-btn">
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Authenticating…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="login-footer">Private access only · Not a broker</p>
      </div>
    </div>
  )
}
