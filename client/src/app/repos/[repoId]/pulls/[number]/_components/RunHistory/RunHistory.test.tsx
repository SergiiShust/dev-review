/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary, ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { RunHistory } from "./RunHistory";

let mockReviews: ReviewRecord[] | undefined;
vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: () => ({ data: mockReviews }),
}));

beforeEach(() => {
  mockReviews = undefined;
});
afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    cost_usd: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — severity badges", () => {
  it("renders severity badges when severity_counts present on a settled run", () => {
    renderRuns([
      run({
        status: "done",
        findings_count: 4,
        severity_counts: { CRITICAL: 1, WARNING: 3, SUGGESTION: 0 },
        score: 60,
      }),
    ]);
    // SeverityBadge renders count inside a .tnum span; "3" is unique to WARNING
    expect(screen.getByText("3", { selector: ".tnum" })).toBeInTheDocument();
    // Should NOT fall back to text findings count
    expect(screen.queryByText(/4 finding/)).not.toBeInTheDocument();
  });

  it("falls back to text findings count when severity_counts is null", () => {
    renderRuns([
      run({ status: "done", findings_count: 3, severity_counts: null, score: 72 }),
    ]);
    expect(screen.getByText(/3 finding/)).toBeInTheDocument();
  });
});

describe("RunHistory — cost display", () => {
  it("settled run shows tokens and cost", () => {
    renderRuns([run({ cost_usd: 0.0013, tokens_in: 9119, tokens_out: 1200 })]);
    expect(screen.getByText(/\$0\.0013/)).toBeInTheDocument();
    expect(screen.getByText(/9k→1\.2k/)).toBeInTheDocument();
  });

  it("settled run with cost but no tokens shows only cost", () => {
    renderRuns([run({ cost_usd: 0.05, tokens_in: null, tokens_out: null })]);
    expect(screen.getByText(/\$0\.050/)).toBeInTheDocument();
    expect(screen.queryByText(/k→/)).not.toBeInTheDocument();
  });

  it("settled run with tokens but no cost shows only tokens", () => {
    renderRuns([run({ cost_usd: null, tokens_in: 5000, tokens_out: 800 })]);
    expect(screen.getByText(/5k→0\.8k/)).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("running run shows neither tokens nor cost", () => {
    renderRuns([run({ status: "running", cost_usd: null, tokens_in: null, tokens_out: null })]);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/k→/)).not.toBeInTheDocument();
  });
});

describe("RunHistory — findings popover scopes to the hovered run", () => {
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
  function review(id: string, runId: string, findingIds: string[]): ReviewRecord {
    return {
      id,
      pr_id: "pr-1",
      agent_id: "a1",
      run_id: runId,
      kind: "review",
      verdict: null,
      summary: null,
      score: 70,
      model: "m",
      created_at: "2026-06-11T18:44:34.000Z",
      findings: findingIds.map((f) => finding(f, id)),
    };
  }

  function renderWithReviews(runs: RunSummary[]) {
    return render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <RunHistory runs={runs} prId="pr-1" onOpenTrace={() => {}} />
      </NextIntlClientProvider>,
    );
  }

  it("shows only the hovered run's findings + count, not the PR-wide total", () => {
    vi.useFakeTimers();
    // PR has two runs: run-1 produced 1 finding, run-2 produced 3. The PR-wide
    // total is 4, but hovering run-1's badges must read "1 FINDING".
    mockReviews = [
      review("rev-1", "run-1", ["f1"]),
      review("rev-2", "run-2", ["f2", "f3", "f4"]),
    ];
    const { container } = renderWithReviews([
      run({
        run_id: "run-1",
        status: "done",
        severity_counts: { CRITICAL: 0, WARNING: 1, SUGGESTION: 0 },
        score: 70,
      }),
    ]);

    // The severity-badge group (span with gap:4) is the popover anchor that
    // carries the mouse handlers. mouseenter doesn't bubble, so target it exactly.
    const anchor = container.querySelector('span[style*="gap: 4px"]') as HTMLElement;
    expect(anchor).toBeTruthy();
    fireEvent.mouseEnter(anchor);
    act(() => void vi.advanceTimersByTime(250)); // clear the 200ms show delay

    expect(screen.getByText(/^1 FINDING$/)).toBeInTheDocument();
    expect(screen.queryByText(/4 FINDING/)).not.toBeInTheDocument();
    expect(screen.getByText("Finding f1")).toBeInTheDocument();
    expect(screen.queryByText("Finding f2")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
