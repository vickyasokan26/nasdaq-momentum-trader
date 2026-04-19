# NASDAQ Momentum Desk

Private web application for systematic NASDAQ momentum trading.  
€700 account · €20–30/day target · strict drawdown control.

---

## What it does

- **Import** a TradingView screener CSV on Monday mornings
- **Filter** candidates through a 9-rule screener engine automatically
- **Rank** passing stocks by momentum score
- **Track** app recommendations separately from actual trades (honesty matters)
- **Log** real trades with position sizing, R:R enforcement, and rule-break detection
- **Guard** daily (€21) and weekly (€42) drawdown limits with hard stops
- **Scan** top picks with AI news risk assessment (optional, uses Anthropic API)

---

## Tech Stack

| Layer      | Choice                                |
|------------|---------------------------------------|
| Framework  | Next.js 14 (App Router, TypeScript)   |
| Database   | PostgreSQL via Prisma ORM             |
| Auth       | NextAuth.js (credentials)             |
| Hosting    | Vercel (frontend + API routes)        |
| Database   | Neon / Supabase Postgres / Railway    |
| Styling    | Tailwind CSS                          |

---

## Local Development

### 1. Clone and install

```bash
git clone <your-repo>
cd nasdaq-momentum-desk
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# Neon / Supabase / Railway Postgres connection string
DATABASE_URL="postgresql://..."

# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Anthropic API key for news scan (optional)
ANTHROPIC_API_KEY="sk-ant-..."

# One-time setup key — choose any strong secret
SETUP_KEY="your-one-time-setup-key"
```

### 3. Set up the database

```bash
# Push schema to your database (development)
npx prisma db push

# Or use migrations (recommended for production)
npx prisma migrate dev --name init

# Verify schema
npx prisma studio
```

### 4. Create your user account

This is a single-user private app. Run this **once** to create your account:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-secure-password-12chars+",
    "name": "Trader",
    "setupKey": "your-one-time-setup-key"
  }'
```

After the first user is created, the `/api/auth/register` endpoint returns 409 for all future calls. You cannot accidentally create a second account.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

---

## Production Deployment (Vercel + Neon)

### Step 1 — Database

1. Create a free [Neon](https://neon.tech) project (or use Supabase / Railway)
2. Copy the connection string (with `?sslmode=require`)

### Step 2 — Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or push to GitHub and connect the repo in the Vercel dashboard.

### Step 3 — Environment variables in Vercel

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable            | Value                                  |
|---------------------|----------------------------------------|
| `DATABASE_URL`      | Your Neon connection string            |
| `NEXTAUTH_SECRET`   | 32-char random string                  |
| `NEXTAUTH_URL`      | `https://your-app.vercel.app`          |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (optional)      |
| `SETUP_KEY`         | One-time setup secret (delete after use) |

### Step 4 — Run database migration

After the first deploy, run the migration against your production database:

```bash
DATABASE_URL="your-neon-url" npx prisma migrate deploy
```

Or set `DATABASE_URL` in your shell and run:

```bash
npx prisma db push
```

### Step 5 — Create your production account

```bash
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-secure-password",
    "setupKey": "your-one-time-setup-key"
  }'
```

**Remove `SETUP_KEY` from Vercel env vars immediately after this step.** The endpoint is already blocked after first use, but removing the key adds a second layer.

---

## Weekly Workflow

### Monday morning

1. Export CSV from TradingView → **Universe copy** screener
2. Go to Dashboard → drag-and-drop the CSV onto the upload zone
3. Review validation report (columns mapped, rows filtered)
4. Check top 5 candidates in the Candidates table
5. Open Recommendations page — app has auto-created recs for top 5
6. Run news scan on top 5 (button on Candidates page) if enabled
7. Use Position Sizer to pre-calculate sizes before market open

### During the week

- Watch for 1H EMA pullback entries on watchlist stocks
- Log trades in Trade Log as you enter
- Monitor drawdown bar in sidebar — stop if red

### Friday

- Close any open positions before 14:00 ET (20:00 CET)
- Mark recommendations as closed with outcome
- Review week P&L vs €100–150 target

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Protected app pages
│   │   ├── dashboard/         # Main dashboard
│   │   ├── candidates/        # Ranked candidates table
│   │   ├── recommendations/   # App recommendation tracking
│   │   ├── trades/            # Trade log
│   │   ├── sizer/             # Position sizing calculator
│   │   ├── history/           # Screen session history
│   │   └── settings/          # Account & guardrail settings
│   └── api/                   # API routes
│       ├── auth/              # NextAuth + register
│       ├── screen/upload/     # CSV import pipeline
│       ├── candidates/        # Candidate CRUD
│       ├── recommendations/   # Recommendation management
│       ├── trades/            # Trade log CRUD
│       ├── pnl/               # P&L and drawdown
│       ├── sizer/             # Sizing calculator
│       ├── news/              # AI news scan
│       └── settings/          # User settings
├── features/
│   ├── screener/
│   │   ├── validation.ts      # CSV parsing + column mapping
│   │   ├── filters.ts         # 9-filter screener engine
│   │   └── ranking.ts         # Score and ranking engine
│   ├── trades/
│   │   └── sizing.ts          # Position sizing + rule checks
│   └── pnl/
│       └── calculations.ts    # P&L and drawdown calculations
├── constants/
│   └── screener.ts            # All strategy constants in one place
├── lib/
│   ├── auth.ts                # NextAuth config
│   ├── db.ts                  # Prisma singleton
│   ├── session.ts             # Auth helpers
│   └── timezone.ts            # Market-aware time utilities
└── __tests__/                 # 119 tests across all core logic
```

---

## Screener Filters (in order)

| # | Filter                | Rule                                         |
|---|-----------------------|----------------------------------------------|
| 1 | Price floor           | Price > $10                                  |
| 2 | Trend filter          | Price > SMA(50)                              |
| 3 | RSI gate              | RSI(14) between 45–75                        |
| 4 | EMA stack             | EMA(20) > EMA(50)                            |
| 5 | Relative volume       | RelVol ≥ 0.8×                                |
| 6 | Spike guard           | Weekly change ≤ 20% (no blow-off candles)    |
| 7 | Earnings blackout     | No earnings within 10 calendar days          |
| 8 | 52W high distance     | 3%–20% below 52W high (no ATH chasing)       |
| 9 | Market cap floor      | Market cap > $500M (anti-manipulation)       |

All parameters live in `src/constants/screener.ts`. Change them once, they propagate everywhere.

---

## Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

119 tests covering: screener filters, ranking engine, position sizing, P&L calculations, drawdown logic, timezone windows, CSV validation, column mapping.

---

## Backups

Export core data via `prisma studio` or run:

```bash
# Export trades as JSON
npx prisma db execute --stdin <<EOF
SELECT row_to_json(t) FROM trades t WHERE user_id = 'your-id';
EOF
```

For automated backups, Neon and Supabase both offer point-in-time recovery on paid plans. For the free tier, schedule a weekly `pg_dump`.

---

## Security Notes

- Single-user only — no public registration after first user is created
- All routes require authentication (NextAuth JWT)
- API keys are server-side only, never in the frontend bundle
- `SETUP_KEY` should be removed from env vars after account creation
- HTTPS enforced by Vercel in production
- Destructive actions (trade delete) require explicit confirmation in UI

---

## Scaling the Account

When account grows, update `accountSizeEur` in Settings.  
Risk per trade scales automatically — the 1.5–2% rule stays constant.

| Account | Daily Target | Max Daily Loss | Max Position |
|---------|-------------|----------------|--------------|
| €700    | €20–30      | €21            | €595         |
| €1,000  | €30–40      | €30            | €850         |
| €1,500  | €45–60      | €45            | €1,275       |
| €2,000  | €60–80      | €60            | €1,700       |

Never increase size on recent wins alone. Scale only after consistent performance over 3+ weeks.
