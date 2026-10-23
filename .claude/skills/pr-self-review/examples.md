# PR Self-Review — examples

Three worked runs: a clean PASS, a BLOCK, and a waiver. Findings are illustrative.

## 1. PASS — a backend-only change

```
$ /pr-self-review
```

**Step 1 — review set** (base `main`):

```
M  server/src/modules/reviews/service.ts
M  server/src/modules/reviews/repository/review.repo.ts
A  server/src/modules/reviews/repository/finding.repo.ts
```

**Step 2 — routing:** all paths under `server/src/**` → backend surface →
load `onion-architecture` + `fastify-best-practices` + `drizzle-orm-patterns`.
No `client/**` → UI skills **not** loaded.

**Step 3 — review + INSIGHTS:** read `server/INSIGHTS.md`; review the changed
hunks. One advisory:

| id | sev | where | skill / rule | note |
|----|-----|-------|--------------|------|
| drizzle-select-star-1 | MEDIUM | finding.repo.ts:42 | drizzle-orm-patterns | prefer explicit columns over `select()` |

**Step 3b — objective pre-gate:** `cd server && pnpm typecheck` ✓,
`pnpm exec vitest run --exclude '**/*.it.test.ts'` ✓.

**Verdict: PASS** (0 CRITICAL, 0 WARNING, 1 SUGGESTION).

`<git dir>/pr-self-review.json` (git dir from `bash .claude/hooks/pr-self-review-lib.sh dir`):

```json
{
  "verdict": "PASS",
  "critical": 0, "warning": 0, "suggestion": 1,
  "base": "main",
  "head": "a1b2c3d4...",
  "diffHash": "9f2c…",
  "reviewedAt": "2026-10-18T10:04:11Z",
  "waivers": [],
  "reportPath": "<git dir>/pr-self-review.md"
}
```

→ clear to open the PR. Offered PR body seed:

```
## Self-review summary
Surface: backend · Skills: onion-architecture, fastify, drizzle · typecheck+unit ✓
Verdict: PASS (0 critical, 1 suggestion)
```

`gh pr create --repo SergiiShust/dev-review` is now allowed by the hook.

## 2. BLOCK — a mixed change with an architecture violation

```
$ /pr-self-review
```

**Review set:**

```
M  client/src/app/agents/_components/AgentCard/AgentCard.tsx
M  server/src/modules/pulls/routes.ts
M  server/src/vendor/shared/contracts/findings.ts
```

**Routing:** `client/**` → UI skills; `server/src/**` → backend skills;
`server/src/vendor/shared/**` → flagged (shared contracts, affects both).

**Findings:**

| id | sev | where | skill / rule | note |
|----|-----|-------|--------------|------|
| onion-route-adapter-1 | **CRITICAL** | pulls/routes.ts:88 | onion-architecture | `container.git.diff(...)` called inside a route — external system past its port |
| donottouch-shared-1 | **CRITICAL** | contracts/findings.ts:11 | self-check (do-not-touch) | edits `server/src/vendor/shared/` — edit the canonical copy, sync; never hand-edit here |
| react-key-index-1 | HIGH | AgentCard.tsx:31 | react-best-practices | array index as React key |

**Verdict: BLOCK** (2 CRITICAL). Claude does **not** run `gh pr create`.

```
BLOCK — 2 critical finding(s) must be resolved before opening the PR:

  1. [onion-route-adapter-1] server/src/modules/pulls/routes.ts:88
     Move the git call behind the service (route → service → port).
  2. [donottouch-shared-1] server/src/vendor/shared/contracts/findings.ts:11
     Revert; change the canonical shared contract and re-sync.

If you believe one is a false positive:
  /pr-self-review allow onion-route-adapter-1 "<reason>"
```

Attempting `gh pr create` now → the PreToolUse hook exits 2:

```
pr-self-review: last self-review verdict was BLOCK.
Run /pr-self-review and resolve any CRITICAL findings before opening the PR.
```

## 3. Waiver — overriding a false positive

The secret scanner flagged a fixture that only *looks* like a token:

```
$ /pr-self-review allow secret-scan-3 "test fixture token, not a real credential — server/test/fixtures/gh.ts"
```

- Records `{ id: "secret-scan-3", reason: "...", author: "<git user.name>", diffHash: "<current>" }`.
- That CRITICAL is downgraded to advisory → **verdict flips to PASS** (assuming
  no other unwaived CRITICAL).
- The waiver is listed in both the JSON (`waivers[]`) and the report.

Then edit any file → `diffHash` changes → the waiver **and** the PASS expire →
the gate blocks `gh pr create` again until you re-run `/pr-self-review`.
