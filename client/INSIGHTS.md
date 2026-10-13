# Client Insights

Engineering knowledge captured during development sessions.
Format: `- **[YYYY-MM-DD]** description (file:line when applicable)`

## What Works

- **[2026-10-13]** `createPortal(document.body)` with `position: fixed` + `getBoundingClientRect()` is the reliable pattern for popovers inside `overflow: hidden` containers (like `tableCard` in the PR list). Using `position: absolute` gets clipped by the parent's `overflow: hidden` + `borderRadius`. Compute `top`/`left` from the anchor ref in a `useEffect` keyed on visibility (client/src/app/repos/[repoId]/pulls/_components/FindingsPopover/FindingsPopover.tsx).

## What Doesn't Work

- **[2026-10-12]** Importing from a sibling Next.js dynamic route segment (e.g. `from "../../../[number]/_components/Foo/helpers"`) fails TypeScript resolution — the `[number]` bracket syntax in the path confuses the module resolver. Instead, either place shared helpers in a common ancestor directory (e.g. `pulls/helpers.ts`) or duplicate the function.
- **[2026-10-12]** Even relative imports that traverse *upward through* a dynamic segment (e.g. `from "../../../../helpers"` from inside `[number]/`) fail TS resolution. The only reliable cross-segment sharing pattern is the `@/` tsconfig alias (e.g. `@/lib/format`). For utilities needed by both the PR list (`pulls/`) and PR detail (`pulls/[number]/`), put them in `client/src/lib/` and import via `@/lib/…`. Re-export from closer helpers files to keep existing consumers stable.

## Codebase Patterns

- **[2026-10-12]** Shared contracts live in `server/src/vendor/shared/` and must be manually copied to `client/src/vendor/shared/` after changes. There's no automated sync — forgetting the copy causes client type errors against stale schemas.
- **[2026-10-12]** PR list grid columns: `constants.ts` defines both `GRID` (CSS grid-template-columns) and `COLUMN_KEYS` (header labels). These must stay in sync — `GRID` defines the widths, `COLUMN_KEYS` drives the header row rendering via i18n keys under `list.columns.*`. Adding a column requires updating both, plus the i18n JSON, plus adding the cell in `PRRow.tsx`.
- **[2026-10-12]** PRRow renders two "—" dashes (score cell when unreviewed + cost cell when null via `formatCost`). Tests using `screen.getByText("—")` will fail with "multiple elements found". Assert with `queryByText(/\$/)` (absence of dollar sign) or `getAllByText` instead.
- **[2026-10-12]** Update to the above: with the findings column added, PRRow now renders up to **three** dashes (score + findings + cost) when all are null. Use `getAllByText("—")` and assert `.length` or target a specific cell via container queries.

## Tool & Library Notes

- **[2026-10-12]** `Severity` from `@devdigest/ui` (`primitives/tokens.ts`) is a 4-member union: `"CRITICAL" | "WARNING" | "SUGGESTION" | "INFO"`. But `PrMeta.findings_counts` only defines `{ CRITICAL, WARNING, SUGGESTION }` (no INFO). Using the UI `Severity` type to index `findings_counts` causes TS7053 ("Property 'INFO' does not exist"). Use a narrower type like `keyof typeof counts` or a local alias when iterating over `findings_counts` keys.

## Recurring Errors & Fixes

- **[2026-10-12]** `messages/en/prReview.json` contains Unicode smart quotes (U+201C, U+201D) in `emptyStatusBody`. Editing lines near it with the Edit tool corrupts the UTF-8 bytes into different characters, breaking Vite's JSON parser at test time. Use `sed -i ''` for insertions near that line, or place new keys away from it. Validate with `python3 -c "import json; json.load(open('messages/en/prReview.json'))"` after any edit.

## Session Notes

- **[2026-10-12]** When adding a field that's shown in both the timeline (RunHistory) and trace drawer (TraceBody), guard rendering on the field's own nullability — not on a sibling field. `cost_usd` is independent of `tokens_in`; guarding cost display on `r.tokens_in != null` silently hides cost when token data is missing but cost exists. Each data point should have its own null check (client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.tsx:201).

- **[2026-10-12]** `@testing-library/user-event` is NOT installed in the client package — only `@testing-library/react` and `@testing-library/jest-dom` are available. Use `fireEvent` from `@testing-library/react` for click/keyboard tests. Attempting to import `user-event` causes a Vite resolve error at test time.

- **[2026-10-13]** Popover content with long file paths (e.g. `client/src/app/repos/[repoId]/pulls/_components/FindingsPopover/...`) overflows the popover border if the meta row lacks `overflow: hidden` + `textOverflow: ellipsis`. The file path span needs `flex: 1`, `minWidth: 0`, and truncation styles, while category tag and confidence % must be `flexShrink: 0` to stay visible (client/src/app/repos/[repoId]/pulls/_components/FindingsPopover/FindingsPopover.tsx:97-99).

## Open Questions
