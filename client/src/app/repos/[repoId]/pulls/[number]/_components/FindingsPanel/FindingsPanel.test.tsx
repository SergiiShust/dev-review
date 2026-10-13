import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

function makeFinding(overrides: Partial<FindingRecord> & { id: string; severity: string }): FindingRecord {
  return {
    category: "security",
    title: `Finding ${overrides.id}`,
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "Explanation.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...overrides,
  } as FindingRecord;
}

const FINDINGS: FindingRecord[] = [
  makeFinding({ id: "f1", severity: "CRITICAL", title: "Hardcoded secret" }),
  makeFinding({ id: "f2", severity: "WARNING", title: "Missing validation" }),
  makeFinding({ id: "f3", severity: "WARNING", title: "Unhandled error" }),
  makeFinding({ id: "f4", severity: "SUGGESTION", title: "Use const", confidence: 0.4 }),
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

describe("FindingsPanel — severity pills", () => {
  it("renders pills only for present severities", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByTestId("severity-pill-CRITICAL")).toBeInTheDocument();
    expect(screen.getByTestId("severity-pill-WARNING")).toBeInTheDocument();
    expect(screen.getByTestId("severity-pill-SUGGESTION")).toBeInTheDocument();
  });

  it("does not render pills for absent severities", () => {
    const critOnly = [FINDINGS[0]!];
    renderWithIntl(<FindingsPanel findings={critOnly} prId="pr1" />);
    expect(screen.getByTestId("severity-pill-CRITICAL")).toBeInTheDocument();
    expect(screen.queryByTestId("severity-pill-WARNING")).not.toBeInTheDocument();
    expect(screen.queryByTestId("severity-pill-SUGGESTION")).not.toBeInTheDocument();
  });

  it("click pill → only that severity's cards shown", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(screen.getByTestId("severity-pill-CRITICAL"));
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.queryByText("Missing validation")).not.toBeInTheDocument();
    expect(screen.queryByText("Unhandled error")).not.toBeInTheDocument();
  });

  it("click pill again → filter removed, all cards back", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(screen.getByTestId("severity-pill-CRITICAL"));
    expect(screen.queryByText("Missing validation")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("severity-pill-CRITICAL"));
    expect(screen.getByText("Missing validation")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("pill counts respect hideLow toggle", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    // SUGGESTION pill should be visible (low-confidence finding f4 is included)
    expect(screen.getByTestId("severity-pill-SUGGESTION")).toBeInTheDocument();
    // Toggle hideLow on
    fireEvent.click(screen.getByRole("switch"));
    // SUGGESTION pill should disappear (f4 has confidence 0.4 < 0.65 threshold)
    expect(screen.queryByTestId("severity-pill-SUGGESTION")).not.toBeInTheDocument();
  });
});
