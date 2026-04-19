'use client'

interface ValidationReport {
  totalRows:         number
  validRows:         number
  passedRows:        number
  droppedRows:       number
  requiredMissing:   string[]
  ambiguousColumns:  string[]
  resolvedMapping:   Record<string, string>
  rowErrors:         Array<{ row: number; sym?: string; reason: string }>
  filterDropReasons: Record<string, number>
}

interface Props {
  result:    { report: ValidationReport; sessionId: string }
  onDismiss: () => void
}

export function ValidationSummary({ result, onDismiss }: Props) {
  const r      = result.report
  const drops  = r.filterDropReasons ?? {}
  const passed = r.passedRows
  const total  = r.totalRows

  return (
    <div className="bg-desk-surface border border-desk-border rounded-xl p-5 animate-slide-up">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Import Report</h3>
          <p className="text-xxs font-mono text-text-muted mt-0.5">Session {result.sessionId.slice(-8)}</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-text-muted hover:text-text-primary text-xl leading-none"
        >×</button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Rows',  value: total,           color: 'text-text-primary' },
          { label: 'Valid Rows',  value: r.validRows,     color: 'text-text-secondary' },
          { label: 'Passed Filters', value: passed,       color: passed > 0 ? 'text-gain' : 'text-loss' },
          { label: 'Parse Errors',   value: r.droppedRows, color: r.droppedRows > 0 ? 'text-warn' : 'text-text-muted' },
        ].map(s => (
          <div key={s.label} className="bg-desk-raised rounded-lg p-3 text-center">
            <div className={`text-xl font-mono font-semibold tabular ${s.color}`}>{s.value}</div>
            <div className="text-xxs font-mono text-text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter drop breakdown */}
      {Object.values(drops).some(v => v > 0) && (
        <div className="mb-4">
          <p className="text-xxs font-mono text-text-muted uppercase tracking-widest mb-2">Filter Drop Reasons</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(drops)
              .filter(([, v]) => v > 0)
              .map(([key, count]) => (
                <div key={key} className="flex items-center justify-between bg-desk-raised rounded px-2.5 py-1.5">
                  <span className="text-xxs font-mono text-text-muted capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-xxs font-mono text-warn tabular">{count}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Column mapping */}
      <div className="mb-4">
        <p className="text-xxs font-mono text-text-muted uppercase tracking-widest mb-2">Column Mapping</p>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(r.resolvedMapping).map(([canonical, header]) => (
            <div key={canonical} className="flex items-center gap-2 text-xxs font-mono">
              <span className="text-text-muted">{canonical}</span>
              <span className="text-desk-muted">→</span>
              <span className="text-gain truncate">{header}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {r.ambiguousColumns.length > 0 && (
        <div className="bg-warn/5 border border-warn/20 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-xxs font-mono text-warn">
            ⚠ Ambiguous columns (first match used): {r.ambiguousColumns.join(', ')}
          </p>
        </div>
      )}
      {r.rowErrors.length > 0 && (
        <div className="bg-loss/5 border border-loss/20 rounded-lg px-3 py-2.5">
          <p className="text-xxs font-mono text-loss mb-1">
            {r.rowErrors.length} rows skipped:
          </p>
          {r.rowErrors.slice(0, 5).map((e, i) => (
            <p key={i} className="text-xxs font-mono text-text-muted">
              Row {e.row}{e.sym ? ` (${e.sym})` : ''}: {e.reason}
            </p>
          ))}
          {r.rowErrors.length > 5 && (
            <p className="text-xxs font-mono text-text-muted mt-1">
              …and {r.rowErrors.length - 5} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}
