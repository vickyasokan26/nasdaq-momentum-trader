/**
 * Shared date utilities — used across API routes and features.
 */

/** Add N calendar days to a Date (timezone-safe, no DST edge cases). */
export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
