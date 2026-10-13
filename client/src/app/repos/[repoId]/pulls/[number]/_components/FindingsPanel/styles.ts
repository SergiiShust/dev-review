import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
  } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  pillGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  } satisfies CSSProperties,
  pill: (active: boolean): CSSProperties => ({
    cursor: "pointer",
    borderRadius: 5,
    outline: active ? "2px solid var(--accent)" : "2px solid transparent",
    outlineOffset: 1,
    opacity: active ? 1 : 0.75,
    transition: "outline .15s, opacity .15s",
  }),
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
