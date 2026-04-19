.PHONY: install build typecheck lint test clean dev setup

# ── Install dependencies ───────────────────────────────────────────────────────
install:
	npm install

# ── Full build (same as Vercel runs) ──────────────────────────────────────────
build:
	npx prisma generate
	npm run build

# ── TypeScript check only (fast — no emit) ────────────────────────────────────
typecheck:
	npx tsc --noEmit

# ── Lint ──────────────────────────────────────────────────────────────────────
lint:
	npm run lint

# ── Run tests ─────────────────────────────────────────────────────────────────
test:
	npm test

# ── Run everything before pushing (typecheck → lint → test → build) ───────────
check: typecheck lint test build
	@echo ""
	@echo "✅  All checks passed — safe to push"

# ── Start dev server ──────────────────────────────────────────────────────────
dev:
	npm run dev

# ── First-time local setup (install + generate prisma client) ─────────────────
setup: install
	npx prisma generate
	@echo ""
	@echo "Done. Copy .env.example to .env and fill in your DATABASE_URL, then run:"
	@echo "  make dev      — start dev server"
	@echo "  make check    — full pre-push check"

# ── Clean build artifacts ─────────────────────────────────────────────────────
clean:
	rm -rf .next node_modules/.cache tsconfig.tsbuildinfo