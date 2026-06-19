# CLAUDE.md — NASDAQ Momentum Desk

Agentic context file. Read this at the start of every session.

---

## What this app is

A private web app for a NASDAQ momentum swing trader (€700 account, Netherlands).
It processes TradingView CSV exports, scores and ranks candidates, sizes positions,
tracks trades and P&L, and enforces hard drawdown guardrails.
Target: €20–30/day profit. One trade at a time.

---

## Tech stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Framework  | Next.js 14 (App Router, TypeScript)             |
| Styling    | Tailwind CSS + custom CSS classes in globals.css |
| ORM        | Prisma + PostgreSQL (Neon free tier)            |
| Auth       | NextAuth.js (bcrypt broken — login disabled)    |
| Hosting    | Vercel                                          |
| AI scan    | Anthropic API (news risk scanning)              |
| Charts     | TradingView Plus (manual, external)             |

**Important styling rule:** Tailwind JIT does not reliably compile all classes in this
environment. All structural layout and component-specific styles live in
`src/app/globals.css` as named CSS classes. Components reference those class names
directly. Do NOT introduce new Tailwind structural classes (flex, grid, w-[], h-[])
in layout or complex components — add CSS classes to globals.css instead.

---

## Key file locations

```
src/
  app/
    globals.css                        ← ALL CSS. Layout + component styles live here.
    layout.tsx                         ← Root layout (fonts, providers)
    (dashboard)/
      layout.tsx                       ← Sidebar shell — uses .shell .sidebar CSS classes
      dashboard/page.tsx
      candidates/page.tsx
      trades/page.tsx
      recommendations/page.tsx
      sizer/page.tsx
      history/page.tsx
      settings/page.tsx
      insights/page.tsx                ← Read-only analytics: win rate, R-multiple,
                                          rule-break frequency, scoring-tweak suggestions
  components/
    candidates/CandidatesTable.tsx     ← Main candidates table + VerdictPanel
    pnl/DrawdownBar.tsx                ← Drawdown guardrail indicator
    charts/                            ← recharts wrappers (dashboard/candidates/history/insights)
    ui/Modal.tsx
  constants/
    screener.ts                        ← ALL strategy constants. Single source of truth.
  features/
    screener/filters.ts                ← 9-filter screener engine
    screener/ranking.ts                ← Scoring and ranking
    screener/validation.ts             ← CSV column alias mapping
    trades/sizing.ts                   ← Position sizing with R:R enforcement
    pnl/calculations.ts                ← P&L and drawdown calculations
    insights/analyze.ts                ← Read-only outcome analytics — never writes to
                                          screener.ts, never auto-applies anything
  types/index.ts                       ← All shared TypeScript types
  lib/
    db.ts                              ← Prisma client
    auth.ts                            ← Auth helpers (currently bypassed)
prisma/schema.prisma                   ← Database schema
```

---

## Strategy constants (source of truth: src/constants/screener.ts)

**Screener filters:**
- Price > $10, market cap > $500M (non-negotiable)
- RSI 45–75, price > SMA50, EMA20 > EMA50
- RelVol > 0.8, avg 10D volume > 500K
- 52W high distance: 3–20% below (no ATH entries)
- Weekly spike guard: exclude 1W change > 20%
- Earnings blackout: skip if earnings within 10 calendar days
- Manual gate: stock up 100%+ over past 12 months
- Sector cap: max 2 picks per sector

**Risk / sizing:**
- Risk per trade: €10–14 (default €12)
- Max daily loss: €21 (3%). Max weekly loss: €42 (6%). Hard stops — no trading after.
- Min R:R 2:1, preferred 3:1
- Stop: 0.5–0.75% below structural support — never at round numbers

**Entry trigger (1H, all three required):**
- Price retesting EMA20 or EMA50 from above and holding
- RSI above 50 with higher lows over last 3 completed candles
- Volume on last 3 completed 1H candles > 10D average (same timeframe)

**Session rules:**
- Blackout: 15:30–16:00 CET (open), 17:30–19:30 CET (US lunch)
- Entry windows: 16:00–17:30 and 19:30–21:00 CET
- No entries Friday after 20:00 CET
- No entries without a plan locked before 15:30 CET

---

## Active backlog (do not work on locked items)

| # | Item                         | Status         |
|---|------------------------------|----------------|
| 1 | Sector cap tiebreaker        | Open (uses CSV order, should use score) |
| 2 | Auth (bcrypt broken)         | Open           |
| 3 | Bid-ask spread < 0.1% check  | Manual only, not in app |
| 4 | Candidates table sector grouping | Low priority |
| 5 | Phase 2: Polygon.io auto-pull | LOCKED until 2 weeks stable |
| 6 | Phase 3: Leaderboard         | LOCKED (needs 4+ weeks data) |

---

## Known issues

- **Auth disabled:** `getUserId()` in `lib/session.ts` uses `findFirst` with no session
  check. Login flow is bypassed as workaround. Do not remove this workaround.
- **Tailwind JIT unreliable:** See styling rule above. Always use globals.css classes
  for layout. Never use arbitrary Tailwind values like `w-[200px]` in layout files.
- **CSV parsing:** TradingView CSVs have Stochastic column headers with internal
  commas. Always use the quoted-field parser in `validation.ts` — never `split(',')`.
- **CSV header format:** TradingView exports indicator headers as
  `"Indicator, param, timeframe"` (e.g. `"Relative strength index, 14, 1 day"`), not
  the parenthetical `"RSI(14)"` style. `detectColumnMapping` normalizes punctuation
  on both sides before matching — don't add a narrow new alias instead of relying on
  that normalization, or the next TradingView column will silently fail to map again.

---

## CSS class naming conventions (globals.css)

| Prefix      | Used for                              |
|-------------|---------------------------------------|
| `.shell`    | Root grid layout                      |
| `.sidebar-` | Sidebar nav elements                  |
| `.acc-`     | Account pill in sidebar footer        |
| `.vp-`      | VerdictPanel and all its children     |
| `.data-table` | Shared table styles                 |

Design tokens are CSS variables on `:root` — use `var(--green)`, `var(--red)`,
`var(--amber)`, `var(--blue)`, `var(--bg)`, `var(--bg2)`, `var(--bg3)` etc.
Tailwind color tokens (`text-gain`, `bg-desk-surface`) are unreliable — prefer
inline `style={{ color: 'var(--green)' }}` or add a named class to globals.css.

---

## Testing

176 tests covering all core business logic. Run before any change to strategy logic:
```bash
npm test
```
Never break passing tests. If a strategy constant changes, update tests to match.

---

## What NOT to do

- Do not suggest changes to Phase 2 or Phase 3 features (locked)
- Do not use `split(',')` to parse CSV data
- Do not add new Tailwind structural classes to layout files
- Do not modify `src/constants/screener.ts` without explicit user confirmation
- The Insights page's "scoring tweak suggestions" (`features/insights/analyze.ts`)
  are observational only — never wire up an "apply" action that writes to
  screener.ts automatically, even if asked for convenience. Confirm explicitly first.
- Do not analyse or trade stocks that didn't come from the screener CSV
- Biotech/pharma: AI news scan is unreliable for binary events — always flag for
  manual TradingView news tab check