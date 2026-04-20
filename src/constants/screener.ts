/**
 * SCREENER FILTER CONSTANTS
 * All strategy parameters live here — change them once and they propagate everywhere.
 * These are the agreed rules from the trading skill. Do not change without review.
 */

export const SCREENER = {
  // Price floor
  MIN_PRICE: 10,

  // Trend filter — price must be above SMA50
  // (enforced, not a % threshold)

  // RSI range for screener (wider than entry trigger)
  RSI_MIN: 45,
  RSI_MAX: 75,

  // EMA stack: ema20 > ema50
  // (structural, no threshold)

  // Relative volume gate
  MIN_REL_VOL: 0.8,

  // Weekly change spike guard (removes blow-off exhaustion candles)
  MAX_CHG_1W: 20, // percent

  // Earnings gate — skip if earnings within this many calendar days
  EARNINGS_BLACKOUT_DAYS: 10,

  // 52-week high distance gate (keep stocks in this range below 52W high)
  DIST_52WH_MIN: 3,  // % below 52W high (AT the high = chasing = excluded)
  DIST_52WH_MAX: 20, // % below 52W high

  // Liquidity
  MIN_AVG_VOLUME_10D: 500_000,
  MIN_MARKET_CAP: 500_000_000, // $500M — NON-NEGOTIABLE anti-manipulation filter

  // 1-year performance gate — momentum confirmation (manual rule)
  MIN_PERF_1Y: 100, // stock must be up 100%+ over past 12 months

  // Sector diversification cap — max picks per TradingView sector label
  MAX_SECTOR_COUNT: 2,
} as const

/**
 * RANKING SCORE WEIGHTS
 * Score formula is additive — max theoretical score is ~80
 */
export const RANKING = {
  RSI_PROXIMITY_MAX:     20, // RSI closest to 50 scores highest
  REL_VOL_MAX:           20, // higher relative volume = higher score
  EMA_STACK_BONUS:       15, // ema20 > ema50 confirmed
  DIST_52WH_IDEAL:        7, // ideal distance from 52W high (% — sweet spot)
  DIST_52WH_MAX:         15, // max score for 52W distance
  CHG_1W_MIN:             1, // minimum weekly change for momentum bonus
  CHG_1W_MAX:            10, // maximum weekly change for momentum bonus
  CHG_1W_BONUS:          10, // score added if weekly change in ideal range
} as const

/**
 * ACCOUNT & RISK CONSTANTS
 */
export const ACCOUNT = {
  SIZE_EUR:            700,
  MIN_RISK_EUR:         10,
  DEFAULT_RISK_EUR:     12,
  MAX_RISK_EUR:         14,
  MAX_POSITION_PCT:   0.85, // max 85% of account in one position
  MAX_DAILY_LOSS_EUR:   21, // 3% of €700
  MAX_WEEKLY_LOSS_EUR:  42, // 6% of €700
  MIN_RR:                2, // minimum reward:risk to enter
  PREFERRED_RR:          3, // preferred reward:risk
  MIN_STOP_DISTANCE_PCT: 1, // stops tighter than 1% will be hunted — skip
  BREAKEVEN_TRIGGER_R: 1.5, // move to breakeven after 1.5R gained
} as const

/**
 * RECOMMENDATION TRACKING
 */
export const RECOMMENDATIONS = {
  // How many top candidates auto-become recommendations after a session import
  AUTO_CREATE_TOP_N: 5,

  // How long a recommendation stays "open" before it expires
  EXPIRY_CALENDAR_DAYS: 10,

  // Days to take performance snapshots
  SNAPSHOT_DAYS: [1, 3, 5, 10],
} as const
