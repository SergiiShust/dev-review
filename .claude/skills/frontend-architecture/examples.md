# UI Architecture — Examples (good / bad)

Concrete shapes for the rules in [SKILL.md](SKILL.md). Patterns mirror real `client/` code.

---

## 1. Thin page vs fat page

**Good — server wrapper renders a colocated view** (`src/app/agents/page.tsx` shape):

```tsx
// src/app/agents/page.tsx  (server component — no "use client")
import { AgentsListView } from "./_components/AgentsListView";

export default function AgentsPage() {
  return <AgentsListView />;
}
```

**Good — thin client shell holding only top-level hooks/state:**

```tsx
// src/app/repos/[repoId]/pulls/page.tsx
"use client";
import { usePulls } from "@/lib/hooks";
import { PRList } from "./_components/PRList";

export default function PullsPage() {
  const pulls = usePulls();          // data orchestration via hook
  return <PRList query={pulls} />;   // UI delegated to a colocated component
}
```

**Bad — logic and markup inline in the page:**

```tsx
"use client";
export default function PullsPage() {
  const [rows, setRows] = useState([]);
  useEffect(() => { fetch(`${API}/pulls`).then(r => r.json()).then(setRows); }, []); // ❌ raw fetch in page
  return <table>{/* ❌ 300 lines of row markup that belongs in _components */}</table>;
}
```

## 2. Push the `"use client"` boundary down

**Good — only the interactive leaf is a client component:**

```tsx
// FilterBar.tsx
"use client";
export function FilterBar(props: FilterBarProps) { /* onChange handlers */ }
```
```tsx
// page.tsx stays a server component and composes it
import { FilterBar } from "./_components/FilterBar";
export default function Page() {
  return <><FilterBar /* ... */ /><Results /></>;
}
```

**Bad — whole page marked client just to make one child interactive:**

```tsx
"use client"; // ❌ forces the entire subtree client-side for one button
export default function Page() { /* mostly static content + <FilterBar/> */ }
```

## 3. The `_components/<Name>/` bundle + barrel

```
src/app/agents/_components/AgentCard/
  AgentCard.tsx
  index.ts
  constants.ts
  helpers.ts
  styles.ts
  AgentCard.test.tsx
```

```ts
// index.ts — named + default re-export, barrel scoped to this folder only
export { AgentCard, AgentCard as default } from "./AgentCard";
```

**Bad:** a barrel that re-exports other barrels (`export * from "../_components"`) — hides
dependencies, risks circular imports, slows builds.

## 4. Styling — `styles.ts` with CSS vars, not Tailwind

**Good** (`styles.ts`):

```ts
import type { CSSProperties } from "react";
export const s = {
  card: { border: "1px solid var(--border)", background: "var(--surface)" } as CSSProperties,
  title: { color: "var(--text-primary)" } as CSSProperties,
  accent: (on: boolean): CSSProperties => ({ color: on ? "var(--accent)" : "var(--text-muted)" }),
};
```
```tsx
import { s } from "./styles";
<div style={s.card}><h3 style={s.title}>…</h3></div>
```

**Bad:**

```tsx
<div className="border rounded-lg bg-white dark:bg-zinc-900 p-4"> {/* ❌ no Tailwind utilities, no cn() */}
```

## 5. Data fetching — hook + `api.ts`, never raw fetch

**Good** (`src/lib/hooks/agents.ts`):

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AgentRecord } from "@devdigest/shared";

const keys = { all: ["agents"] as const, detail: (id: string) => ["agents", id] as const };

export function useAgents() {
  return useQuery({ queryKey: keys.all, queryFn: () => api.get<AgentRecord[]>("/agents") });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/agents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
```
```tsx
// component: render + wire events only
const { data, isPending } = useAgents();
```

**Bad:** `fetch("http://localhost:3001/agents")` inside a component — bypasses `api.ts`
(`ApiError` handling, base URL) and the Query cache.

## 6. Cross-segment import rule (CRITICAL)

**Good — shared util in `src/lib`, imported via `@/` alias:**

```ts
// src/lib/format.ts
export function formatCount(n: number) { /* … */ }
```
```tsx
// src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.tsx
import { formatCount } from "@/lib/format"; // ✅ alias resolves across [param] segments
```

**Bad — relative import traversing a `[param]` segment:**

```tsx
import { formatCount } from "../../../../../../lib/format"; // ❌ breaks TS resolution through [repoId]/[number]
```

## 7. Tests — colocated, `fireEvent` (no `user-event`)

```tsx
// src/app/agents/_components/AgentCard/AgentCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentCard } from "./AgentCard";

test("fires onSelect on click", () => {
  const onSelect = vi.fn();
  render(<AgentCard agent={fixture} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button")); // ✅ fireEvent — user-event is NOT installed
  expect(onSelect).toHaveBeenCalledOnce();
});
```
