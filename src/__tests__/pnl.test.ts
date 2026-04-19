import {
  calcDayPnl,
  calcWeekPnl,
  calcDrawdownStatus,
  checkTradingPermission,
} from '@/features/pnl/calculations'

const SETTINGS = { maxDailyLossEur: 21, maxWeeklyLossEur: 42 }

function closedTrade(pnlEur: number, daysAgo = 0) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return { status: 'CLOSED', pnlEur, closedAt: d }
}

function openTrade() {
  return { status: 'OPEN', pnlEur: null, closedAt: null }
}

describe('calcDayPnl', () => {
  it('sums closed trade P&L for today', () => {
    const trades = [closedTrade(15), closedTrade(8)]
    const result = calcDayPnl(trades, new Date())
    expect(result).toBeCloseTo(23, 1)
  })

  it('returns 0 when no closed trades today', () => {
    const trades = [closedTrade(-5, 1), closedTrade(10, 2)]
    const result = calcDayPnl(trades, new Date())
    expect(result).toBe(0)
  })

  it('correctly handles losses', () => {
    const trades = [closedTrade(-15), closedTrade(-6)]
    const result = calcDayPnl(trades, new Date())
    expect(result).toBeCloseTo(-21, 1)
  })

  it('excludes open trades', () => {
    const trades = [closedTrade(10), openTrade()]
    const result = calcDayPnl(trades, new Date())
    expect(result).toBeCloseTo(10, 1)
  })

  it('excludes trades from other days', () => {
    const trades = [closedTrade(20, 1), closedTrade(15)]
    const result = calcDayPnl(trades, new Date())
    expect(result).toBeCloseTo(15, 1)
  })

  it('returns 0 for an empty array', () => {
    expect(calcDayPnl([], new Date())).toBe(0)
  })
})

describe('calcWeekPnl', () => {
  function getMonday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d
  }

  it('sums trades within the current week', () => {
    // Trades from today (within week) and last week (outside)
    const trades = [closedTrade(15, 0), closedTrade(10, 0), closedTrade(50, 8)]
    const result = calcWeekPnl(trades, getMonday())
    expect(result).toBeCloseTo(25, 1)
  })

  it('returns 0 when no trades this week', () => {
    const trades = [closedTrade(20, 8)]
    const result = calcWeekPnl(trades, getMonday())
    expect(result).toBe(0)
  })
})

describe('calcDrawdownStatus', () => {
  it('correctly computes daily limit used percentage on a loss day', () => {
    const status = calcDrawdownStatus(-10.5, 0, SETTINGS)
    // 10.5 / 21 = 50%
    expect(status.dailyLimitUsedPct).toBeCloseTo(0.5, 2)
  })

  it('shows 0% used on a profitable day', () => {
    const status = calcDrawdownStatus(25, 0, SETTINGS)
    expect(status.dailyLimitUsedPct).toBe(0)
  })

  it('caps usage at 100% even when loss exceeds limit', () => {
    const status = calcDrawdownStatus(-30, 0, SETTINGS)
    expect(status.dailyLimitUsedPct).toBe(1)
  })

  it('triggers dailyStopHit when loss reaches limit', () => {
    const status = calcDrawdownStatus(-21, 0, SETTINGS)
    expect(status.dailyStopHit).toBe(true)
  })

  it('does not trigger dailyStopHit below limit', () => {
    const status = calcDrawdownStatus(-20.99, 0, SETTINGS)
    expect(status.dailyStopHit).toBe(false)
  })

  it('triggers weeklyStopHit when weekly loss reaches limit', () => {
    const status = calcDrawdownStatus(0, -42, SETTINGS)
    expect(status.weeklyStopHit).toBe(true)
  })

  it('does not trigger weeklyStopHit below limit', () => {
    const status = calcDrawdownStatus(0, -41.99, SETTINGS)
    expect(status.weeklyStopHit).toBe(false)
  })

  it('preserves raw P&L values', () => {
    const status = calcDrawdownStatus(-15, -30, SETTINGS)
    expect(status.dailyPnl).toBe(-15)
    expect(status.weeklyPnl).toBe(-30)
  })
})

describe('checkTradingPermission', () => {
  function makeStatus(overrides: Partial<Parameters<typeof calcDrawdownStatus>[0]> = {}) {
    return calcDrawdownStatus(
      typeof overrides === 'number' ? overrides : 0,
      0,
      SETTINGS
    )
  }

  it('allows trading when no limits are hit', () => {
    const status = calcDrawdownStatus(0, 0, SETTINGS)
    const perm = checkTradingPermission(status)
    expect(perm.allowed).toBe(true)
    expect(perm.reason).toBeUndefined()
  })

  it('blocks trading when daily limit is hit', () => {
    const status = calcDrawdownStatus(-21, 0, SETTINGS)
    const perm = checkTradingPermission(status)
    expect(perm.allowed).toBe(false)
    expect(perm.reason).toContain('Daily loss limit')
  })

  it('blocks trading when weekly limit is hit', () => {
    const status = calcDrawdownStatus(0, -42, SETTINGS)
    const perm = checkTradingPermission(status)
    expect(perm.allowed).toBe(false)
    expect(perm.reason).toContain('Weekly loss limit')
  })

  it('issues a warning at 50% of daily limit without blocking', () => {
    const status = calcDrawdownStatus(-10.5, 0, SETTINGS)
    const perm = checkTradingPermission(status)
    expect(perm.allowed).toBe(true)
    expect(perm.warning).toBeDefined()
    expect(perm.warning).toContain('50%')
  })

  it('does not warn below 50% of daily limit', () => {
    const status = calcDrawdownStatus(-5, 0, SETTINGS)
    const perm = checkTradingPermission(status)
    expect(perm.allowed).toBe(true)
    expect(perm.warning).toBeUndefined()
  })
})
