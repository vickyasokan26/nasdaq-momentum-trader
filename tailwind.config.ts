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
        // Dark surface palette
        desk: {
          bg:        '#0a0b0d',
          surface:   '#111318',
          raised:    '#181c24',
          border:    '#1e2028',
          muted:     '#2a2c38',
        },
        // Text
        text: {
          primary:   '#e8eaf0',
          secondary: '#8b90a0',
          muted:     '#555b6e',
        },
        // Semantic
        gain:   '#00d67c',
        loss:   '#ff4d6d',
        warn:   '#f5a623',
        accent: '#4d9fff',
        ticker: '#4d9fff',
      },
      fontFamily: {
        mono:    ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
        display: ['var(--font-display)', 'Syne', 'sans-serif'],
        sans:    ['var(--font-sans)', 'Syne', 'sans-serif'],
      },
      fontSize: {
        'xxs': '0.65rem',
      },
      boxShadow: {
        'glow-gain':   '0 0 12px rgba(0, 214, 124, 0.2)',
        'glow-loss':   '0 0 12px rgba(255, 77, 109, 0.2)',
        'glow-warn':   '0 0 12px rgba(245, 166, 35, 0.2)',
        'glow-accent': '0 0 12px rgba(77, 159, 255, 0.2)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-in-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink':      'blink 1s step-end infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        blink:   { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
    },
  },
  plugins: [],
}
export default config
