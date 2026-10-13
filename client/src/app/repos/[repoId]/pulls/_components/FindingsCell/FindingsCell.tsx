"use client";

import React from "react";
import { SeverityBadge } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";

type FindingsSeverity = "CRITICAL" | "WARNING" | "SUGGESTION";
const SEVS: FindingsSeverity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

export function FindingsCell({
  counts,
}: {
  counts: PrMeta["findings_counts"];
}) {
  if (!counts || (counts.CRITICAL === 0 && counts.WARNING === 0 && counts.SUGGESTION === 0)) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {SEVS.map((sev) => {
        const n = counts[sev];
        if (!n) return null;
        return <SeverityBadge key={sev} severity={sev} count={n} compact />;
      })}
    </div>
  );
}
