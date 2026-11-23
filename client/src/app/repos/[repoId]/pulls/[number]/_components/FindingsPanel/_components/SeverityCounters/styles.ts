import type { CSSProperties } from "react";

export const s = {
  row: { display: "flex", gap: 6, flexWrap: "wrap" } satisfies CSSProperties,
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "opacity .15s, background .15s",
  } satisfies CSSProperties,
} as const;
