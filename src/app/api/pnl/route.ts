export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserSettings } from '@/lib/session'
import { db } from '@/lib/db'
import { calcDayPnl, calcWeekPnl, calcDrawdownStatus } from '@/features/pnl/calculations'
import { getWeekStart } from '@/lib/timezone'
import { z } from 'zod'

async function getUserId() {
  const user = await db.user.findFirst({ select: { id: true } })
  return user?.id
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

  const settings = await getUserSettings(userId)
  const now      = new Date()

  const trades = await db.trade.findMany({
    where:  { userId, status: 'CLOSED' },
    select: { closedAt: true, pnlEur: true, status: true },
  })

  const dailySystem  = calcDayPnl(trades, now)
  const weekStart    = getWeekStart(now)
  const weeklySystem = calcWeekPnl(trades, weekStart)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const todayPnl = await db.dailyPnl.findUnique({
    where: { userId_pnlDate: { userId, pnlDate: today } },
  })

  const manualAdj = todayPnl?.manualAdjustmentEur ?? 0
  const dailyNet  = dailySystem + manualAdj

  const drawdown = calcDrawdownStatus(dailyNet, weeklySystem, {
    maxDailyLossEur:  settings.maxDailyLossEur,
    maxWeeklyLossEur: settings.maxWeeklyLossEur,
  })

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

const AdjSchema = z.object({ adjustmentEur: z.number() })

export async function PATCH(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

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
      pnlDate:             today,
      systemPnlEur:        0,
      manualAdjustmentEur: parsed.data.adjustmentEur,
      netPnlEur:           parsed.data.adjustmentEur,
    },
    update: {
      manualAdjustmentEur: parsed.data.adjustmentEur,
      netPnlEur:           { set: 0 },
    },
  })

  return NextResponse.json({ record })
}