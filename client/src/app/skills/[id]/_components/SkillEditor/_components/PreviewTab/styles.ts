import type { CSSProperties } from "react";

/** Co-located styles for PreviewTab. */
export const s = {
  wrap: { maxWidth: 860 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 16px" } satisfies CSSProperties,
  card: {
    padding: "20px 24px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 14,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  empty: { color: "var(--text-muted)", fontSize: 13 } satisfies CSSProperties,
} as const;
