import { getTradingWindow, isTradingProhibited, isHighCaution } from '@/lib/timezone'
import { toZonedTime } from 'date-fns-tz'

const MARKET_TZ = 'America/New_York'

/** Build a UTC Date that corresponds to a given ET time on a non-holiday weekday */
function etTime(hour: number, minute: number, dayOfWeek: 1 | 2 | 3 | 4 | 5 = 3): Date {
  // Find the next Wednesday (day=3) or given day, then set the time
  const base = new Date('2024-01-03T12:00:00Z') // a Wednesday in ET
  const offset = (dayOfWeek - 3 + 7) % 7
  base.setUTCDate(base.getUTCDate() + offset)

  // Convert desired ET time to UTC (ET = UTC-5 in January, EST)
  const utcHour = hour + 5  // EST = UTC-5
  base.setUTCHours(utcHour, minute, 0, 0)
  return base
}

describe('getTradingWindow', () => {
  it('returns opening_prohibited for 09:30–09:59 ET', () => {
    expect(getTradingWindow(etTime(9, 30))).toBe('opening_prohibited')
    expect(getTradingWindow(etTime(9, 45))).toBe('opening_prohibited')
    expect(getTradingWindow(etTime(9, 59))).toBe('opening_prohibited')
  })

  it('returns preferred_morning for 10:00–11:29 ET', () => {
    expect(getTradingWindow(etTime(10, 0))).toBe('preferred_morning')
    expect(getTradingWindow(etTime(11, 0))).toBe('preferred_morning')
    expect(getTradingWindow(etTime(11, 29))).toBe('preferred_morning')
  })

  it('returns caution_midday for 11:30–13:29 ET', () => {
    expect(getTradingWindow(etTime(11, 30))).toBe('caution_midday')
    expect(getTradingWindow(etTime(12, 30))).toBe('caution_midday')
    expect(getTradingWindow(etTime(13, 29))).toBe('caution_midday')
  })

  it('returns preferred_afternoon for 13:30–15:59 ET', () => {
    expect(getTradingWindow(etTime(13, 30))).toBe('preferred_afternoon')
    expect(getTradingWindow(etTime(14, 30))).toBe('preferred_afternoon')
    expect(getTradingWindow(etTime(15, 59))).toBe('preferred_afternoon')
  })

  it('returns after_hours for 16:00+ ET', () => {
    expect(getTradingWindow(etTime(16, 0))).toBe('after_hours')
    expect(getTradingWindow(etTime(20, 0))).toBe('after_hours')
  })

  it('returns pre_market before 09:30 ET', () => {
    expect(getTradingWindow(etTime(8, 0))).toBe('pre_market')
    expect(getTradingWindow(etTime(9, 29))).toBe('pre_market')
  })

  it('returns friday_prohibited on Friday after 14:00 ET', () => {
    expect(getTradingWindow(etTime(14, 0, 5))).toBe('friday_prohibited')
    expect(getTradingWindow(etTime(15, 30, 5))).toBe('friday_prohibited')
  })

  it('returns preferred_afternoon on Friday before 14:00 ET', () => {
    expect(getTradingWindow(etTime(13, 30, 5))).toBe('preferred_afternoon')
  })

  it('returns market_closed on weekends', () => {
    // Saturday
    const saturday = new Date('2024-01-06T15:00:00Z')
    expect(getTradingWindow(saturday)).toBe('market_closed')

    // Sunday
    const sunday = new Date('2024-01-07T15:00:00Z')
    expect(getTradingWindow(sunday)).toBe('market_closed')
  })
})

describe('isTradingProhibited', () => {
  it('flags opening_prohibited as prohibited', () => {
    expect(isTradingProhibited('opening_prohibited')).toBe(true)
  })

  it('flags friday_prohibited as prohibited', () => {
    expect(isTradingProhibited('friday_prohibited')).toBe(true)
  })

  it('does not flag preferred windows as prohibited', () => {
    expect(isTradingProhibited('preferred_morning')).toBe(false)
    expect(isTradingProhibited('preferred_afternoon')).toBe(false)
  })

  it('does not flag caution windows as prohibited', () => {
    expect(isTradingProhibited('caution_midday')).toBe(false)
  })
})

describe('isHighCaution', () => {
  it('flags caution_midday', () => {
    expect(isHighCaution('caution_midday')).toBe(true)
  })

  it('does not flag preferred windows', () => {
    expect(isHighCaution('preferred_morning')).toBe(false)
    expect(isHighCaution('preferred_afternoon')).toBe(false)
  })
})
