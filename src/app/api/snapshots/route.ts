export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function getUserId() {
  const user = await db.user.findFirst({ select: { id: true } })
  return user?.id
}

// GET /api/snapshots?sessionId=xxx
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ snapshots: [] })

  const sessionId = new URL(req.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const candidates = await db.screenCandidate.findMany({
    where: { sessionId, userId },
    select: { id: true },
  })
  const candidateIds = candidates.map(c => c.id)

  const snapshots = await db.candidatePerformanceSnapshot.findMany({
    where: { candidateId: { in: candidateIds }, userId },
    select: { candidateId: true, snapshotDay: true, closePrice: true, pctFromScreen: true },
  })

  return NextResponse.json({ snapshots })
}

// POST /api/snapshots  { candidateId, snapshotDay, closePrice, screenPrice }
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { candidateId, snapshotDay, closePrice, screenPrice } = body

  if (!candidateId || !snapshotDay || closePrice == null || screenPrice == null)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const pctFromScreen = ((closePrice - screenPrice) / screenPrice) * 100

  const snapshot = await db.candidatePerformanceSnapshot.upsert({
    where:  { candidateId_snapshotDay: { candidateId, snapshotDay } },
    update: { closePrice, pctFromScreen },
    create: { userId, candidateId, snapshotDay, closePrice, pctFromScreen },
  })

  return NextResponse.json({ snapshot })
}

// DELETE /api/snapshots?candidateId=xxx&snapshotDay=1
export async function DELETE(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const candidateId = searchParams.get('candidateId')
  const snapshotDay = parseInt(searchParams.get('snapshotDay') ?? '')

  if (!candidateId || !snapshotDay)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  await db.candidatePerformanceSnapshot.deleteMany({
    where: { candidateId, snapshotDay, userId },
  })

  return NextResponse.json({ ok: true })
}
