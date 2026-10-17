# Enforcement — measured baseline & the gate

The ring rules in [SKILL.md](SKILL.md) are checked with `dependency-cruiser`
(already a dependency of `server/` — the `DepCruiseGraph` adapter uses it). This
file records what the gate found when run against the real graph, so the rules
describe reality, not an ideal.

## Baseline (measured 2026-10-16)

Run over `server/src`: **149 modules, 462 dependencies** →
**0 errors, 20 warnings** (CLI exit 0 — safe to add to CI today).

| Rule | Severity | Violations | Meaning |
|------|----------|-----------:|---------|
| `core-is-pure` | **error** | **0** | `vendor/shared` imports no outer ring. Clean — enforced hard. |
| `routes-are-thin` | warn | 4 | routes importing `db/schema` directly (baseline). |
| `db-only-in-repository` | warn | 10 | module/platform code touching `db/schema` outside a repo. |
| `adapters-known-only-to-container` | warn | 1 | after the repo-intel exception (was 8). |
| `no-circular` | warn | 5 | import cycles (baseline). |

**Why the split:** `core-is-pure` passes clean, so it blocks merges as `error`.
The other four have existing drift — enforcing them as `error` today would fail
the build on pre-existing code, so they run as `warn` **baseline**: the gate
flags any *new* violation while the current ones are burned down, then each rule
is promoted to `error`. This is the ratchet — it stops regression without a
big-bang refactor.

## Exception ledger (legitimate — keep green, do NOT "fix")

Encoded as `pathNot` in the config, with the reason:

- **`src/modules/repo-intel/**` → `src/adapters/{astgrep,codeindex,tokenizer}`**
  repo-intel is the indexer subsystem; it *is* infrastructure, reached only
  through the `container.repoIntel` facade, so it composes low-level adapters
  directly. Removing this exception re-adds 7 false "violations". An agent must
  not rewrite repo-intel to route these through the container.

## Current `warn` drift (real — burn down, then promote the rule)

Not exceptions — genuine deviations to fix when you next touch the file:

- **`db/schema` outside a repository (10):** the `routes.ts` of `polling`,
  `pulls`, `settings`, `workspace` (these 4 also trip `routes-are-thin`), plus
  `reviews/run-executor.ts`, `reviews/diff-loader.ts`, `repos/helpers.ts`,
  `settings/feature-models.ts`, `adapters/auth/local.ts`, `platform/jobs.ts`.
  Fix: move the query behind the module's `*.repo.ts`; routes delegate to the
  service.
- **adapters outside the container (1):** `reviews/diff-loader.ts` →
  `adapters/git/diff-parser.ts`. `diff-parser` is a *pure* parser mislocated
  under `adapters/`; fix is to relocate it to a util (or accept as pure).
- **cycles (5):** `agents/helpers.ts ↔ agents/repository.ts` is a genuine
  2-node cycle to break. The rest are the DI-root cluster
  (`platform/container.ts ↔ repo-intel/service.ts`, and `repo-intel/pipeline/*`
  → `container.ts`) — the composition root referencing what it constructs;
  lower priority, type-only where possible.

## Turning the gate on (opt-in — nothing is wired today)

1. `cp .claude/skills/onion-architecture/dependency-cruiser.sample.cjs server/.dependency-cruiser.cjs`
2. Add to `server/package.json` scripts:
   `"lint:arch": "depcruise src --config .dependency-cruiser.cjs"`
3. Run `pnpm lint:arch` locally, then add it to CI. It exits non-zero only on a
   **new** `error` (today: a `core-is-pure` break, or a new violation of any
   rule you've since promoted from `warn` to `error`).

Re-measure anytime with the sample config to refresh these numbers.
