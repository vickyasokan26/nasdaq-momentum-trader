import { calcVerdict, type Candidate } from '@/components/candidates/CandidatesTable'

const BASE: Candidate = {
  id:             '1',
  sym:            'TEST',
  price:          50,
  rsi:            58,    // mid-range — doesn't trigger the >65 or <52 branches
  ema20:          105,
  ema50:          100,   // emaGap = 5% — clear of the <0.5% and earnings branches
  relVol:         1.2,
  earningsDate:   null,  // no upcoming earnings — daysUntilEarnings() => 999
  score:          50,
  candidateState: 'CANDIDATE',
}

function make(overrides: Partial<Candidate>): Candidate {
  return { ...BASE, ...overrides }
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString()
}

describe('calcVerdict', () => {
  // ── SKIP ───────────────────────────────────────────────────────────────────

  it('SKIPs when price > $100 and relative volume is below 0.8x (account size constraint)', () => {
    const v = calcVerdict(make({ price: 150, relVol: 0.5 }))
    expect(v.v).toBe('SKIP')
    expect(v.label).toMatch(/account size/i)
  })

  it('reflects the live account size in the SKIP message rather than a hardcoded figure', () => {
    const v = calcVerdict(make({ price: 150, relVol: 0.5 }), 1130)
    expect(v.text).toContain('€1130')
    expect(v.text).toContain('€1500') // next 500-rounded milestone above 1130
    expect(v.text).not.toContain('€700')
  })

  it('defaults to the ACCOUNT.SIZE_EUR constant when no account size is passed', () => {
    const v = calcVerdict(make({ price: 150, relVol: 0.5 }))
    expect(v.text).toContain('€700')
  })

  it('does not trigger the account-size SKIP at exactly $100 (boundary is price > 100)', () => {
    const v = calcVerdict(make({ price: 100, relVol: 0.5 }))
    expect(v.v).not.toBe('SKIP')
  })

  it('SKIPs when earnings fall inside the 10-day blackout window', () => {
    const v = calcVerdict(make({ earningsDate: daysFromNow(5) }))
    expect(v.v).toBe('SKIP')
    expect(v.label).toMatch(/earnings blackout/i)
  })

  it('SKIPs on the blackout boundary at exactly 10 days out', () => {
    const v = calcVerdict(make({ earningsDate: daysFromNow(10) }))
    expect(v.v).toBe('SKIP')
  })

  // ── WAIT ───────────────────────────────────────────────────────────────────

  it('WAITs when the daily EMA 20/50 gap is too thin (< 0.5%)', () => {
    const v = calcVerdict(make({ ema20: 100.3, ema50: 100 }))
    expect(v.v).toBe('WAIT')
    expect(v.label).toMatch(/ema gap/i)
  })

  it('WAITs when earnings are 11-19 days out', () => {
    const v = calcVerdict(make({ earningsDate: daysFromNow(15) }))
    expect(v.v).toBe('WAIT')
    expect(v.label).toMatch(/earnings approaching/i)
  })

  it('treats day 20 as clear of the earnings-approaching WAIT window', () => {
    const v = calcVerdict(make({ earningsDate: daysFromNow(20) }))
    expect(v.v).not.toBe('WAIT')
  })

  it('WAITs when daily RSI is elevated above 65', () => {
    const v = calcVerdict(make({ rsi: 70 }))
    expect(v.v).toBe('WAIT')
    expect(v.label).toMatch(/rsi elevated/i)
  })

  it('does not trigger the elevated-RSI WAIT at exactly 65', () => {
    const v = calcVerdict(make({ rsi: 65 }))
    expect(v.v).not.toBe('WAIT')
  })

  // ── ENTER ──────────────────────────────────────────────────────────────────

  it('ENTERs on a mid-pullback RSI with a clean EMA structure', () => {
    const v = calcVerdict(make({ rsi: 45, ema20: 105, ema50: 100 }))
    expect(v.v).toBe('ENTER')
    expect(v.text).toMatch(/mid-pullback/i)
  })

  it('ENTERs on a clean daily setup outside the mid-pullback RSI range', () => {
    const v = calcVerdict(make({ rsi: 58, ema20: 105, ema50: 100 }))
    expect(v.v).toBe('ENTER')
    expect(v.text).toMatch(/clean daily setup/i)
  })

  // ── Missing data (the column-mapping failure mode) ─────────────────────────

  it('does not SKIP on missing relVol alone when EMA structure is clean', () => {
    // Regression guard: if CSV column mapping silently fails to resolve the
    // relative-volume header, relVol lands here as undefined. That used to be
    // read as "relVol 0" and force a SKIP for any stock priced over $100 —
    // it should instead just skip that gate and fall through normally.
    const v = calcVerdict(make({ price: 369.05, relVol: undefined, ema20: 105, ema50: 100 }))
    expect(v.v).not.toBe('SKIP')
  })

  it('WAITs (not SKIPs) when EMA fields are missing entirely — cannot assess structure', () => {
    // Same column-mapping failure mode, but ema20/ema50 missing too. We can't
    // compute a gap, so the conservative WAIT fallback is correct — it must
    // not be misread as a hard SKIP.
    const v = calcVerdict(make({
      price: 369.05, relVol: undefined, ema20: undefined, ema50: undefined, rsi: undefined,
    }))
    expect(v.v).toBe('WAIT')
  })
})
