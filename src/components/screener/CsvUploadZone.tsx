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
  const [state, setState]   = useState<UploadState>('idle')
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

      if (!res.ok) {
        setState('error')
        setMessage(data.error ?? 'Upload failed')
        return
      }

      setState('success')
      setMessage(`${data.report.passedRows} stocks passed filters`)
      onSuccess(data)

      // Reset after 4s
      setTimeout(() => setState('idle'), 4000)
    } catch (err) {
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
    isDragActive     ? 'border-accent'  :
    state === 'error'   ? 'border-loss'    :
    state === 'success' ? 'border-gain'    :
    'border-desk-border hover:border-desk-muted'

  const bgColor =
    isDragActive        ? 'bg-accent/5'    :
    state === 'error'   ? 'bg-loss/5'      :
    state === 'success' ? 'bg-gain/5'      :
    'bg-desk-surface hover:bg-desk-raised'

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-6 cursor-pointer
        transition-all duration-150 h-full min-h-[120px]
        flex flex-col items-center justify-center gap-2 text-center
        ${borderColor} ${bgColor}
      `}
    >
      <input {...getInputProps()} />

      {state === 'uploading' && (
        <>
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm font-mono text-accent">Processing CSV…</p>
        </>
      )}

      {state === 'success' && (
        <>
          <span className="text-2xl text-gain">✓</span>
          <p className="text-sm font-mono text-gain font-semibold">{message}</p>
          <p className="text-xxs font-mono text-text-muted">Table updated below</p>
        </>
      )}

      {state === 'error' && (
        <>
          <span className="text-xl text-loss">✗</span>
          <p className="text-sm font-mono text-loss">{message}</p>
          <p className="text-xxs font-mono text-text-muted">Drop another file to retry</p>
        </>
      )}

      {state === 'idle' && (
        <>
          <div className="w-8 h-8 rounded-lg bg-desk-raised border border-desk-border flex items-center justify-center">
            <span className="text-text-secondary text-lg leading-none">↑</span>
          </div>
          <div>
            <p className="text-sm font-mono text-text-secondary">
              {isDragActive ? 'Drop CSV here' : 'Upload TradingView CSV'}
            </p>
            <p className="text-xxs font-mono text-text-muted mt-0.5">
              Drag & drop or click · .csv only · max 5MB
            </p>
          </div>
        </>
      )}
    </div>
  )
}
