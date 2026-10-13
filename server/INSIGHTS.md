# Server Insights

Engineering knowledge captured during development sessions.
Format: `- **[YYYY-MM-DD]** description (file:line when applicable)`

## What Works

- **[2026-10-12]** Adding a nullable column to `agent_runs` via Drizzle: add the column to the schema, run `pnpm db:generate`, and the migration is a single `ALTER TABLE ADD COLUMN` — no data backfill needed since existing rows get NULL. No index needed for small tables; the pulls route aggregates with an IN-query + JS grouping (same pattern as the score aggregation).

## What Doesn't Work

## Codebase Patterns

- **[2026-10-12]** `ReviewRepository` (server/src/modules/reviews/repository.ts) is a thin wrapper that re-declares the type signatures of `run.repo.ts` functions. When adding a field to `completeAgentRun`, you must update BOTH the standalone function in `repository/run.repo.ts` AND the class method in `repository.ts` — the class doesn't use `Parameters<>` or `typeof`, it redeclares the shape inline. Missing either causes TS2353.
- **[2026-10-12]** Cost data flows: `reviewer-core` computes `costUsd` on `ReviewOutcome` → `run-executor.ts` destructures it → `completeAgentRun()` persists to `agent_runs.cost_usd` → `listRunsForPull` maps it to `RunSummary.cost_usd` → client reads it. The `trace.stats.cost_usd` is a separate copy stored in the jsonb trace document for the drawer view.

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

- **[2026-10-12]** `MockLLMProvider` returns `costUsd: 0.001` per call (server/src/adapters/mocks.ts:85,101). Integration tests can assert `costUsd` is a number and `> 0` — but don't assert exact values since map-reduce strategy may call the LLM multiple times, making the total depend on the diff size and strategy selection.

## Open Questions
