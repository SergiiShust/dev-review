# E2E Insights

Engineering knowledge captured during development sessions.
Format: `- **[YYYY-MM-DD]** description (file:line when applicable)`

## What Works

- **[2026-10-13]** agent-browser DOES support hover: `hover <sel>` and `find <locator> <value> hover` (e.g. `["find", "testid", "pr-findings-badge", "hover"]`). `find testid <id>` matches `data-testid`. For a hover-only element (a popover anchor with no stable visible text of its own), add a `data-testid` to the anchor in the component and hover it, then `wait --text` for the revealed popover content. The daemon keeps mouse position between commands, so the popover stays open for the following `wait` (don't move the mouse). Full command list: `agent-browser --help` / `agent-browser skills get core --full` (specs/08-pr-findings-popover.flow.json).

## What Doesn't Work

- **[2026-10-13]** Seeded data has exactly ONE review per PR (PR #482: 1 review, 2 findings), so any "latest review vs. all reviews aggregated" distinction is invisible to e2e — both read the same count. E2e can only smoke-test that the popover opens with the right count; pin the latest-vs-aggregate contract in a server `*.it.test.ts` that inserts multiple reviews (server/test/reviews.it.test.ts).

## Codebase Patterns

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
