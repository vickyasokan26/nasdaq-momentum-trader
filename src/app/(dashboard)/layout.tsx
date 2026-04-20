'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { DrawdownBar } from '@/components/pnl/DrawdownBar'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard',  label: 'Dashboard' },
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
    <div className="flex h-screen bg-desk-bg overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-[200px] shrink-0 flex flex-col bg-desk-surface border-r border-desk-border">

        {/* Logo */}
        <div className="px-5 py-[22px] border-b border-desk-border">
          <div className="font-mono text-[10px] text-gain tracking-[0.12em] uppercase mb-1">NDX Desk</div>
          <div className="text-[15px] font-bold tracking-tight text-text-primary leading-none">Momentum Trader</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-2">
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-text-muted px-5 py-2">
                {section.label}
              </div>
              {section.items.map(item => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-[9px] px-5 py-2 text-[13px] font-medium
                      border-l-2 transition-all duration-150
                      ${active
                        ? 'text-gain border-gain bg-gain/10'
                        : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-white/[0.03]'
                      }
                    `}
                  >
                    <span className={`w-[5px] h-[5px] rounded-full shrink-0 opacity-60 ${active ? 'bg-gain' : 'bg-current'}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Drawdown + Account */}
        <div className="border-t border-desk-border">
          <div className="px-3 py-3">
            <DrawdownBar compact />
          </div>
          <div className="px-4 pb-4">
            <div className="bg-desk-raised border border-desk-border rounded-lg px-3 py-2.5">
              <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-text-muted mb-1">Account</div>
              <div className="font-mono text-lg font-semibold text-gain leading-tight">€700</div>
              <div className="text-[11px] text-text-muted mt-0.5">Target €20–30/day</div>
            </div>
          </div>
        </div>

      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}