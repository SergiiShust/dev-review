import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
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

function Harness({ initialTab = "config" }: { initialTab?: string }) {
  const [tab, setTab] = React.useState(initialTab);
  return <SkillEditor skill={SKILL} tab={tab} onTab={setTab} />;
}

function renderEditor(tab?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <Harness initialTab={tab} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
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
});
