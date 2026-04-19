export const dynamic = 'force-dynamic'

/**
 * POST /api/screen/upload
 * Accepts a multipart/form-data CSV file.
 * Runs full validation → filter → rank → persist pipeline.
 * Returns session ID + validation report + top candidates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getUserSettings } from '@/lib/session'
import { db } from '@/lib/db'
import { validateCsvImport, buildValidationReport } from '@/features/screener/validation'
import { applyScreenerFilters } from '@/features/screener/filters'
import { rankCandidates } from '@/features/screener/ranking'
import { RECOMMENDATIONS } from '@/constants/screener'
import { addCalendarDays } from '@/lib/dateUtils'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  // ── Parse multipart form ──────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded. Include a CSV as "file" field.' }, { status: 400 })
  }

  const csvFile = file as File
  if (!csvFile.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'Only .csv files are accepted.' }, { status: 400 })
  }

  const MAX_SIZE = 5 * 1024 * 1024 // 5MB
  if (csvFile.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
  }

  const buffer = Buffer.from(await csvFile.arrayBuffer())

  // ── Validate CSV ──────────────────────────────────────────────────────────
  const validationResult = validateCsvImport(buffer)

  if ('fatalError' in validationResult) {
    return NextResponse.json({ error: validationResult.fatalError }, { status: 422 })
  }

  const { mapping, valid: canonicalRows, rowErrors, totalRows } = validationResult

  // ── Apply screener filters ────────────────────────────────────────────────
  const { passing, drops } = applyScreenerFilters(canonicalRows)

  // ── Rank passing candidates ───────────────────────────────────────────────
  const ranked = rankCandidates(passing)

  // ── Build validation report ───────────────────────────────────────────────
  const report = buildValidationReport(
    totalRows,
    canonicalRows.length,
    passing.length,
    mapping,
    rowErrors,
    drops,
  )

  // ── Persist to database ───────────────────────────────────────────────────
  const screenSession = await db.screenSession.create({
    data: {
      userId,
      filename:              csvFile.name,
      sourceName:            'TradingView',
      uploadedAt:            new Date(),
      totalRows,
      validRows:             canonicalRows.length,
      passedRows:            passing.length,
      mappingJson:           mapping.resolved,
      validationSummaryJson: report,
    },
  })

  // Persist all passing candidates
  const candidateRecords = await Promise.all(
    ranked.map(async (c) => {
      // Parse earnings date to DateTime
      let earningsDate: Date | null = null
      if (c.upcomingEarningsDate) {
        const d = new Date(c.upcomingEarningsDate)
        if (!isNaN(d.getTime())) earningsDate = d
      }

      return db.screenCandidate.create({
        data: {
          userId,
          sessionId:    screenSession.id,
          sym:          c.symbol,
          description:  c.description ?? null,
          price:        c.price,
          rsi:          c.rsi14 ?? null,
          ema20:        c.ema20 ?? null,
          ema50:        c.ema50 ?? null,
          sma50:        c.sma50 ?? null,
          relVol:       c.relativeVolume ?? null,
          volume:       c.volume ?? null,
          sector:       c.sector ?? null,
          marketCap:    c.marketCap ?? null,
          earningsRaw:  c.upcomingEarningsDate ?? null,
          earningsDate,
          chg1w:        c.chg1w ?? null,
          high52w:      c.high52w ?? null,
          dist52wh:     c.dist52wh ?? null,
          score:        c.score,
          rank:         c.rank ?? null,
        },
      })
    })
  )

  // ── Create Picks + Recommendations for top N ──────────────────────────────
  const topN = ranked.slice(0, RECOMMENDATIONS.AUTO_CREATE_TOP_N)

  for (let i = 0; i < topN.length; i++) {
    const candidate = topN[i]
    const dbCandidate = candidateRecords.find(r => r.sym === candidate.symbol)
    if (!dbCandidate) continue

    // Create Pick
    await db.pick.create({
      data: {
        userId,
        sessionId:   screenSession.id,
        candidateId: dbCandidate.id,
        rank:        i + 1,
      },
    })

    // Deduplicate recommendations — skip if same sym has OPEN rec in current week
    const existingRec = await db.recommendation.findFirst({
      where: {
        userId,
        sym:    candidate.symbol,
        status: 'OPEN',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    })

    if (!existingRec) {
      await db.recommendation.create({
        data: {
          userId,
          candidateId:   dbCandidate.id,
          sym:           candidate.symbol,
          description:   candidate.description ?? null,
          baselinePrice: candidate.price,
          expiresAt:     new Date(Date.now() + RECOMMENDATIONS.EXPIRY_CALENDAR_DAYS * 24 * 60 * 60 * 1000),
          status:        'OPEN',
        },
      })
    }
  }

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    sessionId:   screenSession.id,
    report,
    topCandidates: topN.map(c => ({
      sym:          c.symbol,
      description:  c.description,
      price:        c.price,
      rsi:          c.rsi14,
      ema20:        c.ema20,
      ema50:        c.ema50,
      relVol:       c.relativeVolume,
      dist52wh:     c.dist52wh,
      chg1w:        c.chg1w,
      sector:       c.sector,
      earningsDate: c.upcomingEarningsDate,
      score:        c.score,
      rank:         c.rank,
    })),
  })
}

