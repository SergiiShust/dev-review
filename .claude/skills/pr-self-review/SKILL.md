---
name: pr-self-review
version: "1.0.0"
description: "DevDigest pre-PR self-review — run this BEFORE opening a pull request or running `gh pr create` to review the full set of changes the PR will contain. A workflow dispatcher: it classifies each changed file by surface and routes it to the governing skills — client/ → frontend-architecture + react-best-practices + react-testing-library; server/src/ → onion-architecture + fastify-best-practices + drizzle-orm-patterns — then emits a PASS/BLOCK verdict. Blocks on any CRITICAL finding (the project's `ci_fail_on: 'critical'` gate), writes a proof-of-review file, and a PreToolUse hook refuses `gh pr create` until a fresh PASS exists. Trigger phrases: pre-PR review, self review before PR, review my local changes before opening a PR, check the branch before `gh pr create`. Invoke via /pr-self-review. For the routed rules themselves see those skills; for the layer map see onion-architecture and frontend-architecture."
---

# PR Self-Review (pre-PR dispatcher + gate)

Run this **before a pull request is opened**. It reviews everything the PR will
contain — the full branch diff plus uncommitted work — routes each changed file
to the architecture/quality skills that govern its surface, and emits a
**verdict**. On any **CRITICAL** finding it **blocks**: Claude does not run
`gh pr create`, and a `PreToolUse` hook enforces that block until a fresh PASS is
recorded.

This is a Claude-executed workflow (Markdown instructions), like every skill
here. It does **not** import the reviewer-core engine — it drives Claude to load
the relevant skills and review the diff against them, as a cheap local "second
pass" before the DevDigest product reviews the PR for real.

## Severity Levels

The routed skills emit **CRITICAL / HIGH / MEDIUM**. The gate maps that to the
DevDigest product's own severity + default `ci_fail_on: 'critical'` policy
(`gateTriggered(findings, 'critical')` in `reviewer-core/src/output/to-review.ts`;
`Severity` / `CiFailOn` in `server/src/vendor/shared/contracts/{findings,knowledge}.ts`).
**Do not conflate the two scales** — map them:

- **CRITICAL** — breaks a build/type, breaks the architecture's hard rule, leaks
  a secret, or edits a do-not-touch path → **BLOCKS** (→ product `CRITICAL`).
- **HIGH** — fights the architecture; coupling / refactor pain → advisory (→ `WARNING`).
- **MEDIUM** — consistency / discoverability drift → advisory (→ `SUGGESTION`).

Only an **unwaived CRITICAL** blocks. HIGH / MEDIUM are always reported, never
block.

---

## Step 0 — Parse args

`/pr-self-review` runs the full workflow by default. Optional args:

- `base=<branch>` — override the base branch (default: resolved below).
- `staged-only` — review only `git diff --cached` (fast iterative check).
- `fast` — load only the **core** routed skills; skip the optional tier and the
  objective pre-gate (Step 3b).
- `allow <finding-id> "<reason>"` — record a waiver for a false-positive
  CRITICAL (see **Waivers**). This sub-command re-runs the gate with the waiver
  applied; it does not re-review.

> **`staged-only` and `fast` are advisory only** — they print results but **do
> not write** the proof-of-review file (Step 5), so the hook still requires a
> full-scope PASS before `gh pr create`. Use them while iterating.

## Step 1 — Compute the review set (full branch + working tree)

Resolve the base branch: `base=` arg → else
`git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`) → else `main`.

Build the changed-file set as the **union** of:

```sh
git diff --merge-base <base> HEAD --name-status -M   # committed on the branch
git diff HEAD --name-status -M                        # staged + unstaged
```

`-M` detects **renames** (not add+delete). **Deleted** files are recorded but
not reviewed (nothing to read). A **rename** reviews only its changed hunks.

**Changed-lines-only grounding.** Review **only added/changed hunks**, per file:

```sh
git diff --merge-base <base> HEAD -- <file>
git diff HEAD -- <file>
```

A finding that can't be anchored to a changed (`+`) line is **dropped** — this
mirrors the engine's grounding gate and is the primary false-positive reducer.

**Big-diff chunking.** If the change is large — **> 400 changed lines AND
multi-file** (the product's map-reduce threshold) — review **per surface, then
per file in batches**, and reduce to one findings list, so a big PR doesn't blow
the context budget. Otherwise, one pass.

## Step 2 — Classify each file by surface and route to skills

Mirror the repo's existing surface maps: the CI `paths:` filters in
`.github/workflows/*.yml` and the **Scope** column in `.claude/skills/README.md`.
`*.tsx` only ever appears under `client/` — a reliable UI signal.

| Changed path | Surface | Core skills to load | Optional (if the diff warrants) |
|---|---|---|---|
| `client/**` (esp. `*.tsx`, `client/src/app/**`) | UI | `frontend-architecture` + `react-best-practices` + `react-testing-library` | `next-best-practices`, `zod`, `typescript-expert` |
| `server/src/**` | backend | `onion-architecture` + `fastify-best-practices` + `drizzle-orm-patterns` | `postgresql-table-design`, `security`, `zod` |
| `reviewer-core/**`, `server/src/vendor/shared/**` | backend / domain (ring 0) | `onion-architecture` (treats these as the pure core) | `typescript-expert`, `zod` |
| `e2e/**` | test | `react-testing-library` (technique) | — |
| docs / `*.md` / `.github/**` / `scripts/**` | non-code | none — record as "not reviewed" | — |

Rules:
- Load a skill **only** if ≥1 changed file maps to its surface (don't run UI
  skills on a backend-only PR, or vice-versa).
- A change under `server/src/vendor/shared/**` affects **both** surfaces (shared
  contracts) — flag it prominently and run the backend skills.
- Under `fast`, load only the **Core** column.

## Step 3 — Review each surface against its loaded skills

Before reviewing a surface, read that package's **`INSIGHTS.md`** (`client/`,
`server/`, `reviewer-core/`, `e2e/`) — the repo's session-start convention — so
findings reflect known gotchas, not just generic rules.

Review the changed hunks against each loaded skill's rules. Each finding:
`id` (short slug, e.g. `onion-route-adapter-1`), `severity`, `file:line`,
`skill / rule`, one-line rationale, and a suggested fix.

### Step 3a — Self-owned checks (independent of the routed skills)

Run these against the diff; they raise findings no routed skill owns:

- **Do-not-touch guard — CRITICAL.** A changed path under
  `server/src/vendor/shared/`, `client/src/vendor/`, or a **hand-edited**
  `server/src/db/migrations/NNNN_*.sql` is CRITICAL per the root `CLAUDE.md`
  "Do-not-touch" list, regardless of surface. (A migration is legitimate only
  when generated by `pnpm db:generate`.)
- **Secret scan — CRITICAL.** Grep **added** lines for obvious secrets — API
  keys, tokens, `~/.devdigest/secrets.json` contents, `BEGIN … PRIVATE KEY`,
  `GITHUB_TOKEN=`/`GITHUB_PAT=` literals. Maps to the product's `secret_leak`
  finding kind; cross-reference the `security` skill.
- **Skip-list.** Lockfiles (`pnpm-lock.yaml`), generated migrations (beyond the
  hand-edit check), and binary/asset files → record as "not reviewed", never
  flag for style.

### Step 3b — Objective pre-gate (deterministic; skipped under `fast`)

For each **touched package**, run its own checks (from its `package.json`).
**Always use `pnpm -C <dir>`** — never `cd <dir> && …` — so each command carries
its own directory. Parallel Bash calls share one working directory, so a
`cd`-based command can race and run in the wrong package; `-C` is immune.

```sh
# server (also covers reviewer-core / shared contracts via the backend surface)
pnpm -C server typecheck && pnpm -C server exec vitest run --exclude '**/*.it.test.ts'
# client
pnpm -C client typecheck && pnpm -C client test
```

Do **not** use the package's own `pnpm -C server test` — it runs the full suite
including the DB-backed `*.it.test.ts` (Dockerized Postgres); the explicit
`exec vitest … --exclude` form keeps it to the hermetic subset. A failing
typecheck or hermetic test → **CRITICAL** (objective, complements the subjective
architecture findings). Package → directory: `client/`, `server/`,
`reviewer-core/`, `e2e/`.

## Step 4 — Verdict (the gate)

- any **unwaived CRITICAL** (routed skill or self-owned check) → **BLOCK**
- else → **PASS**

HIGH / MEDIUM never block.

### Waivers

A hard gate with no escape hatch gets disabled on its first false positive, so
provide a recorded override:

`/pr-self-review allow <finding-id> "<reason>"`

records `{ id, reason, author, diffHash }` into the proof file and downgrades
that CRITICAL to advisory for the gate. Waivers are **keyed to `diffHash`** —
they auto-expire the moment the diff changes, so an override never silently
carries across edits. `author` = `git config user.name`.

## Step 5 — Write the proof-of-review file

On a **full-scope** run (not `staged-only` / `fast`), write
`.git/pr-self-review.json` (inside `.git/`, so it is never committed and is
per-clone):

```json
{
  "verdict": "PASS",
  "critical": 0, "warning": 2, "suggestion": 3,
  "base": "main",
  "head": "<git rev-parse HEAD>",
  "diffHash": "<see recipe>",
  "reviewedAt": "<ISO-8601>",
  "waivers": [],
  "reportPath": ".git/pr-self-review.md"
}
```

**`diffHash` recipe (must match the hook exactly):**

```sh
{ git diff --merge-base <base> HEAD; git diff HEAD; } | shasum -a 256 | awk '{print $1}'
```

`diffHash` keys the verdict to the exact reviewed content, so any later edit or
commit invalidates both the PASS **and** every waiver, forcing a re-run.

## Step 6 — Report, PR seed, and the open decision

- **Markdown report.** Write `.git/pr-self-review.md`: findings grouped by
  surface, counts by severity, which skills ran, files not reviewed, and active
  waivers. Human-readable companion to the JSON.
- **PR-description seed.** On PASS, offer to prefill the `gh pr create` body with
  a short "Self-review summary" (surfaces reviewed, skills run, verdict) so
  reviewers see what was already checked.
- **On PASS** → it's clear to open the PR (remember the repo targets the
  `SergiiShust/dev-review` fork: `gh pr create --repo SergiiShust/dev-review`).
- **On BLOCK** → print the summary, **do not run `gh pr create`**, and list each
  CRITICAL with the exact `/pr-self-review allow <id> "<reason>"` line for any
  you judge a false positive.

## Enforcement hook (makes the block real)

A `PreToolUse` hook on `Bash` runs `.claude/hooks/pr-self-review-gate.sh`
(wired in `.claude/settings.json`). A shell hook can't *run* a Claude review, so
it enforces **"a fresh PASS must exist for the current diff"**: when the Bash
command matches `gh pr create`, it recomputes `diffHash` (same recipe) and checks
`.git/pr-self-review.json` — **missing / stale (`diffHash` mismatch) / `BLOCK`**
→ exit 2 (blocks the command); **fresh `PASS`** → allow.

Optional terminal-path gate: `scripts/install-hooks.sh` installs a native git
`pre-push` hook with the same check, for pushes made outside Claude. Opt-in
because `.git/hooks/` is not version-controlled.

## Reuse (don't reinvent)

- Surface maps already in-repo: `.github/workflows/*.yml` `paths:` + the
  `.claude/skills/README.md` **Scope** column.
- Gate semantics: `gateTriggered` / `countBlockers` / `SEV_RANK` /
  `FAIL_ON_MIN_RANK` (`reviewer-core/src/output/to-review.ts`); `Severity` /
  `CiFailOn` (`server/src/vendor/shared/contracts/{findings,knowledge}.ts`).
  Reference the `'critical'` gate rule; do not copy the code.

See [examples.md](examples.md) for a worked PASS run, a worked BLOCK run, and a
waiver.
