---
name: onion-architecture
description: "DevDigest backend (@devdigest/api) onion/hexagonal architecture — the layer map and dependency rules for server/src. Use when creating or moving any file under server/src/, adding a route/service/repository/adapter, defining a port in vendor/shared/adapters.ts, wiring platform/container.ts, or reviewing backend layering. Enforces: route → service → domain through the container; every external system (git, github, llm, index, embedder, secrets, db) behind a port interface, implemented only in adapters/, wired only in the container; dependencies always point inward. For route mechanics see fastify-best-practices; for query internals see drizzle-orm-patterns; for secret handling see security."
---

# Onion Architecture (backend)

`@devdigest/api` (`server/`) is an onion/hexagonal backend: a pure domain at the
center, application services around it, external systems as adapters at the edge,
and **all dependencies pointing inward**. This skill is the project-specific
contract. It does not re-teach onion theory — see [references.md](references.md).
For code, see [examples.md](examples.md).

## Severity Levels

- **CRITICAL** — breaks the dependency direction; the architecture stops holding
- **HIGH** — leaks an external system past its port or across a layer boundary
- **MEDIUM** — structure/placement drift that erodes the pattern over time

---

## The rings (center → edge)

| Ring | Role | Real paths | May depend on |
|------|------|-----------|---------------|
| **0 — Domain / contracts** | Pure review engine + Zod contracts + **port interfaces** | `reviewer-core/`, `server/src/vendor/shared/` (ports in `adapters.ts`) | itself only |
| **1 — Application** | Orchestration + persistence boundary | `modules/<name>/service.ts`, `modules/<name>/repository/*.repo.ts` | ring 0 (domain + ports) |
| **2 — Infrastructure / adapters** | Concrete impls of the ports | `server/src/adapters/*` (git, github, llm, secrets, codeindex, embedder, depgraph, tokenizer, astgrep) | ring 0 (the port it implements) |
| **Edge — delivery + composition root** | Fastify controllers; the one place concrete adapters are named | `modules/<name>/routes.ts`, `platform/container.ts` | rings 0–2 |

The container (`platform/container.ts`) is the **composition root**: it is the
only module that imports concrete adapter classes and binds them to their port
interface behind a lazy getter.

## Rules

### CRITICAL — dependency direction (inward only)

- **No external-system call in a route.** `routes.ts` must never touch
  `container.git / .github / .llm / .codeIndex / .embedder / .secrets`, a
  repository, or `container.db` directly. A route does exactly:
  `getContext` → `Zod.parse` → delegate to a service → return a DTO.
  *Nuance:* platform primitives are allowed at the edge — `req.log` and
  `container.runBus` (the SSE handler legitimately subscribes to the bus).
  The line is **external systems** vs. **platform plumbing**.
- **Domain is pure.** Nothing in `reviewer-core/` or `vendor/shared/` imports
  Fastify, Drizzle, a provider SDK, `platform/container`, or a concrete adapter.
  Business logic must be testable with no DB and no network.
- **Composition root is the only wiring point.** Concrete adapter classes
  (`SimpleGitClient`, `OctokitGitHubClient`, `OpenAIProvider`,
  `RipgrepCodeIndex`, `LocalSecretsProvider`, …) are imported **only** in
  `container.ts`. Services and routes name the **port interface**
  (`GitClient`, `LLMProvider`, …), never the class.

### HIGH — ports and boundaries

- **Every external call goes behind a port** declared in
  `vendor/shared/adapters.ts` ("ALL external calls go behind these interfaces").
  Adding an integration is three ordered steps: (1) add/extend the interface in
  `adapters.ts`; (2) implement it under `adapters/<kind>/`; (3) wire a lazy
  getter in the container with an `overrides` escape hatch for tests.
- **Drizzle stays in the repository.** Query building lives in
  `modules/<name>/repository/*.repo.ts` and `db/`. Services call repository
  methods; routes never see `container.db`. Services depend on `container.db`
  only to construct their repository, not to query.
- **Secrets only via `SecretsProvider`** (`adapters/secrets/local.ts`), never
  through `AppConfig`. (Repo-wide rule; restated here as the edge case of the
  port rule.) See the `security` skill.

### MEDIUM — module layout

- A server feature is a folder `modules/<name>/` (kebab-case) with entry
  `routes.ts`, orchestration in `service.ts`, persistence split into
  `repository/*.repo.ts`. Source files kebab-case.
- A service is constructed from the container (`new XService(container)`) and
  pulls its collaborators off it (`container.agentsRepo`, `container.reviewRepo`)
  rather than reaching into another module's folder.
- Cross-module shared repositories are constructed in the container, not
  imported peer-to-peer between modules.

## Quick self-check before committing a backend change

1. Does a `routes.ts` reference an external-system adapter, a repository, or
   `container.db`? → move it into a service.
2. Does anything in `reviewer-core/` / `vendor/shared/` import an SDK, Drizzle,
   Fastify, or the container? → invert via a port.
3. Is a concrete adapter class imported outside `container.ts`? → depend on the
   interface and resolve through the container.
4. New external integration without an interface in `adapters.ts`? → add the
   port first.

## Enforcing it (measured; gate is opt-in)

These rules were run against the real graph with `dependency-cruiser`
(2026-10-16): **149 modules / 462 deps → 0 errors, 20 warnings**. `core-is-pure`
passes clean and is enforced as `error`; the other four have existing drift and
run as `warn` baseline (ratchet: block *new* violations, burn down the old).

Full baseline, the **exception ledger** (what looks like a violation but is
legitimate — e.g. repo-intel as the indexer subsystem), the current drift list,
and how to flip the CI gate on are in [enforcement.md](enforcement.md); the
ready-to-use config is `dependency-cruiser.sample.cjs`. Nothing is wired into
`server/package.json` yet — enabling it is a copy + one script line.

> When you see one of the listed drift items in code, it is **known baseline**,
> not the pattern to copy — fix it toward the rules, don't propagate it.
