# server — @devdigest/api

Fastify 5, Drizzle ORM, Postgres (pgvector), fastify-type-provider-zod.

## Commands

```sh
pnpm dev          # :3001
pnpm test         # all tests (unit + integration)
pnpm db:migrate   # apply migrations (required, not auto on boot)
pnpm db:seed      # idempotent demo data
pnpm db:generate  # generate migration from schema changes
pnpm typecheck
```

## Layout

- `src/modules/<name>/routes.ts` — feature module (Fastify plugin)
- `src/modules/index.ts` — static module registration
- `src/platform/container.ts` — DI container (lazy singletons)
- `src/platform/config.ts` — AppConfig (no secrets here)
- `src/adapters/` — ports (llm, github, git, astgrep, secrets)
- `src/adapters/mocks.ts` — test doubles for all adapters
- `src/db/schema.ts` — Drizzle schema barrel
- `src/db/migrations/` — generated, never hand-edit
- `src/vendor/shared/` — @devdigest/shared Zod contracts

## Conventions

- New feature = new module plugin in `src/modules/<name>/`, registered in `modules/index.ts`
- Zod schemas on routes drive BOTH request validation AND response serialization
- `*.it.test.ts` suffix = DB-backed integration test (testcontainers Postgres)
- All other test files = hermetic unit tests (mocked adapters)
- Secrets only via `SecretsProvider`, never AppConfig or direct env access

## Gotchas

- Migrations not auto-applied — always `pnpm db:migrate` after pulling
- `GITHUB_TOKEN` is canonical; `GITHUB_PAT` accepted as fallback only
- Rate limiting: 120/min global, tighter on review endpoints; disabled in NODE_ENV=test

## Do-not-touch

- `src/vendor/shared/` — shared contracts
- `src/db/migrations/` — generated files
- `clones/` — imported repo checkouts (git-ignored)

## Read when

- Read `README.md` when working on API routes, DI container, or request flow
- Read `src/modules/repo-intel/README.md` when working on codebase indexing
- Read `INSIGHTS.md` at session start — review for relevant gotchas, patterns, and known issues
- Read `docs/` for deep-dive documentation on specific server features
- Read `specs/` for feature specifications and acceptance criteria
