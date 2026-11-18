import type { CSSProperties } from "react";

/** Co-located styles for the Conventions page (mirrors the "Conventions in <repo>" mockup). */
export const s = {
  wrap: { maxWidth: 1080, margin: "0 auto", padding: "28px 32px 48px" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 22 } satisfies CSSProperties,
  headerText: { minWidth: 0, flex: 1 } satisfies CSSProperties,
  title: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 } satisfies CSSProperties,
  titleRepo: { color: "var(--accent)" } satisfies CSSProperties,
  subtitle: { fontSize: 14, color: "var(--text-secondary)", marginTop: 6 } satisfies CSSProperties,
  dropped: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 14, marginBottom: 18 } satisfies CSSProperties,
  acceptedCount: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  toolbarRight: { marginLeft: "auto" } satisfies CSSProperties,
  loadingStack: { display: "flex", flexDirection: "column", gap: 14 } satisfies CSSProperties,
} as const;
