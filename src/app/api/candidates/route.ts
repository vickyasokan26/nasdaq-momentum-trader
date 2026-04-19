export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
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

  // Verify ownership
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
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const { id, candidateState } = body

  const validStates = ['CANDIDATE', 'SETUP_CONFIRMED', 'INVALIDATED', 'TRADED', 'EXPIRED', 'ARCHIVED']
  if (!validStates.includes(candidateState)) {
    return NextResponse.json({ error: 'Invalid candidate state' }, { status: 400 })
  }

  const updated = await db.screenCandidate.updateMany({
    where: { id, userId }, // userId check = authorization
    data: { candidateState },
  })

  if (updated.count === 0) {
    return NextResponse.json({ error: 'Candidate not found or unauthorized' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
