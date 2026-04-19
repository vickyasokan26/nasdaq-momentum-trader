import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function getUserSettings(userId: string) {
  const { db } = await import('@/lib/db')
  const settings = await db.userSettings.findUnique({ where: { userId } })
  if (settings) return settings

  // Auto-create default settings on first access
  return db.userSettings.create({
    data: { userId }
  })
}
