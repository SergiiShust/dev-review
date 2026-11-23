---
name: frontend-architecture
version: "1.0.0"
description: "DevDigest client (@devdigest/web) UI architecture — Next.js App Router structure (server/client boundaries, route composition, segment files) plus where to put pages, components, constants, utils, business logic, data-fetching hooks, state, styles, types, and tests, and file-naming rules. Use when creating or moving any file in client/, deciding where code belongs, structuring routes, or reviewing client structure. Covers architecture, not performance — for Next.js optimization and generic React/testing rules see the next-best-practices, react-best-practices, and react-testing-library skills."
---

# UI Architecture — "What Goes Where" in `client/`

The placement map for the `@devdigest/web` client (Next.js 15 App Router, React 19,
TanStack Query v5). It answers **where a file belongs** and **why**, grounded in the
project's actual conventions and backed by researched principles (see [references.md](references.md)).
Code shapes and good/bad examples live in [examples.md](examples.md).

**This skill is about architecture and placement, not performance.** For Next.js
optimization (image/font/bundling/caching/runtime) use `next-best-practices`; for React
component/hook rules use `react-best-practices`; for test technique use `react-testing-library`.

## Guiding principle

> **Colocate until it hurts, then promote.** Put code as close as reasonable to where it is
> used. Code used by **one** place lives next to it; code used by **2+** places moves **up**
> one layer (route folder → `src/components`/`src/lib` → `@devdigest/ui`). Never sideways
> between features. (Kent C. Dodds colocation; Wieruch "blast radius".)

## Severity Levels

- **CRITICAL** — Breaks the build/types, or violates a hard project constraint
- **HIGH** — Fights the architecture; will cause coupling or refactor pain
- **MEDIUM** — Hurts consistency, discoverability, or maintainability

---

## Decision table — "I have X → put it in Y"

| I have… | It goes in… | Naming |
|---|---|---|
| A new route/screen | `src/app/<segment>/page.tsx` (thin) | kebab-case segment |
| A component used only by one route | `src/app/<route>/_components/<Name>/` | PascalCase folder + `.tsx` |
| A component reused by 2+ routes | `src/components/<domain>/<Name>/` | kebab-case domain, PascalCase file |
| A design-system primitive | **import** from `@devdigest/ui` (never author in `vendor/`) | — |
| Constants for one component/route | colocated `constants.ts` | — |
| App-wide nav / design tokens | `src/vendor/ui/nav.ts`, `.../primitives/tokens.ts` | — |
| A util used by one component | colocated `helpers.ts` | — |
| A util shared across routes/segments | `src/lib/<name>.ts` (import via `@/lib/…`) | kebab-case |
| Data fetching / mutations | a hook in `src/lib/hooks/<domain>.ts` | `useXxx` |
| A raw HTTP call | nowhere new — go through `src/lib/api.ts` | — |
| Cross-cutting client state | a Context provider in `src/lib/*.tsx` | kebab-case lowercase |
| Local UI state | `useState` in the component | — |
| Styles for a component | colocated `styles.ts` (`s` object of `CSSProperties`) | — |
| A component test | colocated `<Name>.test.tsx` | — |
| A domain type | infer from Zod in `src/vendor/shared/` → re-export via `src/lib/types.ts` | — |
| A component's prop type | inline in the component `.tsx` | — |

---

## Next.js App Router architecture (structure, not performance) — HIGH

- **Routing surface.** Folders under `src/app/**` define URL segments. A segment becomes a
  route **only** when it contains `page.tsx` (or `route.ts`). Dynamic segments use `[param]`
  (`src/app/repos/[repoId]/pulls/[number]/page.tsx`).
- **Pages stay thin.** A `page.tsx` is either (a) a server wrapper that renders one colocated
  view component, or (b) a thin `"use client"` shell that holds top-level hooks/state. Real UI
  lives in colocated `_components/`, never inline in the page. (Thin examples:
  `src/app/agents/page.tsx`, `src/app/settings/[section]/page.tsx`.)
- **Server vs client boundary — the key decision.** Keep the `"use client"` boundary **as low
  in the tree as possible**: server components compose and pass data down; mark only interactive
  leaves as client. Today the root `src/app/layout.tsx` is the main server component (async —
  `getLocale`/`getMessages`, theme script, providers); most other files are `"use client"`. For
  new work, do not promote a whole page to client just to make one child interactive. (RSC
  data-fetching/caching mechanics → `next-best-practices`.)
- **Segment files are architecture, use them deliberately:** `layout` (shared shell + nested
  layouts), `template` (re-mounts per navigation), `loading` (Suspense boundary), `error` /
  `global-error` (error boundary), `not-found`, `route` (HTTP endpoint). Introduce one when a
  route genuinely needs that boundary.
  - **Project reality (do not misrepresent it):** only a single root `layout.tsx` exists — there
    are currently **no** `loading.tsx` / `error.tsx` / `not-found.tsx` files and **no nested
    layouts**. Loading/error/empty states are handled **in-component** via TanStack Query flags
    plus vendored `Skeleton` / `EmptyState` / `ErrorState` / `RepoNotFound`. A new route may add a
    segment file when it's the right tool — just follow the in-component pattern unless there's a
    reason to diverge.
- **Organizational tools (no URL impact):**
  - Route groups `(group)` — group routes / share a layout without adding a URL segment.
  - Private folders `_folder` — opt a folder out of routing. The project's `_components/`,
    `constants.ts`, `helpers.ts`, `styles.ts` beside a route are safe because non-`page`/`route`
    files are never routable (colocation safety).
  - Parallel `@slot` and intercepting `(.)folder` routes are the Next-native pattern for
    slot layouts / modal-over-list. **Available but not currently used** — the project uses
    in-component drawers (e.g. `RunTraceDrawer`) instead. Prefer the existing pattern unless a
    route specifically benefits from intercepting routes.

## Page-local components — HIGH

Page-only components live in `src/app/<route>/_components/<PascalName>/` as a **self-contained
bundle**:

```
_components/AgentCard/
  AgentCard.tsx        # the component (PascalCase)
  index.ts             # barrel: export { AgentCard, AgentCard as default } from "./AgentCard";
  constants.ts         # (optional) component-local constants
  helpers.ts           # (optional) component-local pure logic
  styles.ts            # (optional) the `s` CSSProperties object
  AgentCard.test.tsx   # (optional) colocated test
```

- Nest `_components/` arbitrarily deep for sub-components owned by a view
  (`.../RunTraceDrawer/_components/{TraceBody,ToolCallRow,...}/`).
- **Route-wide** (not component-local) helpers/constants/styles sit **directly in the route
  folder**, not in a component bundle: `src/app/repos/[repoId]/pulls/{constants,helpers,styles}.ts`.
- Promote a `_components` component to `src/components/` **only** when a second route needs it.

## Shared components — HIGH

Two tiers:

- **`src/components/<kebab-domain>/`** — app-specific shared components (same bundle pattern;
  may have a `hooks/` subfolder). Domains in use: `app-shell`, `diff-viewer`, `mermaid-diagram`,
  `page-shell`, `repo-not-found`, `showcase`.
- **`@devdigest/ui` (`src/vendor/ui/`)** — the **do-not-touch** vendored design system
  (`primitives/`, `kit/`, `charts/`, `shell/`, `command-palette/`). **Always import from the
  package root `@devdigest/ui`**; never reach into a layer file, and never edit `vendor/`
  (CRITICAL — see `src/vendor/ui/README.md`).

## Constants — MEDIUM

- Colocated `constants.ts` per component/route. **No central `constants/` folder.**
- Tiny one-offs may live at the top of the file that uses them (e.g. `OPEN_STATUSES` in the
  pulls page).
- App-wide nav/config/tokens live in the vendor layer: `src/vendor/ui/nav.ts` (`NAV`,
  `SETTINGS_SECTIONS`, `SHORTCUTS`), `src/vendor/ui/primitives/tokens.ts` (`Severity`/`Category`
  unions, `SEV`/`CAT` maps).
- Avoid a growing shared "constants dumping ground" — keep them near their use.

## Utils / helpers — CRITICAL (cross-segment rule) / MEDIUM

- **Cross-cutting utilities → `src/lib/<name>.ts`** (flat kebab-case: `format.ts`,
  `github-urls.ts`, `model-label.ts`, `feature-models.ts`), imported via the `@/lib/…` alias.
- **Component-local logic → colocated `helpers.ts`.**
- **CRITICAL cross-segment import rule (from `client/INSIGHTS.md`):** anything shared across
  dynamic `[param]` route segments **must** live in `src/lib/` and be imported via the `@/`
  alias. Relative imports that traverse bracketed segments break TS path resolution. Do not
  deep-relative-import a helper across a `[param]` boundary.
- Don't let a single `utils.ts`/`helpers.ts` accrete unrelated functions — split by concern or
  move each next to its one user (cohesion > convenience).

## Business logic & data fetching — HIGH

- **All fetching goes through TanStack Query hooks in `src/lib/hooks/`**, one file per API
  domain (`core.ts`, `agents.ts`, `reviews.ts`, `trace.ts`, `repo-intel.ts`), re-exported from
  `src/lib/hooks/index.ts`. Hooks are `useXxx`, use typed `queryKey` arrays, and mutations
  `invalidate` / `setQueryData` on success.
- **The single HTTP layer is `src/lib/api.ts`** (`apiFetch<T>`, `api.{get,post,put,patch,del}`,
  `ApiError`). **Never raw-`fetch` in a component** (MEDIUM→HIGH). Layering: components render +
  wire events → hooks orchestrate stateful logic → `api.ts` performs I/O. (Separation of
  concerns: Felix Gerschau; Clean React Architecture; FullStackLabs.)

## State management — MEDIUM

- No Redux/Zustand. **Server state = TanStack Query cache.** **Cross-cutting client state =
  React Context providers in `src/lib/`** (`providers.tsx` stack, `repo-context.tsx`,
  `theme.tsx`, `toast.tsx`). **Local UI state = `useState`.**
- Prefer **composition / lifting content up** (`children`, slots) over prop drilling, and over
  reaching for Context when only a subtree needs the value. (Composition-over-prop-drilling.)

## Styling — HIGH (divergence from stated stack)

- The real convention is a **colocated `styles.ts` exporting an `s` object of `CSSProperties`**
  (and functions returning `CSSProperties`), keyed off **CSS custom properties**
  (`var(--border)`, `var(--text-primary)`, `var(--accent)`). ~22 `styles.ts` files.
- **Do not write Tailwind utility classes in components.** Tailwind 4 exists only as the
  token/reset base in `src/vendor/ui/styles.css` (`@import "tailwindcss"` + `@theme`).
- **There is no `cn()` / clsx / tailwind-merge helper** — class composition isn't used. Theme
  switches via the `data-theme` attribute on `<html>`.

## Tests — MEDIUM

- **Colocated `<Name>.test.tsx` next to the component.** No `__tests__/` folders.
- Stack: Vitest + jsdom + React Testing Library. Config `vitest.config.ts`; setup
  `src/test/setup.ts` (jest-dom matchers + `ResizeObserver` polyfill).
- **`@testing-library/user-event` is NOT installed — use `fireEvent`** (CRITICAL gotcha from
  INSIGHTS.md). `fetch` is mocked, so no API server is needed. (Query/assertion technique →
  `react-testing-library`.)

## Types — MEDIUM

- **Domain types are inferred from Zod contracts** in `src/vendor/shared/contracts/*.ts`
  (`z.infer`). `src/vendor/shared/` is **do-not-touch** — manually synced from `server/`.
- **App type surface = `src/lib/types.ts`** — re-exports contract types from `@devdigest/shared`
  and adds UI-only view models (e.g. `PrRowView`). Import `@/lib/types` or `@devdigest/shared`.
- **Component prop types / local interfaces live inline** in the component `.tsx`. **No
  app-level `types/` folder.**

## File naming — MEDIUM

- **React component files → PascalCase `.tsx`** (`AgentCard.tsx`, `PRRow.tsx`).
- **`_components/` folders → PascalCase** (`AgentCard/`); **`src/components/` domain folders and
  route segments → kebab-case** (`diff-viewer`, `onboarding`).
- **Non-component modules → kebab-case `.ts`** (`api.ts`, `github-urls.ts`, `model-label.ts`),
  plus the per-folder `constants.ts` / `helpers.ts` / `styles.ts` / `index.ts`.
- **Documented exception:** provider/context `.tsx` **modules** are kebab-case lowercase
  (`providers.tsx`, `theme.tsx`, `toast.tsx`, `repo-context.tsx`) — they export wiring, not a
  single named component.

## Anti-patterns — avoid

- Business logic or data fetching inside a `page.tsx`/component body (→ hooks + `helpers.ts`).
- Raw `fetch` in a component (→ `src/lib/hooks/` + `src/lib/api.ts`).
- A shared `utils.ts` that grows into an unrelated grab-bag (→ split by concern / colocate).
- Barrel re-exporting other barrels (circular deps, slow builds) — keep a barrel to its own
  folder's exports.
- Importing from inside `@devdigest/ui` layers, or editing anything under `src/vendor/`.
- Promoting a whole page to `"use client"` to make one leaf interactive.
- Tailwind utility classes / a `cn()` helper in components (→ `styles.ts` + CSS vars).
