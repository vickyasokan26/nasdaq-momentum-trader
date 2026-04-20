.PHONY: install build typecheck lint format test clean dev setup

install:
	npm install

build:
	npx prisma generate
	npm run build

typecheck:
	npx tsc --noEmit

lint:
	npm run lint

format:
	npm run format


test:
	npm test

check: typecheck lint test build
	@echo ""
	@echo "All checks passed - safe to push"

dev:
	npm run dev

setup: install
	npx prisma generate
	@echo ""
	@echo "Done. Copy .env.example to .env, fill in DATABASE_URL, then run make dev"

clean:
	rm -rf .next node_modules/.cache tsconfig.tsbuildinfo