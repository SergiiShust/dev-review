# reviewer-core — @devdigest/reviewer-core

Pure review engine: diff + prompt + LLM = grounded findings.
No DB, no filesystem, no GitHub — only side effect is an injected LLMProvider.

## Commands

```sh
pnpm test         # vitest, hermetic (stubbed LLMProvider)
pnpm typecheck    # this IS the build — package never emits JS
```

## Layout

- `src/review/run.ts` — orchestrates a review run (entry point)
- `src/prompt.ts` — assemblePrompt(), wrapUntrusted(), INJECTION_GUARD
- `src/grounding.ts` — groundFindings() citation gate
- `src/llm/structured.ts` — Zod-to-JSON-Schema, parse-with-repair
- `src/llm/openrouter.ts` — LLMProvider implementation
- `src/index.ts` — public API barrel

## Conventions

- Consumed by server via tsconfig path alias (`@devdigest/reviewer-core` → `../reviewer-core/src`)
- Never published to npm, never emits JS — `typecheck` is the build
- LLMProvider is always injected — makes unit tests key-free and network-free
- Contracts (Review, Finding, Verdict) come from `@devdigest/shared`, not defined here

## Gotchas

- Grounding is mandatory: every finding must cite a line in the diff or it's dropped
- Score is recomputed from surviving findings — model's self-reported score is ignored
- INJECTION_GUARD is appended to every agent's system prompt automatically
- Extra prompt slots (skills, memory, specs, callers) are omitted when not provided

## Read when

- Read `README.md` when working on the review pipeline, grounding, or prompt assembly
- Read `INSIGHTS.md` when debugging unexpected review results or grounding behavior
- Read `docs/` for deep-dive documentation on engine internals
- Read `specs/` for feature specifications and acceptance criteria
