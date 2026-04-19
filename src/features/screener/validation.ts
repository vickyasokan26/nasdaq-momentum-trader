/**
 * CSV Validation & Column Mapping
 *
 * Rules:
 * - Required fields must be present — no silent fuzzy guessing for critical columns
 * - Deterministic alias mapping only (exact match or known alias)
 * - Ambiguous columns surface a warning and require confirmation
 * - Invalid rows are logged with reason, never silently dropped
 */

import { parse } from 'csv-parse/sync'
import type { RawCsvRow, CanonicalRow, ValidationReport, RowError, FilterDropSummary } from '@/types'

// ── Canonical column aliases ──────────────────────────────────────────────────
// Map of canonical field name → list of accepted header aliases (lowercase, trimmed)
const COLUMN_ALIASES: Record<string, string[]> = {
  symbol:              ['symbol', 'ticker', 'sym', 'name'],
  description:         ['description', 'company', 'company name', 'desc'],
  price:               ['price', 'last', 'close', 'last price', 'last close', 'price (usd)'],
  rsi14:               ['rsi(14)', 'rsi14', 'rsi', 'relative strength index(14)'],
  ema20:               ['ema(20)', 'ema20', '20 ema', 'exponential moving average (20)'],
  ema50:               ['ema(50)', 'ema50', '50 ema', 'exponential moving average (50)'],
  sma50:               ['sma(50)', 'sma50', '50 sma', 'simple moving average (50)'],
  volume:              ['volume', 'volume 1d', 'vol', '1d volume'],
  relativeVolume:      ['relative volume', 'relvol', 'relative volume (10d)', 'relative volume 1d', 'rel volume'],
  upcomingEarningsDate:['upcoming earnings date', 'earnings date', 'earnings', 'next earnings'],
  sector:              ['sector'],
  high52w:             ['52 week high', '52w high', '52-week high', 'year high'],
  chg1w:               ['change % 1w', '1w change', '1w change %', 'weekly change', 'change (1w)', 'price change % 1w'],
  marketCap:           ['market cap', 'market capitalization', 'mktcap'],
}

const REQUIRED_FIELDS = ['symbol', 'price']
const IMPORTANT_FIELDS = ['rsi14', 'ema20', 'ema50', 'sma50', 'volume', 'relativeVolume']

// ── Column detection ──────────────────────────────────────────────────────────

export interface MappingResult {
  resolved:    Record<string, string>   // canonical → actual header
  missing:     string[]                 // required fields that couldn't be mapped
  ambiguous:   string[]                 // fields with multiple potential matches
  unmapped:    string[]                 // input headers not matched to any canonical field
}

export function detectColumnMapping(headers: string[]): MappingResult {
  const normalized = headers.map(h => h.toLowerCase().trim())
  const resolved: Record<string, string> = {}
  const ambiguous: string[] = []

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const matches: string[] = []
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i])) {
        matches.push(headers[i])
      }
    }
    if (matches.length === 1) {
      resolved[canonical] = matches[0]
    } else if (matches.length > 1) {
      ambiguous.push(canonical)
      resolved[canonical] = matches[0] // take first, surface warning
    }
  }

  const missing = REQUIRED_FIELDS.filter(f => !resolved[f])
  const resolvedOriginals = new Set(Object.values(resolved))
  const unmapped = headers.filter(h => !resolvedOriginals.has(h))

  return { resolved, missing, ambiguous, unmapped }
}

// ── CSV Parsing ───────────────────────────────────────────────────────────────

export interface ParsedCsv {
  headers: string[]
  rows:    RawCsvRow[]
  error?:  string
}

export function parseCsvBuffer(buffer: Buffer): ParsedCsv {
  try {
    const records = parse(buffer, {
      columns:          true,
      skip_empty_lines: true,
      trim:             true,
      bom:              true,
    }) as RawCsvRow[]

    if (records.length === 0) {
      return { headers: [], rows: [], error: 'CSV file is empty' }
    }

    const headers = Object.keys(records[0])
    return { headers, rows: records }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown parse error'
    return { headers: [], rows: [], error: `CSV parse failed: ${msg}` }
  }
}

// ── Row Canonicalization ──────────────────────────────────────────────────────

export interface RowResult {
  row?:   CanonicalRow
  error?: RowError
}

export function canonicalizeRow(
  rawRow: RawCsvRow,
  mapping: Record<string, string>,
  rowIndex: number,
): RowResult {
  const get = (field: string): string | undefined =>
    mapping[field] ? rawRow[mapping[field]]?.trim() : undefined

  const sym = get('symbol')?.toUpperCase()
  if (!sym) {
    return { error: { row: rowIndex, reason: 'Missing symbol' } }
  }

  const priceStr = get('price')
  const price = parseFloat(priceStr ?? '')
  if (isNaN(price) || price <= 0) {
    return { error: { row: rowIndex, sym, reason: `Invalid price: "${priceStr}"` } }
  }

  const parseNum = (field: string): number | undefined => {
    const v = get(field)
    if (v === undefined || v === '' || v === 'N/A' || v === '-' || v === 'null') return undefined
    // Handle % suffix
    const cleaned = v.replace('%', '').replace(',', '').trim()
    const n = parseFloat(cleaned)
    return isNaN(n) ? undefined : n
  }

  const parseDate = (field: string): string | null => {
    const v = get(field)
    if (!v || v === '' || v === 'N/A' || v === '-' || v === 'null') return null
    return v
  }

  const row: CanonicalRow = {
    symbol:                sym,
    description:           get('description'),
    price,
    rsi14:                 parseNum('rsi14'),
    ema20:                 parseNum('ema20'),
    ema50:                 parseNum('ema50'),
    sma50:                 parseNum('sma50'),
    volume:                parseNum('volume'),
    relativeVolume:        parseNum('relativeVolume'),
    upcomingEarningsDate:  parseDate('upcomingEarningsDate'),
    sector:                get('sector'),
    high52w:               parseNum('high52w'),
    chg1w:                 parseNum('chg1w'),
    marketCap:             parseNum('marketCap'),
  }

  return { row }
}

// ── Full Validation Pipeline ──────────────────────────────────────────────────

export interface ValidationResult {
  mapping:       MappingResult
  valid:         CanonicalRow[]
  rowErrors:     RowError[]
  totalRows:     number
}

export function validateCsvImport(buffer: Buffer): ValidationResult | { fatalError: string } {
  const parsed = parseCsvBuffer(buffer)
  if (parsed.error) return { fatalError: parsed.error }
  if (parsed.headers.length === 0) return { fatalError: 'No columns detected' }

  const mapping = detectColumnMapping(parsed.headers)
  if (mapping.missing.length > 0) {
    return {
      fatalError: `Required columns not found: ${mapping.missing.join(', ')}. ` +
                  `Available columns: ${parsed.headers.join(', ')}`,
    }
  }

  const valid: CanonicalRow[] = []
  const rowErrors: RowError[] = []

  for (let i = 0; i < parsed.rows.length; i++) {
    const result = canonicalizeRow(parsed.rows[i], mapping.resolved, i + 2) // +2 = 1-indexed + header row
    if (result.row) {
      valid.push(result.row)
    } else if (result.error) {
      rowErrors.push(result.error)
    }
  }

  return {
    mapping,
    valid,
    rowErrors,
    totalRows: parsed.rows.length,
  }
}

// ── Validation Report Builder ─────────────────────────────────────────────────

export function buildValidationReport(
  totalRows:     number,
  validRows:     number,
  passedRows:    number,
  mapping:       MappingResult,
  rowErrors:     RowError[],
  filterDrops:   FilterDropSummary,
): ValidationReport {
  return {
    totalRows,
    validRows,
    passedRows,
    droppedRows:       totalRows - validRows,
    requiredMissing:   mapping.missing,
    ambiguousColumns:  mapping.ambiguous,
    resolvedMapping:   mapping.resolved,
    rowErrors,
    filterDropReasons: filterDrops,
  }
}
