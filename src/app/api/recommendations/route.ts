export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const CloseRecSchema = z.object({
  closeReason: z.enum(['TARGET_REACHED', 'INVALIDATED', 'EXPIRED', 'EARNINGS_RISK', 'MANUAL']),
  closePrice:  z.number().positive().optional(),
  notes:       z.string().max(500).optional(),
})

async function getUserId() {
  const user = await db.user.findFirst({ select: { id: true } })
  return user?.id
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const where: Record<string, unknown> = { userId }
  if (status === 'open')   where.status = 'OPEN'
  if (status === 'closed') where.status = 'CLOSED'

  await db.recommendation.updateMany({
    where: { userId, status: 'OPEN', expiresAt: { lte: new Date() } },
    data:  { status: 'CLOSED', closeReason: 'EXPIRED', closedAt: new Date() },
  })

  const recs = await db.recommendation.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      candidate: {
        select: { rsi: true, ema20: true, ema50: true, sector: true, dist52wh: true, score: true }
      },
    },
  })

  return NextResponse.json({ recommendations: recs })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const recId = searchParams.get('id')
  if (!recId) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CloseRecSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const rec = await db.recommendation.findFirst({ where: { id: recId, userId } })
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { closeReason, closePrice, notes } = parsed.data
  let pct: number | undefined
  if (closePrice) {
    pct = ((closePrice - rec.baselinePrice) / rec.baselinePrice) * 100
  }

  const updated = await db.recommendation.update({
    where: { id: recId },
    data: {
      status:      'CLOSED',
      closeReason,
      closePrice:  closePrice ?? null,
      pct:         pct ?? null,
      closedAt:    new Date(),
      notes:       notes ?? null,
    },
  })

  return NextResponse.json({ recommendation: updated })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const recId = searchParams.get('id')
  if (!recId) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const rec = await db.recommendation.findFirst({ where: { id: recId, userId } })
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.recommendation.delete({ where: { id: recId } })
  return NextResponse.json({ ok: true })
}
