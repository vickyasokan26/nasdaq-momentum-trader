// ─── CSV Import / Validation ──────────────────────────────────────────────────

export interface RawCsvRow {
  [key: string]: string
}

export interface CanonicalRow {
  symbol:                  string
  description?:            string
  price:                   number
  rsi14?:                  number
  ema20?:                  number
  ema50?:                  number
  sma50?:                  number
  volume?:                 number
  relativeVolume?:         number
  upcomingEarningsDate?:   string | null
  sector?:                 string
  high52w?:                number
  chg1w?:                  number
  marketCap?:              number
  perf1y?:                 number
}

export interface ValidationReport {
  totalRows:         number
  validRows:         number
  passedRows:        number
  droppedRows:       number
  requiredMissing:   string[]
  ambiguousColumns:  string[]
  resolvedMapping:   Record<string, string>
  rowErrors:         RowError[]
  filterDropReasons: FilterDropSummary
  [key: string]:     unknown
}

export interface RowError {
  row:    number
  sym?:   string
  reason: string
}

export interface FilterDropSummary {
  priceFloor:       number
  trendFilter:      number
  rsiGate:          number
  emaStack:         number
  relVolGate:       number
  spikeGuard:       number
  earningsGate:     number
  dist52whGate:     number
  marketCapGate:    number
  perf1yGate:       number
  [key: string]:    number
}

// ─── Screener Results ─────────────────────────────────────────────────────────

export interface ScoredCandidate extends CanonicalRow {
  score:    number
  rank?:    number
  dist52wh?: number
  earningsDate?: Date | null
}

// ─── Position Sizing ──────────────────────────────────────────────────────────

export interface SizingInput {
  entryPrice:       number
  stopPrice:        number
  t1Price:          number
  t2Price?:         number
  riskEur:          number
  accountSizeEur:   number
}

export interface SizingResult {
  stopDistancePct:  number
  positionValueEur: number
  cappedValueEur:   number
  wasCapped:        boolean
  actualRiskEur:    number
  shares:           number
  rrToT1:           number
  rrToT2?:          number
  warnings:         string[]
}

// ─── P&L ─────────────────────────────────────────────────────────────────────

export interface DailyPnlSummary {
  date:          string
  systemPnl:     number
  manualAdj:     number
  netPnl:        number
  tradeCount:    number
  dailyLimitPct: number
}

export interface DrawdownStatus {
  dailyPnl:           number
  dailyLimit:         number
  dailyLimitUsedPct:  number
  weeklyPnl:          number
  weeklyLimit:        number
  weeklyLimitUsedPct: number
  dailyStopHit:       boolean
  weeklyStopHit:      boolean
}

// ─── News Scan ────────────────────────────────────────────────────────────────

export type NewsRiskLevel    = 'high' | 'medium' | 'low' | 'unknown'
export type NewsCatalystType = 'earnings' | 'legal' | 'analyst' | 'product' | 'macro' | 'none_found' | 'other'
export type NewsConfidence   = 'high' | 'medium' | 'low'

export interface NewsScanResult {
  sym:           string
  riskLevel:     NewsRiskLevel
  catalystType:  NewsCatalystType
  confidence:    NewsConfidence
  summary:       string
  scannedAt:     string
}

// ─── Trade Evaluation ────────────────────────────────────────────────────────

export type SetupQuality = 'HIGH' | 'MEDIUM' | 'LOW'

export interface TradeEvaluationResult {
  sym:           string
  setupQuality:  SetupQuality
  entryZoneLow:  number
  entryZoneHigh: number
  stopPrice:     number
  t1Price:       number
  t2Price?:      number
  rrToT1:        number
  rrToT2?:       number
  sizing:        SizingResult
  conviction:    number
  redFlags:      string[]
  verdict:       'ENTER' | 'WAIT' | 'SKIP'
  verdictReason: string
}
