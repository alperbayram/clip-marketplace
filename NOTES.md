# Notes

## Setup (tested from a clean checkout)

Requirements: Node >= 20.6 (the `--env-file` flag is used throughout instead
of pulling in `dotenv`), Docker, and `pnpm` (via `packageManager` in
`package.json` — `corepack enable` will pick the pinned version up
automatically).

```bash
cp .env.example .env
docker compose up -d          # Postgres 16, host port 5433 (see below for why)
pnpm install
pnpm db:migrate                # applies the committed drizzle/ migrations
pnpm db:seed                   # creates admin@clipmarket.dev, alice@/bob@clipmarket.dev, one demo campaign
pnpm dev                       # http://localhost:3000 — use the "Dev sign-in" switcher in the header
```

Tests:

```bash
pnpm test                      # unit + integration (needs the same Postgres up)
pnpm exec playwright install chromium   # one-time
pnpm db:seed                   # e2e specs sign in as the seeded admin/alice/bob — reseed if `pnpm test` ran since
pnpm test:e2e                  # e2e golden-path specs (starts its own dev server if none is running)
```

**`pnpm test` truncates the database** (see "concurrent approvals" below for
why the integration tests need a real, shared Postgres instead of a mock).
Re-run `pnpm db:seed` afterward if you want demo data back for manual
poking around.

`docker-compose.yml` maps Postgres to host port **5433**, not 5432 — my dev
machine already had a native Postgres bound to 5432, and Docker silently
listening on the *same* port number on a different interface meant the app
was connecting to the wrong database with confusing "role does not exist"
errors. Moving the compose file's mapped port sidesteps that class of
conflict entirely for anyone else in the same situation.

Ingesting metrics (see 4.5):

```bash
pnpm ingest                    # today; pnpm ingest 2026-01-15 to backfill/test a specific date
```

## Concurrent approvals

**Chosen approach: `SELECT ... FOR UPDATE` on the campaign row, inside the
transaction that does the whole approve operation** (`src/server/domain/approval.ts`).
The transaction locks the campaign, recomputes total spend from every
`approved`/`paid` submission's *current* view-based earnings, checks the
candidate submission fits, writes the approval, and flips the campaign to
`completed` if that exhausted the budget — all before releasing the lock.

What I considered and ruled out:

- **Optimistic locking (a `version` column on `campaigns`).** This protects
  updates *to the campaign row*, but the actual invariant spans the
  `submissions` table — "spend" is a derived sum over other rows. Making
  that work would mean denormalizing a `spent_so_far_cents` column onto the
  campaign and version-guarding *that*, which then has to be kept in sync
  with the submissions table by hand, plus an application-level retry loop
  on conflict. More moving parts, harder to reason about, for a case that a
  row lock handles directly.
- **A bare atomic `UPDATE submissions SET status='approved' WHERE ... AND
  (subquery checking budget)`.** This is atomic *per row*, but under
  Postgres's default `READ COMMITTED` isolation, two approvals racing on
  *different* submission rows don't lock each other. Both transactions can
  read the same stale "spend so far" snapshot via the subquery, both
  conclude "it fits," and both commit — which is exactly the race the spec
  describes (two admins, one budget). Closing that gap would need
  `SERIALIZABLE` isolation plus handling `40001` serialization failures with
  a retry loop, which is more complexity than a lock for the same
  guarantee.
- **Row lock (chosen).** `FOR UPDATE` on the campaign row serializes every
  approval attempt for *that* campaign through the lock: whoever gets there
  first reads a consistent snapshot, decides, and commits before the next
  one is unblocked and re-reads fresh state. Approvals on unrelated
  campaigns don't contend at all. No retry loop, and it's easy to write a
  real, deterministic test against (`tests/integration/concurrency.test.ts`
  fires two genuinely concurrent `approveSubmission()` calls from separate
  pooled connections and asserts exactly one wins).

**A subtlety the spec asks to resolve explicitly:** since views are ingested
daily and only ever go up, a submission's earnings keep growing *after* it's
approved — sometimes past the point where a fresh admission would have been
allowed. I treated the budget gate as **admission control at the moment of
approval only**: it blocks a *new* approval that would push recorded spend
over budget, but it never claws back or caps what an already-approved
submission has genuinely earned from its real view count. Separately, after
each `pnpm ingest` run, campaigns whose recomputed spend has reached or
passed budget purely from view growth are still auto-completed — so
"completes on its own once budget is exhausted" holds as an ongoing
invariant on campaign *status*, even though total spend can end up
numerically above budget from view growth after the fact. The alternative
(capping each submission's counted earnings at whatever fit at approval
time) would mean a submission's earnings depend on approval order and
timing rather than its real views, which felt like the wrong trade-off to
make silently.

## What I left out on purpose

- A real "paid" workflow. The schema and enum are complete (`paid` is a full
  status), and there's a minimal admin "Mark as paid" action, but there's no
  batch payout run, ledger, or export — section 4 never described one, and
  building one would be pure invention.
- A second, separate test database. Integration tests truncate the same
  Postgres instance the dev server uses. Simpler for a reviewer running this
  cold (one `docker-compose.yml`, one `DATABASE_URL`), at the cost of
  `pnpm test` wiping local dev data — documented above.
- `pg_trgm`/full-text search for the campaign title filter — a plain
  `ILIKE '%...%'` is what's there. Fine at this scale, would not scale to a
  large campaigns table.
- Cursor-based pagination for the admin campaign list — it's offset-based
  (`page`/`pageSize`). Offset pagination can skip or repeat a row if rows
  are inserted concurrently with someone paging through; acceptable given
  the expected data volume here, not something I'd ship at real scale.
- Timezone-aware campaign scheduling. `starts_at`/`ends_at` are plain dates;
  there's no per-campaign timezone.
- Exhaustive e2e coverage. The four Playwright specs cover the golden paths
  (create/edit a campaign, submit → review → approve/reject, browse →
  submit → my-submissions) plus the single most heavily-weighted UI
  behavior (a budget-exceeded approval surfacing a specific, non-generic
  error toast) — not every state/toast/edge case.
- Real auth, rate limiting, and anything else explicitly out of scope per
  section 7.

## First thing I'd fix given another day

Budget spend is recomputed from scratch (join every approved/paid
submission to its latest metric row) on every approval and every overview
load. Fine at this data volume, but it's the one piece of the money path
that's O(submissions per campaign) per read instead of O(1). I'd add a
denormalized `spent_cents` column on `campaigns`, updated transactionally
inside the same locked `approveSubmission` transaction (and after ingest),
so reads stay cheap without changing the concurrency story — the row lock
that already protects the write path would keep the denormalized value
correct too.

Runner-up: cursor-based pagination for the admin list, for the reason above.

## Where I used AI tooling, and what I had to correct

This whole implementation was built with Claude (Claude Code). Notable
places where the first pass was wrong and needed a real fix, not just
polish:

- **A genuine bug in duplicate-submission handling.** The first version of
  the unique-URL-per-campaign check looked for `err.code === '23505'`
  directly on the caught error. In practice, drizzle-orm wraps the raw
  `postgres.js` error in its own `DrizzleQueryError` and puts the *original*
  error (with the real `code`) on `.cause`. Unit/integration tests that
  exercise the domain layer directly didn't catch this because they don't
  go through that specific catch block with a real network round-trip; it
  showed up when I ran a full HTTP-level smoke test against the running dev
  server and saw `INTERNAL_SERVER_ERROR` instead of a typed `CONFLICT`.
  Fixed by unwrapping `.cause` recursively, then added
  `tests/integration/submission.test.ts` so this class of regression is
  covered going forward.
- **Wrong assumption in my own budget tests.** My first budget/concurrency
  tests picked round numbers where the budget was an *exact* multiple of
  the per-submission payout. That meant the second approval always
  exhausted the budget exactly and auto-completed the campaign, so the
  *third* approval attempt failed with `CAMPAIGN_COMPLETED` instead of the
  `BUDGET_EXCEEDED` case I intended to test — both are correct application
  behavior, but the test's expectation was wrong. Fixed by choosing budgets
  that leave a partial remainder, isolating each rejection path.
- **`server-only` doesn't work outside a bundler.** I initially added the
  `server-only` package to guard the db/session/domain modules, following
  common Next.js convention. It turned out to be actively harmful here:
  `server-only`'s no-op behavior depends on the `"react-server"` package
  export condition, which only Next.js's own bundler sets — plain Node
  (`tsx` for the ingest/seed scripts, Vitest for the integration tests)
  never does, so every import of those modules threw immediately outside
  the Next.js process. Removed it and rely on the directory boundary
  instead (nothing under `src/app`'s client components imports from
  `src/server`; only `src/shared` crosses that line, and it never touches
  the database).
- **react-hook-form + `z.coerce.number()` doesn't type-check cleanly** with
  a single `TFieldValues` generic on `useForm` (the resolver's input type
  becomes `unknown` for coerced fields, which conflicts with the inferred
  output type used everywhere else). Rather than juggling RHF's three-type-
  parameter escape hatch, I dropped `z.coerce` from the two numeric
  campaign fields and used `register(name, { valueAsNumber: true })`
  instead — simpler, and the shared schema still validates the same shape
  server-side since numbers cross the wire as real JS numbers anyway.
- **A hung process from missing `process.exit()`.** After refactoring the
  ingest script into a testable `runIngest()` plus a thin CLI wrapper, the
  wrapper stopped calling `process.exit()` on success. `postgres.js` keeps
  its connection pool (and therefore the event loop) alive indefinitely, so
  the script no longer exited on its own — first run just hung. Restored
  the explicit exit.

In general: the parts most worth double-checking by hand were exactly the
ones the assignment says matter most — the actual transaction logic for the
budget gate, and the concurrency test's ability to reproduce a real race
rather than just asserting the happy path. Everything in `approval.ts` and
its tests was read line-by-line against the spec's wording rather than
trusted on the first pass.
