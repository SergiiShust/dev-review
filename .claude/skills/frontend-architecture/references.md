# UI Architecture Skill — References and Sources

All sources used to build this skill, kept so the skill can be reviewed and updated later.
Each entry notes what rule in [SKILL.md](SKILL.md) it backs.

---

## Primary / authoritative

- **Next.js — Project structure and organization**
  https://nextjs.org/docs/app/getting-started/project-structure
  Backs: App Router routing surface, segment-file roles, colocation safety, private folders
  `_folder`, route groups `(group)`, parallel `@slot` / intercepting `(.)folder` routes. Note:
  "Next.js is unopinionated… choose a strategy and be consistent."

- **Feature-Sliced Design — Overview (layers / slices / segments, import rule)**
  https://feature-sliced.design/docs/get-started/overview
  Backs: the layered mental model (shared vs feature-local), "import only from layers below /
  never sideways", and the shared layer as the home for cross-cutting code.

- **Kent C. Dodds — Colocation** ("place code as close to where it's relevant as possible")
  https://kentcdodds.com/blog/colocation
  Backs: the guiding principle ("colocate until it hurts"), colocated constants/helpers/styles/
  tests, and keeping utils next to their one user instead of a shared dumping ground.

- **Kent C. Dodds — The Power of Principles in Web Development Decision-Making**
  https://www.epicweb.dev/the-power-of-principles-in-web-development-decision-making
  Backs: principle-driven placement decisions over rigid folder dogma.

- **Robin Wieruch — React Folder Structure Best Practices**
  https://www.robinwieruch.de/react-folder-structure/
  Backs: the "promote when 2+ features need it / blast radius" rule, shared `components/` for
  reusable UI only, feature-local code staying with its feature, and features not importing
  each other.

## Supporting / consensus (2025–26)

- **Netguru — Professional React Project Structure (2025)**
  https://www.netguru.com/blog/react-project-structure
  Backs: feature-based organization and the shared layer; organize by domain, not file type.

- **DZone — Production-Grade React Project Structure**
  https://dzone.com/articles/production-grade-react-project-structure
  Backs: pages/routes as composition points; separating UI from logic.

- **Felix Gerschau — Separation of concerns with React hooks**
  https://felixgerschau.com/react-hooks-separation-of-concerns/
  Backs: components render, hooks hold stateful logic, pure functions stay framework-agnostic.

- **Clean React Architecture — Separating Logic from Presentation with Custom Hooks and React Query**
  https://medium.com/@echilaka/clean-react-architecture-separating-logic-from-presentation-with-custom-hooks-and-react-query-1904e9cc1eb0
  Backs: the hooks-over-`api.ts` data layer; thin presentational components.

- **FullStackLabs — Production-Level Patterns for React Hooks**
  https://www.fullstacklabs.co/blog/production-level-patterns-for-react-hooks
  Backs: hooks as the glue between presentation and data layers; caution on hook sprawl.

- **kitemetric — Banish "Helpers" and "Utils" Folders (cohesion)**
  https://kitemetric.com/blogs/banish-helpers-and-utils-folders-improve-software-cohesion
  Backs: the anti-pattern against a low-cohesion shared `utils.ts`; move a function to the
  module that uses it.

- **DEV (knzt) — Helpers and Utils folders in software architecture**
  https://dev.to/knzt/helpers-and-utils-folders-in-software-architecture-3f8h
  Backs: split utilities by domain rather than one giant file.

- **Steven Lemon — Are TypeScript Barrel Files an Anti-pattern?**
  https://steven-lemon182.medium.com/are-typescript-barrel-files-an-anti-pattern-72a713004250
  Backs: the "no barrel-of-barrels" anti-pattern (circular deps / slow builds); keep a barrel to
  its own folder.

- **paradigmadigital — Compound components to avoid prop drilling**
  https://en.paradigmadigital.com/dev/compound-components-elegant-robust-simple-way-avoid-prop-drilling-react-apps/
  Backs: composition over prop drilling in state management.

- **freeCodeCamp — How to avoid prop drilling in React**
  https://www.freecodecamp.org/news/avoid-prop-drilling-in-react/
  Backs: prefer `children`/slots and lifting content up before reaching for Context.

---

## In-repo sources (project conventions this skill codifies)

- `client/CLAUDE.md` — layout, conventions, do-not-touch
- `client/README.md` — route map, API-hook layer, "pages are thin" philosophy
- `client/INSIGHTS.md` — cross-segment import rule, no `user-event`, portal/popover gotchas,
  manual shared-contract sync
- `client/src/vendor/ui/README.md` — design-system layers, one-component-per-file, inline styles
  off CSS vars

## Maintenance notes

- All external links verified reachable as of 2026-10-16.
- Blog/community sources are consensus, not authority — prefer the primary sources and the
  in-repo conventions when they conflict.
- When updating, re-verify that every `client/` path cited in SKILL.md still exists.
