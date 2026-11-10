import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import { SKILL_BODY_MAX_CHARS } from "@/lib/skills";
import messages from "@/../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const mutate = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate, isPending: false }),
  useSkillVersions: () => ({
    data: [
      { skill_id: "s1", version: 2, body: "# Rubric\nnew rule", created_at: "2026-05-30T10:00:00Z" },
      { skill_id: "s1", version: 1, body: "# Rubric\nold rule", created_at: "2026-03-02T10:00:00Z" },
    ],
    isLoading: false,
    isError: false,
  }),
  useRestoreSkillVersion: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillEditor } from "./SkillEditor";

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

const SKILL: Skill = {
  id: "s1",
  name: "pr-quality-rubric",
  description: "Rubric for PR quality",
  type: "rubric",
  source: "manual",
  body: "# Rubric\nnew rule",
  enabled: true,
  version: 2,
  evidence_files: null,
  created_at: "2026-03-02T10:00:00Z",
};

function Harness({ initialTab = "config", skill = SKILL }: { initialTab?: string; skill?: Skill }) {
  const [tab, setTab] = React.useState(initialTab);
  return <SkillEditor skill={skill} tab={tab} onTab={setTab} />;
}

function wrap(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>
  );
}

function renderEditor(tab?: string) {
  return render(wrap(<Harness initialTab={tab} />));
}

describe("SkillEditor", () => {
  it("renders the Config tab with Save disabled until something changes", () => {
    renderEditor();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByDisplayValue("pr-quality-rubric")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: /^Save$/ });
    expect(save).toBeDisabled();
    expect(screen.queryByText("unsaved")).toBeNull();
  });

  it("keeps unsaved body edits across tabs and previews them", () => {
    renderEditor();
    fireEvent.change(screen.getByDisplayValue(/new rule/), { target: { value: "# Draft heading\n- draft item" } });
    expect(screen.getByText("unsaved")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Preview"));
    expect(screen.getByRole("heading", { name: "Draft heading" })).toBeInTheDocument();
    expect(screen.getByText("draft item")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Config"));
    expect(screen.getByDisplayValue(/draft item/)).toBeInTheDocument();
  });

  it("saves the full draft", () => {
    renderEditor();
    fireEvent.change(screen.getByDisplayValue("Rubric for PR quality"), { target: { value: "New description" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(mutate).toHaveBeenCalledWith(
      {
        id: "s1",
        patch: {
          name: "pr-quality-rubric",
          description: "New description",
          type: "rubric",
          body: "# Rubric\nnew rule",
          enabled: true,
        },
      },
      expect.anything(),
    );
  });

  it("Versions tab marks the current version and diffs an older one against it", () => {
    renderEditor("versions");
    expect(screen.getByText("2 versions")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Diff/ }));
    const diff = screen.getByTestId("skill-diff");
    expect(diff.textContent).toContain("-old rule");
    expect(diff.textContent).toContain("+new rule");
  });

  it("a server-side enabled change (rail toggle) syncs into the draft without marking it dirty", () => {
    const { rerender } = render(wrap(<Harness skill={SKILL} />));
    rerender(wrap(<Harness skill={{ ...SKILL, enabled: false }} />));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("unsaved")).toBeNull();
  });

  it("keeps the user's unsaved body edit when an unrelated field changes server-side", () => {
    const { rerender } = render(wrap(<Harness skill={SKILL} />));
    fireEvent.change(screen.getByDisplayValue(/new rule/), { target: { value: "my edit" } });
    rerender(wrap(<Harness skill={{ ...SKILL, enabled: false }} />));
    expect(screen.getByDisplayValue("my edit")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("blocks saving a body over the limit", () => {
    renderEditor();
    fireEvent.change(screen.getByDisplayValue(/new rule/), { target: { value: "x".repeat(SKILL_BODY_MAX_CHARS + 1) } });
    expect(screen.getByText(/the limit is/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeDisabled();
  });
});
