import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "@/../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";
import { CONFIDENCE_HIGH, CONFIDENCE_MEDIUM } from "./constants";
import { confidenceColor, evidenceRef } from "./helpers";

afterEach(cleanup);

const CONV: ConventionCandidate = {
  id: "c1",
  category: "async",
  rule: "Always use async/await instead of .then() chains",
  evidence_path: "src/api/users.ts",
  evidence_line_start: 23,
  evidence_line_end: 31,
  evidence_snippet: "const user = await db.users.find(id);",
  confidence: 0.91,
  status: "pending",
  created_at: "2026-11-09T00:00:00Z",
};

function renderCard(over: Partial<ConventionCandidate> = {}) {
  const onStatus = vi.fn();
  const onEdit = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionCard convention={{ ...CONV, ...over }} onStatus={onStatus} onEdit={onEdit} />
    </NextIntlClientProvider>,
  );
  return { onStatus, onEdit };
}

describe("ConventionCard", () => {
  it("renders rule, evidence ref, snippet and confidence", () => {
    renderCard();
    expect(screen.getByText(CONV.rule)).toBeInTheDocument();
    expect(screen.getByText("src/api/users.ts:23-31")).toBeInTheDocument();
    expect(screen.getByText(CONV.evidence_snippet)).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });

  it("accept / reject from pending", () => {
    const { onStatus } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onStatus).toHaveBeenLastCalledWith("accepted");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onStatus).toHaveBeenLastCalledWith("rejected");
  });

  it("clicking the active toggle returns to pending", () => {
    const { onStatus } = renderCard({ status: "accepted" });
    const btn = screen.getByRole("button", { name: "Accepted" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn);
    expect(onStatus).toHaveBeenLastCalledWith("pending");
  });

  it("edits rule and category inline", () => {
    const { onEdit } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue(CONV.rule), { target: { value: "  Prefer async/await  " } });
    fireEvent.change(screen.getByDisplayValue("async"), { target: { value: "async-style" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEdit).toHaveBeenCalledWith({ rule: "Prefer async/await", category: "async-style" });
    // Back to read mode.
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("cannot save an empty rule; cancel discards", () => {
    const { onEdit } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue(CONV.rule), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText(CONV.rule)).toBeInTheDocument();
  });
});

describe("ConventionCard helpers", () => {
  it("pins the confidence bands", () => {
    expect([CONFIDENCE_HIGH, CONFIDENCE_MEDIUM]).toEqual([0.8, 0.6]);
    expect(confidenceColor(0.91)).toBe("var(--ok)");
    expect(confidenceColor(0.78)).toBe("var(--warn)");
    expect(confidenceColor(0.4)).toBe("var(--crit)");
  });
  it("formats evidence refs", () => {
    expect(evidenceRef(CONV)).toBe("src/api/users.ts:23-31");
    expect(evidenceRef({ ...CONV, evidence_line_end: 23 })).toBe("src/api/users.ts:23");
    expect(evidenceRef({ ...CONV, evidence_line_start: null, evidence_line_end: null })).toBe("src/api/users.ts");
  });
});
