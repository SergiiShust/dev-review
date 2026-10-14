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

- **[2026-10-12]** The pulls list route (`GET /repos/:id/pulls`) already queries `reviews` for latest score. Adding findings counts requires a second query for review IDs (the score query doesn't select `id`), then a third query on `findings` grouped by severity. The `latestReviewByPr` map only stores `{ score }`, so you can't reuse it to get review IDs — you must re-query `reviews` to get the ID for the latest review per PR (server/src/modules/pulls/routes.ts:148-160).

- **[2026-10-13]** Correction to above: the `latestReviewByPr` map was updated to also store `reviewId` (select `t.reviews.id` alongside `score`), avoiding a redundant second query on `reviews`. The pattern is now: one `reviews` query (selecting id + score, newest-first, first-seen = latest), then one `findings` query filtered by those review IDs, with a `reviewToPr` reverse map to attribute counts back to PRs (server/src/modules/pulls/routes.ts:118-155).

- **[2026-10-13]** `listRunsForPull` severity counts follow the same two-hop pattern: runs → reviews (by `runId IN (...)`) → findings (by `reviewId IN (...)`). The `reviews.runId` column links runs to reviews but has no FK constraint, so use `inArray` not a join. Build a `reviewToRun` map to attribute finding severities back to the originating run (server/src/modules/reviews/repository/run.repo.ts:50-82).

- **[2026-10-12]** `MockLLMProvider` returns `costUsd: 0.001` per call (server/src/adapters/mocks.ts:85,101). Integration tests can assert `costUsd` is a number and `> 0` — but don't assert exact values since map-reduce strategy may call the LLM multiple times, making the total depend on the diff size and strategy selection.

## Open Questions
