import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

export const metadata: Metadata = {
  title:       'NASDAQ Momentum Desk',
  description: 'Private momentum trading dashboard',
  robots:      'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="scanlines">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
