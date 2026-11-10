# Onion Architecture — references & rationale

Kept sources, annotated for the rule each supports. The skill's rules are
grounded in these plus the repo's own conventions.

## Canonical onion / dependency-inversion

- **[Onion Architecture — Herberto Graça](https://herbertograca.com/2017/09/21/onion-architecture/)**
  Summary of Jeffrey Palermo's 2008 original. Source of the core rule the skill
  enforces: *inner layers define interfaces, outer layers implement them; the
  direction of coupling is toward the center.* → rules "Domain is pure",
  "Every external call goes behind a port".

- **[Layers, Onions, Ports, Adapters: it's all the same — Mark Seemann](https://blog.ploeh.dk/2013/12/03/layers-onions-ports-adapters-its-all-the-same/)**
  Shows that applying the Dependency Inversion Principle to a layered design
  *is* ports-and-adapters and *is* onion — "all dependencies still point
  inwards". → the whole "dependency direction (inward only)" section, and why
  the container is the single composition root.

- **[Onion Architecture — Bitloops](https://bitloops.com/docs/bitloops-language/learning/software-architecture/onion-architecture)**
  Ports (defined by the core) vs. adapters (implement them); onion as a layer
  structure vs. hexagonal's per-adapter artifacts. → the ring table and the
  `adapters/<kind>/` placement rule.

- **[DDD and the Onion Architecture — itsjavi](https://blog.itsjavi.com/target-software-architectures-the-onion-architecture)**
  TypeScript-oriented; the domain core should carry no third-party dependencies
  so business rules are testable without a database. → "Domain is pure"
  (reviewer-core testable with no DB / no network).

## Enforcement (the optional, document-only part)

- **[Dependency Cruiser: Restrict Imports — Atomic Object](https://spin.atomicobject.com/dependency-cruiser-imports/)**
  and **[dependency-cruiser rule-system docs](https://tessl.io/registry/tessl/npm-dependency-cruiser/files/docs/rule-system.md)**
  `forbidden` / `allowed` / `required` rule types; severity `error|warn|info`;
  roll new rules out at `warn` before promoting to `error`.

The ring rules here were run against the real graph and the config is shipped as
`dependency-cruiser.sample.cjs`. The measured baseline (0 errors / 20 warnings
over 149 modules), the exception ledger, and how to turn the gate on live in
[enforcement.md](enforcement.md).

## In-repo grounding (not external, but what the rules mirror)

- `server/src/vendor/shared/adapters.ts` — "ALL external calls go behind these
  interfaces" (the port registry).
- `server/src/platform/container.ts` — the composition root; lazy getters bind
  each port to a concrete class with an `overrides` test seam.
- `CLAUDE.md` — DI container, SecretsProvider-not-AppConfig, and module-layout
  conventions this skill makes architectural.
