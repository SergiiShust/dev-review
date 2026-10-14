# client — @devdigest/web

Next.js 15 (App Router), React 19, TanStack Query, Tailwind 4, next-intl.

## Commands

```sh
pnpm dev          # :3000
pnpm test         # vitest + jsdom (no API needed)
pnpm typecheck
```

## Layout

- `src/app/**/page.tsx` — App Router pages
- `src/app/**/_components/<Name>/` — colocated feature components + tests
- `src/lib/hooks/` — TanStack Query hooks (one per API domain)
- `src/lib/api.ts` — fetch wrapper, uses `NEXT_PUBLIC_API_BASE`
- `src/components/app-shell/` — nav, breadcrumbs, keyboard shortcuts
- `messages/<locale>/*.json` — i18n strings (next-intl)

## Conventions

- Feature logic in colocated `_components/<Name>/` folders, not in page files
- Component tests as `*.test.tsx` next to the component
- All data fetching through TanStack Query hooks, never raw fetch in components
- `fetch` is mocked in tests — no API server needed

## Do-not-touch

- `src/vendor/ui/` — vendored UI primitives (@devdigest/ui)
- `src/vendor/shared/` — shared Zod contracts (edit in server, synced here)

## Read when

- Read `README.md` when working on routes, UI architecture, or the API hook layer
- Read `INSIGHTS.md` at session start — review for relevant gotchas, patterns, and known issues
- Read `docs/` for deep-dive documentation on specific client features
- Read `specs/` for feature specifications and acceptance criteria
