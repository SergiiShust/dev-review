/**
 * FindingsPopover — scoping regression guards.
 *
 * The popover hangs off a findings badge and MUST agree with that badge's count:
 *  - PR list (no runId): the badge counts only the PR's LATEST review, so the
 *    popover must show that review's findings — not every review aggregated
 *    (the "badge says 4, popover says 11" bug).
 *  - Run timeline (runId set): only the findings from that run's review.
 */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReviewRecord } from "@devdigest/shared";
import { FindingsPopover } from "./FindingsPopover";

let mockReviews: ReviewRecord[] | undefined;
vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: () => ({ data: mockReviews }),
}));

beforeEach(() => {
  mockReviews = undefined;
});
afterEach(cleanup);

function finding(id: string, reviewId: string): ReviewRecord["findings"][number] {
  return {
    id,
    review_id: reviewId,
    severity: "WARNING",
    category: "bug",
    title: `Finding ${id}`,
    file: "src/foo.ts",
    start_line: 1,
    end_line: 1,
    rationale: "because",
    confidence: 0.8,
    accepted_at: null,
    dismissed_at: null,
  };
}

function review(
  o: Partial<ReviewRecord> & { id: string; created_at: string },
): ReviewRecord {
  return {
    pr_id: "pr-1",
    agent_id: "a1",
    run_id: null,
    kind: "review",
    verdict: null,
    summary: null,
    score: 70,
    model: "m",
    findings: [],
    ...o,
  };
}

/** Render with the anchor already mounted so the popover can position itself. */
function Harness({ runId }: { runId?: string | null }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  return (
    <>
      <div ref={ref}>anchor</div>
      {ready && <FindingsPopover prId="pr-1" runId={runId} visible anchorRef={ref} />}
    </>
  );
}

describe("FindingsPopover — PR-list (latest review) scope", () => {
  it("shows only the latest review's findings, matching the badge count", () => {
    // Older review has 3 findings; newest has 1. Badge counts the newest → 1.
    mockReviews = [
      review({
        id: "rev-new",
        created_at: "2026-06-11T20:00:00.000Z",
        findings: [finding("f1", "rev-new")],
      }),
      review({
        id: "rev-old",
        created_at: "2026-06-11T18:00:00.000Z",
        findings: [finding("f2", "rev-old"), finding("f3", "rev-old"), finding("f4", "rev-old")],
      }),
    ];
    render(<Harness />);
    expect(screen.getByText(/^1 FINDING$/)).toBeInTheDocument();
    expect(screen.getByText("Finding f1")).toBeInTheDocument();
    expect(screen.queryByText("Finding f2")).not.toBeInTheDocument();
  });

  it("ignores summary-kind reviews when picking the latest", () => {
    // A summary row is newer than the review row but carries no findings; it
    // must not win the 'latest' slot and blank the popover.
    mockReviews = [
      review({ id: "sum", kind: "summary", created_at: "2026-06-11T21:00:00.000Z", findings: [] }),
      review({
        id: "rev",
        created_at: "2026-06-11T20:00:00.000Z",
        findings: [finding("f1", "rev"), finding("f2", "rev")],
      }),
    ];
    render(<Harness />);
    expect(screen.getByText(/^2 FINDINGS$/)).toBeInTheDocument();
  });
});

describe("FindingsPopover — run-scoped", () => {
  it("shows only the given run's review findings", () => {
    mockReviews = [
      review({
        id: "rev-1",
        run_id: "run-1",
        created_at: "2026-06-11T20:00:00.000Z",
        findings: [finding("f1", "rev-1")],
      }),
      review({
        id: "rev-2",
        run_id: "run-2",
        created_at: "2026-06-11T19:00:00.000Z",
        findings: [finding("f2", "rev-2"), finding("f3", "rev-2")],
      }),
    ];
    render(<Harness runId="run-2" />);
    expect(screen.getByText(/^2 FINDINGS$/)).toBeInTheDocument();
    expect(screen.getByText("Finding f2")).toBeInTheDocument();
    expect(screen.queryByText("Finding f1")).not.toBeInTheDocument();
  });
});
