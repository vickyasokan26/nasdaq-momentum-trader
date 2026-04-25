'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { DrawdownBar } from '@/components/pnl/DrawdownBar'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
    ],
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

  return (
    <div className="shell">
      <aside className="sidebar">

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
          <DrawdownBar compact />
          <div className="acc-pill" style={{ marginTop: 10 }}>
            <div className="acc-label">Account</div>
            <div className="acc-val">€700</div>
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
