import { applyScreenerFilters } from '@/features/screener/filters'
import { SCREENER } from '@/constants/screener'
import type { CanonicalRow } from '@/types'

const BASE: CanonicalRow = {
  symbol:         'TEST',
  price:          50,
  rsi14:          55,
  ema20:          52,
  ema50:          48,
  sma50:          45,
  relativeVolume: 1.2,
  chg1w:          3,
  high52w:        58,
  marketCap:      2_000_000_000,
  upcomingEarningsDate: null,
}

function make(overrides: Partial<CanonicalRow>): CanonicalRow {
  return { ...BASE, ...overrides }
}

describe('applyScreenerFilters', () => {
  it('passes a valid stock with all fields', () => {
    const { passing, drops } = applyScreenerFilters([make({})])
    expect(passing).toHaveLength(1)
    expect(passing[0].symbol).toBe('TEST')
  })

  // ── Price floor ────────────────────────────────────────────────────────────

  it('drops stocks at exactly the price floor', () => {
    const { passing, drops } = applyScreenerFilters([make({ price: 10 })])
    expect(passing).toHaveLength(0)
    expect(drops.priceFloor).toBe(1)
  })

  it('drops stocks below the price floor', () => {
    const { passing, drops } = applyScreenerFilters([make({ price: 5.99 })])
    expect(passing).toHaveLength(0)
    expect(drops.priceFloor).toBe(1)
  })

  it('passes stocks above the price floor', () => {
    // Override sma50 and high52w so no other filter trips at this price level
    const { passing } = applyScreenerFilters([make({ price: 15, sma50: 12, high52w: 17 })])
    expect(passing).toHaveLength(1)
  })

  // ── Trend filter ──────────────────────────────────────────────────────────

  it('drops stocks with price equal to SMA50', () => {
    const { passing, drops } = applyScreenerFilters([make({ price: 45, sma50: 45 })])
    expect(passing).toHaveLength(0)
    expect(drops.trendFilter).toBe(1)
  })

  it('drops stocks with price below SMA50', () => {
    const { drops } = applyScreenerFilters([make({ price: 44, sma50: 45 })])
    expect(drops.trendFilter).toBe(1)
  })

  it('passes stocks with price above SMA50', () => {
    // high52w adjusted so 52W distance stays within 3–20% band
    const { passing } = applyScreenerFilters([make({ price: 46, sma50: 45, high52w: 53 })])
    expect(passing).toHaveLength(1)
  })

  it('passes when sma50 is undefined (no data)', () => {
    const { passing } = applyScreenerFilters([make({ sma50: undefined })])
    expect(passing).toHaveLength(1)
  })

  // ── RSI gate ──────────────────────────────────────────────────────────────

  it('drops stocks with RSI below minimum', () => {
    const { drops } = applyScreenerFilters([make({ rsi14: SCREENER.RSI_MIN - 0.1 })])
    expect(drops.rsiGate).toBe(1)
  })

  it('passes stocks at RSI minimum boundary', () => {
    const { passing } = applyScreenerFilters([make({ rsi14: SCREENER.RSI_MIN })])
    expect(passing).toHaveLength(1)
  })

  it('drops stocks with RSI above maximum', () => {
    const { drops } = applyScreenerFilters([make({ rsi14: SCREENER.RSI_MAX + 0.1 })])
    expect(drops.rsiGate).toBe(1)
  })

  it('passes stocks at RSI maximum boundary', () => {
    const { passing } = applyScreenerFilters([make({ rsi14: SCREENER.RSI_MAX })])
    expect(passing).toHaveLength(1)
  })

  it('passes when rsi14 is undefined', () => {
    const { passing } = applyScreenerFilters([make({ rsi14: undefined })])
    expect(passing).toHaveLength(1)
  })

  // ── EMA stack ─────────────────────────────────────────────────────────────

  it('drops stocks where ema20 equals ema50', () => {
    const { drops } = applyScreenerFilters([make({ ema20: 50, ema50: 50 })])
    expect(drops.emaStack).toBe(1)
  })

  it('drops stocks where ema20 is below ema50', () => {
    const { drops } = applyScreenerFilters([make({ ema20: 47, ema50: 50 })])
    expect(drops.emaStack).toBe(1)
  })

  it('passes stocks where ema20 is above ema50', () => {
    const { passing } = applyScreenerFilters([make({ ema20: 51, ema50: 50 })])
    expect(passing).toHaveLength(1)
  })

  // ── Relative volume ───────────────────────────────────────────────────────

  it('drops stocks below minimum relative volume', () => {
    const { drops } = applyScreenerFilters([make({ relativeVolume: SCREENER.MIN_REL_VOL - 0.1 })])
    expect(drops.relVolGate).toBe(1)
  })

  it('passes stocks at minimum relative volume', () => {
    const { passing } = applyScreenerFilters([make({ relativeVolume: SCREENER.MIN_REL_VOL })])
    expect(passing).toHaveLength(1)
  })

  // ── Spike guard ───────────────────────────────────────────────────────────

  it('drops stocks with weekly change exceeding spike guard', () => {
    const { drops } = applyScreenerFilters([make({ chg1w: SCREENER.MAX_CHG_1W + 0.1 })])
    expect(drops.spikeGuard).toBe(1)
  })

  it('passes stocks at spike guard boundary', () => {
    const { passing } = applyScreenerFilters([make({ chg1w: SCREENER.MAX_CHG_1W })])
    expect(passing).toHaveLength(1)
  })

  // ── Earnings blackout ─────────────────────────────────────────────────────

  it('drops stocks with earnings tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const { drops } = applyScreenerFilters([make({ upcomingEarningsDate: tomorrow.toISOString() })])
    expect(drops.earningsGate).toBe(1)
  })

  it('drops stocks with earnings in 10 days', () => {
    const tenDays = new Date()
    tenDays.setDate(tenDays.getDate() + 10)
    const { drops } = applyScreenerFilters([make({ upcomingEarningsDate: tenDays.toISOString() })])
    expect(drops.earningsGate).toBe(1)
  })

  it('passes stocks with earnings in 11 days', () => {
    const elevenDays = new Date()
    elevenDays.setDate(elevenDays.getDate() + 11)
    const { passing } = applyScreenerFilters([make({ upcomingEarningsDate: elevenDays.toISOString() })])
    expect(passing).toHaveLength(1)
  })

  it('passes stocks with past earnings dates', () => {
    const lastMonth = new Date()
    lastMonth.setDate(lastMonth.getDate() - 30)
    const { passing } = applyScreenerFilters([make({ upcomingEarningsDate: lastMonth.toISOString() })])
    expect(passing).toHaveLength(1)
  })

  // ── 52W high distance ─────────────────────────────────────────────────────

  it('drops stocks too close to 52W high (< 3%)', () => {
    // Price = $99, 52W High = $100 → 1% below
    const { drops } = applyScreenerFilters([make({ price: 99, high52w: 100 })])
    expect(drops.dist52whGate).toBe(1)
  })

  it('drops stocks AT the 52W high', () => {
    const { drops } = applyScreenerFilters([make({ price: 100, high52w: 100 })])
    expect(drops.dist52whGate).toBe(1)
  })

  it('drops stocks too far below 52W high (> 20%)', () => {
    // Price = $79, 52W High = $100 → 21% below
    const { drops } = applyScreenerFilters([make({ price: 79, high52w: 100 })])
    expect(drops.dist52whGate).toBe(1)
  })

  it('passes stocks in sweet spot (7% below 52W high)', () => {
    // Price = $93, 52W High = $100 → 7% below
    const { passing } = applyScreenerFilters([make({ price: 93, high52w: 100 })])
    expect(passing).toHaveLength(1)
  })

  // ── Market cap ────────────────────────────────────────────────────────────

  it('drops stocks below market cap floor', () => {
    const { drops } = applyScreenerFilters([make({ marketCap: 499_000_000 })])
    expect(drops.marketCapGate).toBe(1)
  })

  it('passes stocks at market cap floor', () => {
    const { passing } = applyScreenerFilters([make({ marketCap: 500_000_000 })])
    expect(passing).toHaveLength(1)
  })

  // ── Multiple stocks ───────────────────────────────────────────────────────

  it('correctly filters a mixed batch', () => {
    const batch = [
      make({ symbol: 'PASS' }),
      make({ symbol: 'CHEAP',  price: 5 }),
      make({ symbol: 'OVERBOUGHT', rsi14: 80 }),
      make({ symbol: 'SMALLCAP',  marketCap: 100_000_000 }),
    ]
    const { passing, drops } = applyScreenerFilters(batch)
    expect(passing).toHaveLength(1)
    expect(passing[0].symbol).toBe('PASS')
    expect(drops.priceFloor).toBe(1)
    expect(drops.rsiGate).toBe(1)
    expect(drops.marketCapGate).toBe(1)
  })
})
