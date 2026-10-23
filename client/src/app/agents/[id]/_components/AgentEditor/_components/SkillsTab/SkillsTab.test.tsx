import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, LinkedSkill, Skill } from "@devdigest/shared";
import messages from "@/../messages/en/agents.json";

const mutate = vi.fn();
let linked: LinkedSkill[] = [];
let all: Skill[] = [];

vi.mock("@/lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: linked, isLoading: false, isError: false }),
  useSetAgentSkills: () => ({ mutate, isPending: false }),
}));
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: all, isLoading: false, isError: false }),
}));

import { SkillsTab } from "./SkillsTab";

const AGENT = { id: "ag1", name: "Security Reviewer" } as Agent;

const skill = (id: string, name: string, extra: Partial<Skill> = {}): Skill => ({
  id,
  name,
  description: "",
  type: "security",
  source: "manual",
  body: "",
  enabled: true,
  version: 1,
  evidence_files: null,
  created_at: "2026-01-01T00:00:00.000Z",
  ...extra,
});

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mutate.mockReset();
  const a = skill("a", "pr-quality-rubric", { type: "rubric" });
  const b = skill("b", "secret-leakage-gate");
  const c = skill("c", "lethal-trifecta", { enabled: false });
  all = [a, b, c];
  linked = [
    { ...b, order: 0 },
    { ...a, order: 1 },
  ];
});
afterEach(cleanup);

describe("Agent SkillsTab", () => {
  it("shows the linked count and lists linked skills first, in order", () => {
    renderTab();
    expect(screen.getByText("2 of 3 enabled")).toBeInTheDocument();
    const names = screen.getAllByTestId(/^skill-row-/).map((r) => r.getAttribute("data-testid"));
    expect(names).toEqual([
      "skill-row-secret-leakage-gate",
      "skill-row-pr-quality-rubric",
      "skill-row-lethal-trifecta",
    ]);
  });

  it("checking an unlinked skill appends it to the ordered list", () => {
    renderTab();
    const row = screen.getByTestId("skill-row-lethal-trifecta");
    fireEvent.click(within(row).getByRole("checkbox"));
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["b", "a", "c"] });
  });

  it("unchecking a linked skill removes it", () => {
    renderTab();
    const row = screen.getByTestId("skill-row-secret-leakage-gate");
    fireEvent.click(within(row).getByRole("checkbox"));
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["a"] });
  });

  it("the arrows reorder; ends have no arrow in the blocked direction", () => {
    renderTab();
    const first = screen.getByTestId("skill-row-secret-leakage-gate");
    expect(within(first).queryByLabelText("Move up")).toBeNull();
    fireEvent.click(within(first).getByLabelText("Move down"));
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["a", "b"] });

    const unlinked = screen.getByTestId("skill-row-lethal-trifecta");
    expect(within(unlinked).queryByLabelText("Move up")).toBeNull();
    expect(within(unlinked).queryByLabelText("Move down")).toBeNull();
  });

  it("flags a globally disabled skill and filters by name", () => {
    renderTab();
    expect(within(screen.getByTestId("skill-row-lethal-trifecta")).getByText("disabled")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), { target: { value: "rubric" } });
    expect(screen.getAllByTestId(/^skill-row-/)).toHaveLength(1);
  });

  it("shows an empty state when the workspace has no skills", () => {
    all = [];
    linked = [];
    renderTab();
    expect(screen.getByText(/No skills in this workspace yet/)).toBeInTheDocument();
  });

  it("hides the reorder arrows while a filter is active (no swaps with hidden rows)", () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), { target: { value: "gate" } });
    const row = screen.getByTestId("skill-row-secret-leakage-gate");
    expect(within(row).queryByLabelText("Move down")).toBeNull();
    expect(within(row).queryByLabelText("Move up")).toBeNull();
  });
});
