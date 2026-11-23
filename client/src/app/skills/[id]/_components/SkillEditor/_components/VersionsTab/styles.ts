import type { CSSProperties } from "react";
import type { DiffLine } from "./helpers";

/** Co-located styles for VersionsTab. Diff colors use the design-system code tokens. */
export const s = {
  wrap: { maxWidth: 860 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 16px" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  empty: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  row: (current: boolean): CSSProperties => ({
    borderRadius: 8,
    border: "1px solid " + (current ? "var(--border-strong)" : "var(--border)"),
    background: "var(--bg-elevated)",
    padding: "12px 14px",
  }),
  rowHead: { display: "flex", alignItems: "center", gap: 14 } satisfies CSSProperties,
  versionChip: (current: boolean): CSSProperties => ({
    fontSize: 13,
    fontWeight: 600,
    padding: "4px 9px",
    borderRadius: 6,
    color: current ? "var(--accent-text)" : "var(--text-secondary)",
    background: current ? "var(--accent-bg)" : "var(--bg-hover)",
    flexShrink: 0,
  }),
  rowText: { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 } satisfies CSSProperties,
  firstLine: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  date: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  actions: { display: "flex", gap: 8, flexShrink: 0 } satisfies CSSProperties,
  diffWrap: { marginTop: 12 } satisfies CSSProperties,
  diffCaption: { fontSize: 12, color: "var(--text-muted)", marginBottom: 6 } satisfies CSSProperties,
  diffPre: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    overflow: "auto",
    maxHeight: 420,
    padding: "6px 0",
  } satisfies CSSProperties,
  diffLine: (kind: DiffLine["kind"]): CSSProperties => ({
    padding: "0 12px",
    whiteSpace: "pre-wrap",
    color:
      kind === "add" ? "var(--code-add-text)" : kind === "del" ? "var(--code-del-text)" : "var(--text-secondary)",
    background: kind === "add" ? "var(--code-add)" : kind === "del" ? "var(--code-del)" : "transparent",
  }),
  diffMarker: { display: "inline-block", width: 16, userSelect: "none", opacity: 0.7 } satisfies CSSProperties,
} as const;
