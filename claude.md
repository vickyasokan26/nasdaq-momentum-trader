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

**Important styling rule:** Tailwind now compiles correctly (fixed 2026-06-20 — see
"Known issues" below). Most existing pages still get their visual design from named
classes in `src/app/globals.css` plus inline `style={{ color: 'var(--green)' }}`-style
overrides, and that pattern is still the convention to follow for consistency in files
that already use it (sidebar shell, tables, modals, charts). New Tailwind utility
classes are no longer something to actively avoid, but don't rewrite working
globals.css-based code to Tailwind just for its own sake.

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
- **Tailwind silently didn't compile at all (fixed 2026-06-20):** the project was
  missing `postcss.config.js` — without it, Next.js never ran Tailwind through
  PostCSS, so `@tailwind base/components/utilities` in `globals.css` were inert and
  every Tailwind utility class (`flex`, `grid`, `bg-desk-surface`, `text-gain`,
  `font-mono`, all of it) silently rendered as a no-op everywhere it was used — no
  build error, just missing styles. This is what the old "Tailwind JIT unreliable"
  guidance was actually describing. Root cause confirmed by checking
  `document.styleSheets` for `.flex`/`.grid` rules (none existed) and fixed by adding
  `postcss.config.js` with the standard `tailwindcss`+`autoprefixer` plugins. That
  surfaced one more bug: `globals.css` had the Google Fonts `@import` *after* the
  `@tailwind` directives, which is a CSS spec violation once Tailwind actually
  expands into real rules — `@import` must come first. Both are fixed now; verified
  with a clean `npm run build`. **Do not delete `postcss.config.js`** or move the
  font `@import` back below the `@tailwind` lines — either one silently breaks all
  Tailwind styling again with no build-time warning.
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

Mobile: `.shell`/`.sidebar` collapse into an off-canvas drawer below 860px
(`.sidebar-toggle` hamburger button + `.sidebar-backdrop`, state lives in
`(dashboard)/layout.tsx`). `.responsive-grid-2/3`, `.chart-grid-2/3/4`,
`.history-layout`, `.dashboard-top-row` are reusable grids that collapse to fewer
columns at narrower viewports — prefer reusing one of these over inventing a new
inline `gridTemplateColumns` when adding a page-level layout grid.

Design tokens are CSS variables on `:root` — use `var(--green)`, `var(--red)`,
`var(--amber)`, `var(--blue)`, `var(--bg)`, `var(--bg2)`, `var(--bg3)` etc. Tailwind
color tokens (`text-gain`, `bg-desk-surface`) now compile fine (see "Known issues"),
but most existing components still use inline `style={{ color: 'var(--green)' }}` or
a named globals.css class for these — match the surrounding file's convention rather
than mixing both approaches in the same component.

---

## Testing

178 tests covering all core business logic. Run before any change to strategy logic:
```bash
npm test
```
Never break passing tests. If a strategy constant changes, update tests to match.

---

## What NOT to do

- Do not suggest changes to Phase 2 or Phase 3 features (locked)
- Do not use `split(',')` to parse CSV data
- Do not delete `postcss.config.js` or move the font `@import` below the `@tailwind`
  directives in globals.css — see "Known issues" above
- Do not modify `src/constants/screener.ts` without explicit user confirmation
- The Insights page's "scoring tweak suggestions" (`features/insights/analyze.ts`)
  are observational only — never wire up an "apply" action that writes to
  screener.ts automatically, even if asked for convenience. Confirm explicitly first.
- Do not analyse or trade stocks that didn't come from the screener CSV
- Biotech/pharma: AI news scan is unreliable for binary events — always flag for
  manual TradingView news tab check