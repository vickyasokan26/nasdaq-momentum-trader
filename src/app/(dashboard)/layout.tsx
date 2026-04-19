'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { DrawdownBar } from '@/components/pnl/DrawdownBar'

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',  icon: '▦' },
  { href: '/candidates',      label: 'Candidates', icon: '◈' },
  { href: '/recommendations', label: 'Recs',       icon: '◎' },
  { href: '/trades',          label: 'Trade Log',  icon: '◉' },
  { href: '/sizer',           label: 'Sizer',      icon: '◫' },
  { href: '/history',         label: 'History',    icon: '◷' },
  { href: '/settings',        label: 'Settings',   icon: '⚙' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-desk-bg overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-[200px] shrink-0 flex flex-col bg-desk-surface border-r border-desk-border">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-desk-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-ticker/10 border border-ticker/20 rounded flex items-center justify-center">
              <span className="text-ticker text-xxs font-mono font-bold">M</span>
            </div>
            <span className="text-text-primary text-sm font-semibold tracking-tight">Momentum</span>
          </div>
          <p className="text-text-muted text-xxs font-mono mt-0.5 pl-8">NASDAQ DESK</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-100
                  ${active
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-desk-raised'
                  }
                `}
              >
                <span className="text-base leading-none w-4 text-center opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Drawdown bar */}
        <div className="px-3 py-3 border-t border-desk-border">
          <DrawdownBar compact />
        </div>

        {/* User */}
        <div className="px-3 py-3 border-t border-desk-border">
          <div className="text-xxs text-text-muted font-mono truncate">trader</div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}