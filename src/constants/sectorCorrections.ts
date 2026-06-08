/**
 * TradingView sector corrections.
 *
 * TradingView groups infrastructure and specialty REITs under "Finance"
 * instead of "Real Estate". Add tickers here as you encounter them in
 * your screener. Falls back to TradingView's value when no entry exists.
 */
export const SECTOR_CORRECTIONS: Record<string, string> = {
  // Telecom / fibre REITs
  UNIT:  'Real Estate',  // Uniti Group
  AMT:   'Real Estate',  // American Tower
  CCI:   'Real Estate',  // Crown Castle
  SBAC:  'Real Estate',  // SBA Communications
  // Data centre REITs
  EQIX:  'Real Estate',  // Equinix
  DLR:   'Real Estate',  // Digital Realty
  IRM:   'Real Estate',  // Iron Mountain
  // Net lease / diversified REITs
  O:     'Real Estate',  // Realty Income
  WPC:   'Real Estate',  // W. P. Carey
  NNN:   'Real Estate',  // NNN REIT
  IIPR:  'Real Estate',  // Innovative Industrial Properties
}

/**
 * Sectors where the EMA-retest momentum strategy still applies but carries
 * extra risk beyond what the daily filters catch. ENTER verdict renders in
 * amber instead of green when the candidate's sector appears here.
 *
 * Key: exact sector string as it appears after corrections above.
 * Value: one-line reason shown in the verdict panel.
 */
export const CAUTION_SECTORS: Record<string, string> = {
  'Healthcare': 'May include biotech — binary catalyst risk (FDA decisions, trial data) can invalidate an EMA setup overnight. Check news tab manually.',
  'Energy':     'Commodity-driven sector — EMA structure can break sharply on macro or supply news unrelated to the chart.',
  'Real Estate': 'Interest-rate sensitive — EMA retests can reverse on rate moves rather than momentum continuation.',
}

/**
 * Keywords in a company description that suggest a "Finance"-labelled
 * stock is actually a REIT the corrections map doesn't cover yet.
 */
const REIT_KEYWORDS = ['reit', 'realty', ' properties', 'real estate investment']

export function applySectorCorrection(sym: string, sector: string | undefined): string | undefined {
  const correction = SECTOR_CORRECTIONS[sym.toUpperCase()]
  return correction ?? sector
}

export function isSuspectedMisclassification(
  sym:         string,
  sector:      string | undefined,
  description: string | undefined,
): boolean {
  if (SECTOR_CORRECTIONS[sym.toUpperCase()]) return false  // already corrected — no warning needed
  if (sector?.toLowerCase() !== 'finance')  return false
  if (!description)                         return false
  const desc = description.toLowerCase()
  return REIT_KEYWORDS.some(kw => desc.includes(kw))
}
