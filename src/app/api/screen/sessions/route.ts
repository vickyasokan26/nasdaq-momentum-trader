export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function getUserId() {
  const user = await db.user.findFirst({ select: { id: true } })
  return user?.id
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found' }, { status: 401 })

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
