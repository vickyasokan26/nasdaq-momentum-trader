export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/register
 * One-time route to create the single user account.
 * Blocked once a user exists — no public registration.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(12),
  name:     z.string().min(1).max(100).optional(),
  setupKey: z.string(), // must match SETUP_KEY env var
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  // Verify setup key — prevents anyone from calling this in production
  const setupKey = process.env.SETUP_KEY
  if (!setupKey || parsed.data.setupKey !== setupKey) {
    return NextResponse.json({ error: 'Invalid setup key' }, { status: 403 })
  }

  // Block if any user already exists
  const existingCount = await db.user.count()
  if (existingCount > 0) {
    return NextResponse.json({ error: 'Application already configured. Registration is closed.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const user = await db.user.create({
    data: {
      email:        parsed.data.email.toLowerCase().trim(),
      passwordHash,
      name:         parsed.data.name ?? null,
    },
  })

  // Create default settings
  await db.userSettings.create({ data: { userId: user.id } })

  return NextResponse.json({ ok: true, userId: user.id }, { status: 201 })
}
