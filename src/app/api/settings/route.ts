export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const SettingsSchema = z.object({
  accountSizeEur:     z.number().positive().max(1_000_000).optional(),
  maxRiskPerTradeEur: z.number().positive().max(100).optional(),
  maxDailyLossEur:    z.number().positive().max(10_000).optional(),
  maxWeeklyLossEur:   z.number().positive().max(10_000).optional(),
  newsScanEnabled:    z.boolean().optional(),
  timezone:           z.string().max(50).optional(),
})

async function getUserId() {
  const user = await db.user.findFirst({ select: { id: true } })
  return user?.id
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

  const settings = await db.userSettings.upsert({
    where:  { userId },
    create: { userId },
    update: {},
  })

  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const settings = await db.userSettings.upsert({
    where:  { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  })

  return NextResponse.json({ settings })
}
