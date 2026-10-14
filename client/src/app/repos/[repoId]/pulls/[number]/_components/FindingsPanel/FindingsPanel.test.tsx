import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

const base = {
  category: "security" as const,
  file: "src/config.ts",
  start_line: 11,
  end_line: 11,
  rationale: "rationale",
  suggestion: null,
  confidence: 0.95,
  kind: "finding" as const,
  trifecta_components: null,
  evidence: null,
  review_id: "r1",
  accepted_at: null,
  dismissed_at: null,
};

const FINDINGS: FindingRecord[] = [
  { ...base, id: "f1", severity: "CRITICAL", title: "Hardcoded secret" },
];

const MIXED_FINDINGS: FindingRecord[] = [
  { ...base, id: "f1", severity: "CRITICAL", title: "Hardcoded secret" },
  { ...base, id: "f2", severity: "WARNING", title: "Missing validation" },
  { ...base, id: "f3", severity: "SUGGESTION", title: "Use const" },
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

describe("FindingsPanel severity filter", () => {
  it("renders three severity filter buttons", () => {
    renderWithIntl(<FindingsPanel findings={MIXED_FINDINGS} prId="pr1" />);
    // Three filter buttons (CRITICAL, WARNING, SUGGESTION)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("clicking a severity filter shows only findings of that severity", () => {
    renderWithIntl(<FindingsPanel findings={MIXED_FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("Missing validation")).toBeInTheDocument();
    expect(screen.getByText("Use const")).toBeInTheDocument();

    // Click the first filter button (CRITICAL)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]!);

    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.queryByText("Missing validation")).not.toBeInTheDocument();
    expect(screen.queryByText("Use const")).not.toBeInTheDocument();
  });

  it("clicking the same filter again clears it (shows all)", () => {
    renderWithIntl(<FindingsPanel findings={MIXED_FINDINGS} prId="pr1" />);
    const buttons = screen.getAllByRole("button");

    // Click CRITICAL to filter
    fireEvent.click(buttons[0]!);
    expect(screen.queryByText("Missing validation")).not.toBeInTheDocument();

    // Click CRITICAL again to clear
    fireEvent.click(buttons[0]!);
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("Missing validation")).toBeInTheDocument();
    expect(screen.getByText("Use const")).toBeInTheDocument();
  });
});
