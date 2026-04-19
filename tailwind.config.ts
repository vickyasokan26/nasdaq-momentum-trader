import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Terminal dark palette
        desk: {
          bg:        '#08090d',
          surface:   '#0e1018',
          raised:    '#141720',
          border:    '#1e2433',
          muted:     '#2a3047',
        },
        // Text
        text: {
          primary:   '#e8eaf0',
          secondary: '#8892a4',
          muted:     '#4a5568',
        },
        // Semantic
        gain:   '#10b981',  // emerald-500
        loss:   '#ef4444',  // red-500
        warn:   '#f59e0b',  // amber-500
        accent: '#6366f1',  // indigo-500
        // Ticker accent
        ticker: '#f0c040',
      },
      fontFamily: {
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['var(--font-display)', 'DM Sans', 'sans-serif'],
        sans:    ['var(--font-sans)', 'DM Sans', 'sans-serif'],
      },
      fontSize: {
        'xxs': '0.65rem',
      },
      boxShadow: {
        'glow-gain': '0 0 12px rgba(16, 185, 129, 0.25)',
        'glow-loss': '0 0 12px rgba(239, 68, 68, 0.25)',
        'glow-warn': '0 0 12px rgba(245, 158, 11, 0.25)',
        'glow-accent': '0 0 12px rgba(99, 102, 241, 0.25)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink':      'blink 1s step-end infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        blink:   { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
    },
  },
  plugins: [],
}
export default config
