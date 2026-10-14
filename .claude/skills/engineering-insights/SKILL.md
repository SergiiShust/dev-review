---
name: engineering-insights
description: "Capture non-obvious engineering discoveries into per-package INSIGHTS.md. Trigger proactively when solving a tricky bug, discovering an antipattern, or learning a dependency quirk during any session. Also invocable via /engineering-insights. Writes to the INSIGHTS.md of the package being worked on (client, server, reviewer-core, e2e). Append-only — never delete or rewrite existing entries."
---

# Engineering Insights Skill

Capture non-obvious engineering knowledge into per-package `INSIGHTS.md` files so future sessions benefit from past discoveries.

## Rules

1. **Where**: Append to `INSIGHTS.md` in the package you are working on (`client/`, `server/`, `reviewer-core/`, `e2e/`). If the work spans multiple packages, write to each relevant file.

2. **When**: After solving a non-trivial problem, discovering a gotcha, finding a reusable pattern, or learning something surprising about a dependency. Skip trivial config changes, formatting-only sessions, or obvious facts.

3. **Format**: `- **[YYYY-MM-DD]** description (file:line when applicable)` — append under the matching section heading.

4. **Quality gate**: Every entry must be **actionable cold** — a reader encountering it months later should know exactly what to do or avoid without re-investigating. If it's obvious to anyone reading the code, don't write it.

5. **Sections**: Use these standard sections (already in each INSIGHTS.md):
   - **What Works** — patterns, approaches, and techniques proven effective
   - **What Doesn't Work** — failed approaches and why they fail
   - **Codebase Patterns** — conventions not documented elsewhere
   - **Tool & Library Notes** — dependency quirks, version gotchas, config traps
   - **Recurring Errors & Fixes** — error messages and their actual solutions
   - **Session Notes** — context-heavy observations from a specific session
   - **Open Questions** — unresolved issues worth investigating later

6. **Session start**: Read the relevant `INSIGHTS.md` and note the top 3 entries most relevant to the current task.

7. **Append-only**: Never delete, reorder, or rewrite existing entries. If an entry becomes outdated, add a new entry referencing the old one.

## Examples

### GOOD — specific, actionable, with evidence

```markdown
- **[2026-09-15]** Drizzle `onConflictDoUpdate` silently drops the update when `set` is an empty object — always guard with `Object.keys(set).length > 0` before calling (server/src/modules/repos/service.ts:142)
- **[2026-09-20]** TanStack Query `placeholderData` with `keepPreviousData` causes a flash of stale content on route transitions — use `initialData` from the router cache instead (client/src/lib/hooks/useReviews.ts:28)
- **[2026-10-01]** `groundFindings()` drops findings where `diffLineNumber` points to a context line (prefixed with space) rather than an added/removed line — the LLM often cites the nearest context line instead of the actual change (reviewer-core/src/grounding.ts:87)
```

### BAD — vague, obvious, or not actionable

```markdown
- **[2026-09-15]** Drizzle is sometimes tricky with upserts
- **[2026-09-20]** Remember to handle loading states in React
- **[2026-10-01]** Grounding can drop findings
```
