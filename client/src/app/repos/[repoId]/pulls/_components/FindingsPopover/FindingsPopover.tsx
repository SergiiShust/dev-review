"use client";

import React from "react";
import { createPortal } from "react-dom";
import { SeverityBadge, CategoryTag, type Severity, type Category } from "@devdigest/ui";
import type { ReviewRecord } from "@devdigest/shared";
import { usePrReviews } from "@/lib/hooks/reviews";

const SEV_ORDER: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

/**
 * Each agent's latest `kind: "review"` review. Mirrors the server's PR-list
 * badge, which sums findings across every agent's latest review
 * (server/src/modules/pulls/routes.ts:118-143). Rows are sorted by `created_at`
 * desc then deduped by `agent_id`, so the result is order-independent of the API
 * response. Summary-kind rows carry no findings and are excluded so they can't
 * win an agent's "latest" slot.
 */
function latestReviewsPerAgent(reviews: ReviewRecord[]): ReviewRecord[] {
  const sorted = [...reviews]
    .filter((r) => r.kind === "review")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const seen = new Set<string>();
  const out: ReviewRecord[] = [];
  for (const r of sorted) {
    const key = r.agent_id ?? "none";
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

interface Props {
  prId: string;
  visible: boolean;
  /** Anchor element to position the popover below. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /**
   * Scope the popover to a single run's review(s). When set, only findings from
   * reviews with this `run_id` are shown and counted. Omitted on the PR list,
   * where the popover intentionally aggregates every review of the PR.
   */
  runId?: string | null;
}

export function FindingsPopover({ prId, visible, anchorRef, runId }: Props) {
  const { data: reviews } = usePrReviews(visible ? prId : null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    if (!visible || !anchorRef.current) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [visible, anchorRef]);

  if (!visible || !pos) return null;

  // Scope the findings to match the badge the popover hangs off of:
  //  - run timeline (runId set): the review(s) produced by that specific run;
  //  - PR list (no runId): each agent's latest review, summed — the same rule the
  //    PR row's findings badge uses. Scoping to a single review here would make
  //    the popover read "1" against a multi-agent badge of "5".
  const reviewList = reviews ?? [];
  const scoped = runId
    ? reviewList.filter((r) => r.run_id === runId)
    : latestReviewsPerAgent(reviewList);
  const allFindings = scoped.flatMap((r) => r.findings);
  if (allFindings.length === 0) return null;

  const sorted = [...allFindings].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity as Severity) - SEV_ORDER.indexOf(b.severity as Severity),
  );
  const top = sorted.slice(0, 3);

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        width: 340,
        maxWidth: 340,
        overflow: "hidden",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          textTransform: "uppercase",
        }}
      >
        {allFindings.length} FINDING{allFindings.length !== 1 ? "S" : ""}
      </div>
      {top.map((f) => (
        <div
          key={f.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            padding: "6px 0",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SeverityBadge severity={f.severity as Severity} compact />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {f.title}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)", minWidth: 0 }}>
            <span style={{ flexShrink: 0 }}><CategoryTag category={f.category as Category} /></span>
            <span className="mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{f.file}:{f.start_line}</span>
            <span style={{ flexShrink: 0, opacity: 0.7 }}>{Math.round(f.confidence * 100)}%</span>
          </div>
          {f.rationale && (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {f.rationale.slice(0, 120)}
              {f.rationale.length > 120 ? "\u2026" : ""}
            </div>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
