# Client Insights

Engineering knowledge captured during development sessions.
Format: `- **[YYYY-MM-DD]** description (file:line when applicable)`

## What Works

## What Doesn't Work

- **[2026-10-12]** Importing from a sibling Next.js dynamic route segment (e.g. `from "../../../[number]/_components/Foo/helpers"`) fails TypeScript resolution — the `[number]` bracket syntax in the path confuses the module resolver. Instead, either place shared helpers in a common ancestor directory (e.g. `pulls/helpers.ts`) or duplicate the function.
- **[2026-10-12]** Even relative imports that traverse *upward through* a dynamic segment (e.g. `from "../../../../helpers"` from inside `[number]/`) fail TS resolution. The only reliable cross-segment sharing pattern is the `@/` tsconfig alias (e.g. `@/lib/format`). For utilities needed by both the PR list (`pulls/`) and PR detail (`pulls/[number]/`), put them in `client/src/lib/` and import via `@/lib/…`. Re-export from closer helpers files to keep existing consumers stable.

## Codebase Patterns

- **[2026-10-12]** Shared contracts live in `server/src/vendor/shared/` and must be manually copied to `client/src/vendor/shared/` after changes. There's no automated sync — forgetting the copy causes client type errors against stale schemas.
- **[2026-10-12]** PR list grid columns: `constants.ts` defines both `GRID` (CSS grid-template-columns) and `COLUMN_KEYS` (header labels). These must stay in sync — `GRID` defines the widths, `COLUMN_KEYS` drives the header row rendering via i18n keys under `list.columns.*`. Adding a column requires updating both, plus the i18n JSON, plus adding the cell in `PRRow.tsx`.

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

- **[2026-10-12]** When adding a field that's shown in both the timeline (RunHistory) and trace drawer (TraceBody), guard rendering on the field's own nullability — not on a sibling field. `cost_usd` is independent of `tokens_in`; guarding cost display on `r.tokens_in != null` silently hides cost when token data is missing but cost exists. Each data point should have its own null check (client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.tsx:201).

## Open Questions
