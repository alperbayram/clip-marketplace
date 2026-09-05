# Clip Marketplace

A cut-down paid clipping campaign marketplace: brands post campaigns,
creators submit clips, creators get paid per 1,000 approved views up to the
campaign budget.

Stack: Next.js 15 (App Router) · tRPC v11 · Drizzle ORM / Postgres ·
TailwindCSS + shadcn/ui · react-hook-form + Zod · Vitest · Playwright.

See [NOTES.md](./NOTES.md) for setup, the concurrent-approvals design
decision, what was left out on purpose, and where AI tooling was used.

## Quick start

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and use the "Dev sign-in"
switcher in the header to act as the seeded admin or creator accounts.

```bash
pnpm test       # unit + integration tests
pnpm test:e2e   # Playwright end-to-end specs
pnpm ingest     # simulate one day of view-metrics ingestion
```
