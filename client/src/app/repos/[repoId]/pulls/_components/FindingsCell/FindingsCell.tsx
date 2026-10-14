"use client";

import React from "react";
import { SeverityBadge } from "@devdigest/ui";

type SeverityCounts = { CRITICAL: number; WARNING: number; SUGGESTION: number };

const SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const;

export function FindingsCell({ counts }: { counts: SeverityCounts | null | undefined }) {
  if (!counts) return <span style={{ color: "var(--text-muted)" }}>—</span>;

  const hasAny = SEVERITIES.some((s) => counts[s] > 0);
  if (!hasAny) return <span style={{ color: "var(--text-muted)" }}>—</span>;

  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {SEVERITIES.map(
        (sev) =>
          counts[sev] > 0 && (
            <SeverityBadge key={sev} severity={sev} count={counts[sev]} compact />
          ),
      )}
    </span>
  );
}
