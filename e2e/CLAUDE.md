# e2e — @devdigest/e2e

Deterministic browser e2e via agent-browser (Rust CLI + CDP).
No Playwright, no LLM, no API key.

## Commands

```sh
npm install && npm test           # against running stack (:3000)
npm run e2e:hermetic              # isolated stack on alternate ports (recommended)
./scripts/e2e.sh                  # same hermetic run from repo root
```

## Layout

- `specs/NN-name.flow.json` — test flows (JSON lists of agent-browser commands)
- `src/run.ts` — flow runner (executes specs sequentially in one browser session)
- `test-results/` — failure screenshots (git-ignored, CI artifact)

## Conventions

- Deterministic locators only: `--url`, `--text`, `find role|text|label` — never AI `chat`
- `wait` commands ARE the assertions (timeout = non-zero exit = failure)
- Flows target read-only seeded data (demo repo acme/payments-api, PR #482)
- `{BASE}` in specs is replaced with `E2E_BASE_URL`

## Gotchas

- Requires a freshly-seeded DB — flows assume the demo repo is the only one
- Never `docker compose down -v` to reset — it destroys the dev DB volume
- Hermetic runner uses alternate ports (Postgres :5433, API :3101, web :3100)

## Read when

- Read `README.md` when adding flows, debugging failures, or setting up the runner
- Read `INSIGHTS.md` at session start — review for relevant gotchas, patterns, and known issues
- Read `docs/` for deep-dive documentation on e2e patterns
