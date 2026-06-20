'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DrawdownBar } from '@/components/pnl/DrawdownBar'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ACCOUNT } from '@/constants/screener'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Trading',
    items: [
      { href: '/candidates',      label: 'Candidates' },
      { href: '/recommendations', label: 'Recs' },
      { href: '/trades',          label: 'Trade Log' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/insights', label: 'Insights' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/sizer',    label: 'Position Sizer' },
      { href: '/history',  label: 'History' },
      { href: '/settings', label: 'Settings' },
    ],
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => fetch('/api/settings').then(r => r.json()),
  })
  const accountSizeEur: number = settingsData?.settings?.accountSizeEur ?? ACCOUNT.SIZE_EUR

  // Close the mobile drawer whenever the route changes (covers any navigation
  // path, not just clicking a Link in the drawer itself).
  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <div className="shell">
      <button
        className="sidebar-toggle"
        onClick={() => setMenuOpen(v => !v)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      <div className={`sidebar-backdrop${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>

        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">NDX Desk</div>
          <div className="sidebar-logo-name">Momentum Trader</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-nav-item${active ? ' active' : ''}`}
                  >
                    <span className="sidebar-nav-dot" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
          <div style={{ marginBottom: '12px' }}>
            <DrawdownBar compact />
          </div>
          <div className="acc-pill">
            <div className="acc-label">Account</div>
            <div className="acc-val">€{accountSizeEur.toFixed(0)}</div>
            <div className="acc-sub">Target €20–30/day</div>
          </div>
        </div>

      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
