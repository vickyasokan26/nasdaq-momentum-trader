export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getUserSettings } from '@/lib/session'
import { db } from '@/lib/db'
import { z } from 'zod'
import type { NewsScanResult } from '@/types'

const ScanSchema = z.object({
  symbols: z.array(z.string().max(10)).min(1).max(10),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId   = session!.user.id
  const settings = await getUserSettings(userId)

  if (!settings.newsScanEnabled) {
    return NextResponse.json({ error: 'News scan disabled in settings' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ScanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const { symbols } = parsed.data
  const results: NewsScanResult[] = []

  for (const sym of symbols) {
    try {
      const result = await scanSymbol(sym)
      results.push(result)
    } catch (err) {
      // Do not fail the whole batch on one symbol failure
      results.push({
        sym,
        riskLevel:    'unknown',
        catalystType: 'none_found',
        confidence:   'low',
        summary:      'News scan unavailable for this symbol.',
        scannedAt:    new Date().toISOString(),
      })
    }
  }

  // Persist results to pick records where applicable
  for (const result of results) {
    await db.pick.updateMany({
      where: {
        userId,
        candidate: { sym: result.sym },
        session:   { uploadedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      },
      data: {
        newsFlag:        result.riskLevel === 'high',
        newsSummary:     result.summary,
        newsRiskLevel:   result.riskLevel,
        newsCatalystType: result.catalystType,
        newsConfidence:  result.confidence,
      },
    })
  }

  return NextResponse.json({ results })
}

async function scanSymbol(sym: string): Promise<NewsScanResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const prompt = `You are a professional equity analyst monitoring risk for a NASDAQ momentum trading desk.

Assess the current news risk for ${sym} (NASDAQ-listed stock).

Return ONLY a valid JSON object with these exact fields, no markdown, no preamble:
{
  "risk_level": "high" | "medium" | "low" | "unknown",
  "catalyst_type": "earnings" | "legal" | "analyst" | "product" | "macro" | "none_found" | "other",
  "confidence": "high" | "medium" | "low",
  "summary": "<one concise sentence describing the primary risk or lack of it>"
}

Definitions:
- risk_level high: active news that could cause >5% move (earnings upcoming, legal action, major product issue, macro shock)
- risk_level medium: moderate news noise, analyst updates, sector rotation
- risk_level low: no material news, quiet name
- catalyst_type earnings: only if earnings announcement is within 10 calendar days
- confidence: your confidence in the assessment given available data`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 256,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
      }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`API error: ${response.status}`)

  const data = await response.json()
  const text = data.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')

  const cleaned = text.replace(/```json|```/g, '').trim()
  const parsed  = JSON.parse(cleaned)

  return {
    sym,
    riskLevel:    parsed.risk_level    ?? 'unknown',
    catalystType: parsed.catalyst_type ?? 'none_found',
    confidence:   parsed.confidence    ?? 'low',
    summary:      parsed.summary       ?? 'No summary available.',
    scannedAt:    new Date().toISOString(),
  }
}
