import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { addDays, startOfDay, isWeekend } from 'date-fns'

export const MARKET_TZ = 'America/New_York'
export const USER_TZ   = 'Europe/Amsterdam'

/** Convert a UTC date to ET market time */
export function toMarketTime(date: Date): Date {
  return toZonedTime(date, MARKET_TZ)
}

/** Format a UTC date for display in user timezone */
export function formatUserTime(date: Date, fmt = 'yyyy-MM-dd HH:mm'): string {
  return formatInTimeZone(date, USER_TZ, fmt)
}

/** Format a UTC date for display in market timezone */
export function formatMarketTime(date: Date, fmt = 'yyyy-MM-dd HH:mm'): string {
  return formatInTimeZone(date, MARKET_TZ, fmt)
}

/** Determine if it's currently a prohibited trading window (ET) */
export type TradingWindow =
  | 'pre_market'
  | 'opening_prohibited'  // 09:30–10:00 ET
  | 'preferred_morning'   // 10:00–11:30 ET
  | 'caution_midday'      // 11:30–13:30 ET
  | 'preferred_afternoon' // 13:30–15:00 ET
  | 'friday_prohibited'   // Friday after 14:00 ET
  | 'after_hours'
  | 'market_closed'

export function getTradingWindow(utcDate: Date): TradingWindow {
  const et = toMarketTime(utcDate)
  const hours   = et.getHours()
  const minutes = et.getMinutes()
  const dayOfWeek = et.getDay() // 0=Sun, 5=Fri

  if (isWeekend(et)) return 'market_closed'

  const timeDecimal = hours + minutes / 60

  if (timeDecimal < 9.5)  return 'pre_market'
  if (timeDecimal > 16.0) return 'after_hours'

  // Friday rule: no new entries after 14:00 ET
  if (dayOfWeek === 5 && timeDecimal >= 14.0) return 'friday_prohibited'

  if (timeDecimal >= 9.5  && timeDecimal < 10.0) return 'opening_prohibited'
  if (timeDecimal >= 10.0 && timeDecimal < 11.5) return 'preferred_morning'
  if (timeDecimal >= 11.5 && timeDecimal < 13.5) return 'caution_midday'
  if (timeDecimal >= 13.5 && timeDecimal < 16.0) return 'preferred_afternoon'

  return 'after_hours'
}

export function isTradingProhibited(window: TradingWindow): boolean {
  return window === 'opening_prohibited' || window === 'friday_prohibited'
}

export function isHighCaution(window: TradingWindow): boolean {
  return window === 'caution_midday'
}

/** Get N market days ahead (skip weekends, rough — not holiday-aware) */
export function addMarketDays(date: Date, n: number): Date {
  let result = startOfDay(date)
  let added = 0
  while (added < n) {
    result = addDays(result, 1)
    if (!isWeekend(result)) added++
  }
  return result
}

/** Get the start of the current trading week (Monday) */
export function getWeekStart(date: Date): Date {
  const et = toMarketTime(date)
  const day = et.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = addDays(startOfDay(et), diff)
  return monday
}
