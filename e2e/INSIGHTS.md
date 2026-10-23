# E2E Insights

Engineering knowledge captured during development sessions.
Format: `- **[YYYY-MM-DD]** description (file:line when applicable)`

## What Works

- **[2026-10-13]** agent-browser DOES support hover: `hover <sel>` and `find <locator> <value> hover` (e.g. `["find", "testid", "pr-findings-badge", "hover"]`). `find testid <id>` matches `data-testid`. For a hover-only element (a popover anchor with no stable visible text of its own), add a `data-testid` to the anchor in the component and hover it, then `wait --text` for the revealed popover content. The daemon keeps mouse position between commands, so the popover stays open for the following `wait` (don't move the mouse). Full command list: `agent-browser --help` / `agent-browser skills get core --full` (specs/08-pr-findings-popover.flow.json).

## What Doesn't Work

- **[2026-10-13]** Seeded data has exactly ONE review per PR (PR #482: 1 review, 2 findings), so any "latest review vs. all reviews aggregated" distinction is invisible to e2e — both read the same count. E2e can only smoke-test that the popover opens with the right count; pin the latest-vs-aggregate contract in a server `*.it.test.ts` that inserts multiple reviews (server/test/reviews.it.test.ts).

- **[2026-10-22]** The e2e run is the only check that exercises the real `next dev` webpack build — vitest and `tsc` use different module resolution. It caught a client runtime import from `@devdigest/shared` that broke the page with "Module not found" while all 85 unit tests and typecheck passed (see client/INSIGHTS.md, 2026-10-22). On a flow failure, look at `e2e/test-results/<spec>-fail.png` first: a Next build-error overlay there means a compile problem, not a wrong locator (e2e/run.ts:85-87).

## Codebase Patterns

- **[2026-10-22]** To click an editor tab whose label also exists in the sidebar (e.g. agent "Skills" tab vs the SKILLS LAB → Skills nav item), use `find role button --name <label>`: `Tabs` renders `<button>`s while sidebar nav items are links, so the role disambiguates (client/src/vendor/ui/kit/Tabs.tsx:25; client/src/vendor/ui/shell/NavItem.tsx:4; e2e/specs/09-skills.flow.json:28). Flows that assert counts on seeded skills (e.g. "2 of 3 enabled") only hold on a fresh DB — the seed adds demo skills only to a workspace with no skills (server/src/db/seed.ts:232-236).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
