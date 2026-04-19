export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getUserSettings } from '@/lib/session'
import { db } from '@/lib/db'
import { calcDayPnl, calcWeekPnl, calcDrawdownStatus } from '@/features/pnl/calculations'
import { getWeekStart } from '@/lib/timezone'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId   = session!.user.id
  const settings = await getUserSettings(userId)
  const now      = new Date()

  // Get all closed trades
  const trades = await db.trade.findMany({
    where:  { userId, status: 'CLOSED' },
    select: { closedAt: true, pnlEur: true, status: true },
  })

  const dailySystem  = calcDayPnl(trades, now)
  const weekStart    = getWeekStart(now)
  const weeklySystem = calcWeekPnl(trades, weekStart)

  // Get any manual adjustments
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const todayPnl = await db.dailyPnl.findUnique({
    where: { userId_pnlDate: { userId, pnlDate: today } },
  })

  const manualAdj    = todayPnl?.manualAdjustmentEur ?? 0
  const dailyNet     = dailySystem + manualAdj

  const drawdown = calcDrawdownStatus(dailyNet, weeklySystem, {
    maxDailyLossEur:  settings.maxDailyLossEur,
    maxWeeklyLossEur: settings.maxWeeklyLossEur,
  })

  // Weekly history (last 10 trading days)
  const weeklyHistory = await db.dailyPnl.findMany({
    where:   { userId },
    orderBy: { pnlDate: 'desc' },
    take:    10,
  })

  return NextResponse.json({
    drawdown,
    settings: {
      accountSizeEur:   settings.accountSizeEur,
      maxDailyLossEur:  settings.maxDailyLossEur,
      maxWeeklyLossEur: settings.maxWeeklyLossEur,
    },
    weeklyHistory,
  })
}

// PATCH — apply a manual adjustment to today's P&L (commissions, etc.)
const AdjSchema = z.object({ adjustmentEur: z.number() })

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AdjSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid adjustment amount' }, { status: 422 })
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const record = await db.dailyPnl.upsert({
    where:  { userId_pnlDate: { userId, pnlDate: today } },
    create: {
      userId,
      pnlDate:            today,
      systemPnlEur:       0,
      manualAdjustmentEur: parsed.data.adjustmentEur,
      netPnlEur:          parsed.data.adjustmentEur,
    },
    update: {
      manualAdjustmentEur: parsed.data.adjustmentEur,
      netPnlEur:           { set: 0 }, // Will be recalculated by GET
    },
  })

  return NextResponse.json({ record })
}
