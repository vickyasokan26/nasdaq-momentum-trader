'use client'

import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open:      boolean
  onClose:   () => void
  title:     string
  children:  ReactNode
  width?:    string
}

const WIDTH_MAP: Record<string, number> = {
  'max-w-lg':  512,
  'max-w-xl':  576,
  'max-w-2xl': 672,
  'max-w-3xl': 768,
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const maxWidth = WIDTH_MAP[width] ?? 512

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      />
      {/* Panel */}
      <div style={{
        position:     'relative',
        width:        '100%',
        maxWidth:     maxWidth,
        background:   'var(--bg2)',
        border:       '1px solid var(--border2)',
        borderRadius: 12,
        boxShadow:    '0 24px 64px rgba(0,0,0,0.6)',
        animation:    'slideUp 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '1.25rem', lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
