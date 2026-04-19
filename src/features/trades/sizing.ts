/**
 * Position Sizing Engine
 *
 * Rules:
 * - Risk amount is fixed (€10–14)
 * - Stop distance is variable (structure-based, never fixed %)
 * - Position size adjusts to maintain fixed risk
 * - Hard cap at 85% of account
 * - Warns on tight stops (< 1%) and poor R:R (< 2)
 */

import { differenceInCalendarDays } from 'date-fns'
import type { SizingInput, SizingResult } from '@/types'
import { ACCOUNT } from '@/constants/screener'

export function calculatePositionSize(input: SizingInput): SizingResult {
  const { entryPrice, stopPrice, t1Price, t2Price, riskEur, accountSizeEur } = input
  const warnings: string[] = []

  // Validate inputs
  if (stopPrice >= entryPrice) {
    warnings.push('Stop price must be BELOW entry price for a long trade')
  }
  if (t1Price <= entryPrice) {
    warnings.push('Target 1 must be ABOVE entry price')
  }

  const stopDistancePct = ((entryPrice - stopPrice) / entryPrice) * 100

  // Warn on tight stop — prime territory for wick-outs and stop hunts
  if (stopDistancePct < ACCOUNT.MIN_STOP_DISTANCE_PCT) {
    warnings.push(
      `Stop distance ${stopDistancePct.toFixed(2)}% is below minimum ${ACCOUNT.MIN_STOP_DISTANCE_PCT}%. ` +
      `This stop WILL be hunted. Find a wider structural level or skip this trade.`
    )
  }

  // Warn on round number stops
  const stopRounded = Math.round(stopPrice)
  if (Math.abs(stopPrice - stopRounded) < 0.05) {
    warnings.push(
      `Stop at $${stopPrice.toFixed(2)} is near round number $${stopRounded}. ` +
      `Institutions sweep round numbers first. Move stop 0.5–0.75% below it.`
    )
  }

  // Calculate raw position size
  const stopDistanceFraction = stopDistancePct / 100
  let positionValueEur = stopDistanceFraction > 0
    ? riskEur / stopDistanceFraction
    : 0

  // Cap at 85% of account
  const maxPositionEur = accountSizeEur * ACCOUNT.MAX_POSITION_PCT
  const wasCapped = positionValueEur > maxPositionEur
  const cappedValueEur = Math.min(positionValueEur, maxPositionEur)

  if (wasCapped) {
    warnings.push(
      `Position capped at €${cappedValueEur.toFixed(0)} (85% of account). ` +
      `Actual risk reduced to €${((cappedValueEur * stopDistanceFraction)).toFixed(2)}.`
    )
  }

  // Calculate shares (whole numbers only — no fractional shares)
  const shares = Math.floor(cappedValueEur / entryPrice)
  const actualRiskEur = shares * entryPrice * stopDistanceFraction

  // Reward:Risk calculations
  const gainToT1 = ((t1Price - entryPrice) / entryPrice) * 100
  const rrToT1 = stopDistancePct > 0 ? gainToT1 / stopDistancePct : 0

  let rrToT2: number | undefined
  if (t2Price !== undefined && t2Price > entryPrice) {
    const gainToT2 = ((t2Price - entryPrice) / entryPrice) * 100
    rrToT2 = stopDistancePct > 0 ? gainToT2 / stopDistancePct : 0
  }

  // R:R warnings
  if (rrToT1 < ACCOUNT.MIN_RR) {
    warnings.push(
      `R:R to T1 is ${rrToT1.toFixed(1)}:1 — below minimum ${ACCOUNT.MIN_RR}:1. ` +
      `DO NOT ENTER. Move T1 higher or widen stop distance.`
    )
  } else if (rrToT1 < ACCOUNT.PREFERRED_RR) {
    warnings.push(`R:R to T1 is ${rrToT1.toFixed(1)}:1 — acceptable but below preferred ${ACCOUNT.PREFERRED_RR}:1.`)
  }

  // Risk amount warnings
  if (riskEur > ACCOUNT.MAX_RISK_EUR) {
    warnings.push(`Risk €${riskEur.toFixed(2)} exceeds maximum €${ACCOUNT.MAX_RISK_EUR}. Reduce risk input.`)
  }

  if (shares === 0) {
    warnings.push('Position size rounds to 0 shares — entry price too high or stop too wide for this account size.')
  }

  return {
    stopDistancePct,
    positionValueEur,
    cappedValueEur,
    wasCapped,
    actualRiskEur,
    shares,
    rrToT1,
    rrToT2,
    warnings,
  }
}

/** Validate trade entry against all hard rules. Returns rule break descriptions. */
export function detectRuleBreaks(input: {
  sym:            string
  entryPrice:     number
  stopPrice:      number
  t1Price:        number
  riskEur:        number
  accountSizeEur: number
  tradingWindow?: import('@/lib/timezone').TradingWindow
  earningsDate?:  Date | null
  chg1w?:         number
  rsi14?:         number
}): string[] {
  const breaks: string[] = []

  const stopDistancePct = ((input.entryPrice - input.stopPrice) / input.entryPrice) * 100
  const rrToT1 = ((input.t1Price - input.entryPrice) / input.entryPrice) / (stopDistancePct / 100)

  if (stopDistancePct < 1) {
    breaks.push(`STOP_TOO_TIGHT: ${stopDistancePct.toFixed(2)}%`)
  }
  if (rrToT1 < 2) {
    breaks.push(`RR_BELOW_MIN: ${rrToT1.toFixed(1)}:1`)
  }
  if (input.riskEur > ACCOUNT.MAX_RISK_EUR) {
    breaks.push(`RISK_EXCEEDED: €${input.riskEur.toFixed(2)} > €${ACCOUNT.MAX_RISK_EUR}`)
  }
  if (input.tradingWindow === 'opening_prohibited') {
    breaks.push('PROHIBITED_WINDOW: Opening 30 min (09:30–10:00 ET)')
  }
  if (input.tradingWindow === 'friday_prohibited') {
    breaks.push('PROHIBITED_WINDOW: Friday after 14:00 ET')
  }
  if (input.earningsDate) {
    const daysOut = differenceInCalendarDays(input.earningsDate, new Date())
    if (daysOut >= 0 && daysOut <= 10) {
      breaks.push(`EARNINGS_RISK: ${daysOut} days to earnings`)
    }
  }

  return breaks
}
