export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getUserSettings } from '@/lib/session'
import { db } from '@/lib/db'
import { z } from 'zod'
import { calculatePositionSize, detectRuleBreaks } from '@/features/trades/sizing'
import { getTradingWindow } from '@/lib/timezone'
import { Prisma } from '@prisma/client'


const CreateTradeSchema = z.object({
  sym:        z.string().min(1).max(10).toUpperCase(),
  entryPrice: z.number().positive(),
  stopPrice:  z.number().positive(),
  t1Price:    z.number().positive(),
  t2Price:    z.number().positive().optional(),
  riskEur:    z.number().positive().max(50),
  shares:     z.number().int().positive(),
  notes:      z.string().max(1000).optional(),
  setupQuality: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
})

const CloseTradeSchema = z.object({
  exitPrice:  z.number().positive(),
  exitReason: z.enum(['STOP_HIT', 'TARGET_1', 'TARGET_2', 'TRAILING_STOP', 'MANUAL', 'RULE_VIOLATION', 'EARNINGS_RISK', 'END_OF_WEEK']),
  notes:      z.string().max(1000).optional(),
})

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'open' | 'closed' | null = all

  const where: Record<string, unknown> = { userId }
  if (status === 'open')   where.status = 'OPEN'
  if (status === 'closed') where.status = 'CLOSED'

  const trades = await db.trade.findMany({
    where,
    orderBy: { tradeDate: 'desc' },
  })

  return NextResponse.json({ trades })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const settings = await getUserSettings(userId)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateTradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const data = parsed.data

  // Validate sizing
  const sizing = calculatePositionSize({
    entryPrice:     data.entryPrice,
    stopPrice:      data.stopPrice,
    t1Price:        data.t1Price,
    t2Price:        data.t2Price,
    riskEur:        data.riskEur,
    accountSizeEur: settings.accountSizeEur,
  })

  // Detect rule breaks
  const tradingWindow = getTradingWindow(new Date())
  const ruleBreaks = detectRuleBreaks({
    sym:            data.sym,
    entryPrice:     data.entryPrice,
    stopPrice:      data.stopPrice,
    t1Price:        data.t1Price,
    riskEur:        data.riskEur,
    accountSizeEur: settings.accountSizeEur,
    tradingWindow,
  })

  const trade = await db.trade.create({
    data: {
      userId,
      tradeDate:     new Date(),
      sym:           data.sym,
      entryPrice:    data.entryPrice,
      stopPrice:     data.stopPrice,
      t1Price:       data.t1Price,
      t2Price:       data.t2Price ?? null,
      riskEur:       data.riskEur,
      shares:        data.shares,
      notes:         data.notes ?? null,
      setupQuality:  data.setupQuality ?? null,
      ruleBreaksJson: ruleBreaks.length > 0 ? ruleBreaks : Prisma.JsonNull,
      status:        'OPEN',
    },
  })

  return NextResponse.json({ trade, sizing, ruleBreaks })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const tradeId = searchParams.get('id')

  if (!tradeId) return NextResponse.json({ error: 'Trade ID required' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CloseTradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  // Verify ownership and get trade
  const existingTrade = await db.trade.findFirst({ where: { id: tradeId, userId } })
  if (!existingTrade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
  if (existingTrade.status === 'CLOSED') return NextResponse.json({ error: 'Trade already closed' }, { status: 409 })

  const { exitPrice, exitReason, notes } = parsed.data

  // P&L = (exit - entry) * shares (long-only in Phase 1)
  const pnlEur = (exitPrice - existingTrade.entryPrice) * existingTrade.shares

  const trade = await db.trade.update({
    where: { id: tradeId },
    data: {
      status:     'CLOSED',
      exitPrice,
      exitReason,
      pnlEur,
      closedAt:   new Date(),
      notes:      notes ? `${existingTrade.notes ?? ''}\n\nClose note: ${notes}`.trim() : existingTrade.notes,
    },
  })

  // Upsert daily P&L record
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await db.dailyPnl.upsert({
    where:  { userId_pnlDate: { userId, pnlDate: today } },
    create: { userId, pnlDate: today, systemPnlEur: pnlEur, netPnlEur: pnlEur },
    update: {
      systemPnlEur: { increment: pnlEur },
      netPnlEur:    { increment: pnlEur },
    },
  })

  return NextResponse.json({ trade, pnlEur })
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const tradeId = searchParams.get('id')

  if (!tradeId) return NextResponse.json({ error: 'Trade ID required' }, { status: 400 })

  const trade = await db.trade.findFirst({ where: { id: tradeId, userId } })
  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })

  await db.trade.delete({ where: { id: tradeId } })
  return NextResponse.json({ ok: true })
}
