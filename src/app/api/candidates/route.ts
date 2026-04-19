export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function getUserId() {
  const user = await db.user.findFirst({ select: { id: true } })
  return user?.id
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ candidates: [], sessionId: null })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const latest    = searchParams.get('latest') === 'true'

  let targetSessionId = sessionId

  if (!targetSessionId || latest) {
    const latestSession = await db.screenSession.findFirst({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true },
    })
    if (!latestSession) return NextResponse.json({ candidates: [], sessionId: null })
    targetSessionId = latestSession.id
  }

  const sess = await db.screenSession.findFirst({
    where: { id: targetSessionId, userId },
    select: { id: true, uploadedAt: true, filename: true },
  })
  if (!sess) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const candidates = await db.screenCandidate.findMany({
    where: { sessionId: targetSessionId, userId },
    orderBy: [{ rank: 'asc' }, { score: 'desc' }],
  })

  return NextResponse.json({ candidates, session: sess })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No user found