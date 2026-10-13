"use client";

import React from "react";
import { SeverityBadge, CategoryTag } from "@devdigest/ui";
import type { Severity, Category } from "@devdigest/ui";
import { usePrReviews } from "@/lib/hooks/reviews";
import type { CSSProperties } from "react";

const MAX_PREVIEW = 10;
const TRUNCATE_LEN = 120;

export function FindingsPopover({
  prId,
  visible,
}: {
  prId: string;
  visible: boolean;
}) {
  const { data: reviews, isLoading } = usePrReviews(visible ? prId : null);

  const latestReview = React.useMemo(() => {
    if (!reviews) return null;
    const reviewOnly = reviews.filter((r) => r.kind === "review");
    return reviewOnly.length > 0 ? reviewOnly[0] : null;
  }, [reviews]);

  const findings = latestReview?.findings ?? [];

  if (!visible) return null;

  return (
    <div style={popoverStyle}>
      {isLoading ? (
        <div style={loadingStyle}>Loading…</div>
      ) : findings.length === 0 ? (
        <div style={loadingStyle}>No findings</div>
      ) : (
        <>
          <div style={headerStyle}>
            {findings.length} FINDING{findings.length !== 1 ? "S" : ""}
          </div>
          <div style={listStyle}>
            {findings.slice(0, MAX_PREVIEW).map((f) => (
              <div key={f.id} style={rowStyle}>
                <SeverityBadge severity={f.severity as Severity} compact />
                <span style={titleStyle}>{f.title}</span>
                <CategoryTag category={f.category as Category} />
                <span style={fileStyle}>
                  {f.file}:{f.start_line}
                </span>
                <span style={rationaleStyle}>
                  {f.rationale.length > TRUNCATE_LEN
                    ? f.rationale.slice(0, TRUNCATE_LEN) + "…"
                    : f.rationale}
                </span>
              </div>
            ))}
            {findings.length > MAX_PREVIEW && (
              <div style={moreStyle}>+{findings.length - MAX_PREVIEW} more</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const popoverStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  zIndex: 50,
  minWidth: 360,
  maxWidth: 480,
  maxHeight: 400,
  overflowY: "auto",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,.25)",
  padding: "8px 0",
  marginTop: 4,
};

const headerStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: "var(--text-muted)",
  padding: "4px 12px 8px",
  borderBottom: "1px solid var(--border)",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  fontSize: 12,
  borderBottom: "1px solid var(--border)",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 180,
};

const fileStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
};

const rationaleStyle: CSSProperties = {
  width: "100%",
  fontSize: 11,
  color: "var(--text-secondary)",
  lineHeight: 1.4,
  marginTop: 2,
};

const loadingStyle: CSSProperties = {
  padding: "12px 16px",
  fontSize: 12,
  color: "var(--text-muted)",
};

const moreStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: 11,
  color: "var(--text-muted)",
  fontStyle: "italic",
};
