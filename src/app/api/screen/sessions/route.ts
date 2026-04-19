export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  const sessions = await db.screenSession.findMany({
    where: { userId },
    orderBy: { uploadedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      filename: true,
      sourceName: true,
      uploadedAt: true,
      totalRows: true,
      validRows: true,
      passedRows: true,
      validationSummaryJson: true,
      _count: { select: { picks: true } },
    },
  })

  return NextResponse.json({ sessions })
}
