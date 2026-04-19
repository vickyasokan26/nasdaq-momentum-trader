export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getUserSettings } from '@/lib/session'
import { calculatePositionSize } from '@/features/trades/sizing'
import { getTradingWindow } from '@/lib/timezone'
import { z } from 'zod'

const SizerSchema = z.object({
  entryPrice: z.number().positive(),
  stopPrice:  z.number().positive(),
  t1Price:    z.number().positive(),
  t2Price:    z.number().positive().optional(),
  riskEur:    z.number().positive().max(50),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId   = session!.user.id
  const settings = await getUserSettings(userId)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SizerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const result = calculatePositionSize({
    ...parsed.data,
    accountSizeEur: settings.accountSizeEur,
  })

  const window = getTradingWindow(new Date())

  return NextResponse.json({ ...result, tradingWindow: window })
}
