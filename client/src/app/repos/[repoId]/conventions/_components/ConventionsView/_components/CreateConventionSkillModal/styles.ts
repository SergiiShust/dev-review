import type { CSSProperties } from "react";

/** Co-located styles for CreateConventionSkillModal (mirrors the "Create skill from conventions" mockup). */
export const s = {
  body: { padding: 24, maxHeight: "68vh", overflowY: "auto" } satisfies CSSProperties,
  banner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    marginBottom: 20,
    borderRadius: 8,
    background: "var(--accent-bg)",
    color: "var(--text-secondary)",
    fontSize: 13,
    lineHeight: 1.5,
  } satisfies CSSProperties,
  bannerIcon: { color: "var(--accent-text)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  bannerRepo: { color: "var(--accent-text)" } satisfies CSSProperties,
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 } satisfies CSSProperties,
  enabledRow: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  enabledHint: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  bodyMeta: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  tokens: { color: "var(--text-muted)" } satisfies CSSProperties,
  footer: { display: "flex", alignItems: "center", gap: 10, width: "100%" } satisfies CSSProperties,
  footerNote: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginRight: "auto",
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  state: { padding: 24 } satisfies CSSProperties,
} as const;
