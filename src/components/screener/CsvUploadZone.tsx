'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { ValidationReport } from '@/types'

interface UploadResult {
  sessionId:     string
  report:        ValidationReport
  topCandidates: unknown[]
}

interface Props {
  onSuccess: (result: UploadResult) => void
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export function CsvUploadZone({ onSuccess }: Props) {
  const [state, setState]     = useState<UploadState>('idle')
  const [message, setMessage] = useState('')

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setState('uploading')
    setMessage('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res  = await fetch('/api/screen/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setState('error'); setMessage(data.error ?? 'Upload failed'); return }
      setState('success')
      setMessage(`${data.report.passedRows} stocks passed filters`)
      onSuccess(data)
      setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      setMessage('Network error — try again')
    }
  }, [onSuccess])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:   { 'text/csv': ['.csv'], 'text/plain': ['.csv'] },
    maxFiles: 1,
    disabled: state === 'uploading',
  })

  const borderColor =
    isDragActive       ? 'var(--blue)'  :
    state === 'error'  ? 'var(--red)'   :
    state === 'success'? 'var(--green)' :
    'var(--border2)'

  const bgColor =
    isDragActive       ? 'rgba(77,159,255,0.05)'  :
    state === 'error'  ? 'rgba(255,77,109,0.05)'  :
    state === 'success'? 'rgba(0,214,124,0.05)'   :
    'var(--bg2)'

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${borderColor}`,
        background: bgColor,
        borderRadius: 12,
        padding: 24,
        cursor: state === 'uploading' ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        textAlign: 'center',
        height: '100%',
      }}
    >
      <input {...getInputProps()} />

      {state === 'uploading' && (
        <>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(77,159,255,0.25)',
            borderTopColor: 'var(--blue)',
            animation: 'spin 0.7s linear infinite',
          }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--blue)' }}>Processing CSV…</p>
        </>
      )}

      {state === 'success' && (
        <>
          <span style={{ fontSize: '1.5rem', color: 'var(--green)' }}>✓</span>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--green)' }}>{message}</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>Table updated below</p>
        </>
      )}

      {state === 'error' && (
        <>
          <span style={{ fontSize: '1.25rem', color: 'var(--red)' }}>✗</span>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--red)' }}>{message}</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>Drop another file to retry</p>
        </>
      )}

      {state === 'idle' && (
        <>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--bg3)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'var(--text2)', fontSize: '1.1rem', lineHeight: 1 }}>↑</span>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text2)' }}>
              {isDragActive ? 'Drop CSV here' : 'Upload TradingView CSV'}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4 }}>
              Drag &amp; drop or click · .csv only · max 5MB
            </p>
          </div>
        </>
      )}
    </div>
  )
}
