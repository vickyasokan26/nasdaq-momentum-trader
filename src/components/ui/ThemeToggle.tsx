'use client'

import { useState, useEffect } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (saved) {
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            7,
        width:          '100%',
        background:     'var(--bg3)',
        border:         '1px solid var(--border)',
        borderRadius:   8,
        padding:        '8px 12px',
        cursor:         'pointer',
        fontFamily:     'var(--font-mono)',
        fontSize:       '0.7rem',
        fontWeight:     600,
        color:          'var(--text3)',
        letterSpacing:  '0.06em',
        textTransform:  'uppercase',
        transition:     'all 0.15s',
        marginBottom:   8,
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
    >
      <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>
        {theme === 'dark' ? '☀' : '◑'}
      </span>
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
