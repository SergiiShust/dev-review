import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionSkillDraft } from "@devdigest/shared";
import conventions from "@/../messages/en/conventions.json";
import skills from "@/../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const DRAFT: ConventionSkillDraft = {
  name: "payments-api-conventions",
  description: "3 house conventions extracted from payments-api",
  type: "convention",
  enabled: true,
  body: "# payments-api-conventions\n\n## async-await-then-chains\nAlways use async/await.\n",
  accepted_count: 3,
};

const mutate = vi.fn();
let draftState: { data?: ConventionSkillDraft; isLoading: boolean; isError: boolean } = {
  data: DRAFT,
  isLoading: false,
  isError: false,
};
vi.mock("@/lib/hooks/conventions", () => ({
  useConventionSkillDraft: () => ({ ...draftState, refetch: vi.fn(), error: null }),
  useCreateConventionSkill: () => ({ mutate, isPending: false }),
}));

import { CreateConventionSkillModal } from "./CreateConventionSkillModal";

afterEach(() => {
  cleanup();
  mutate.mockReset();
  push.mockReset();
  draftState = { data: DRAFT, isLoading: false, isError: false };
});

function renderModal(onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
      <ToastProvider>
        <CreateConventionSkillModal repoId="r1" repoName="payments-api" onClose={onClose} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onClose };
}

describe("CreateConventionSkillModal", () => {
  it("prefills every field from the merged draft", () => {
    renderModal();
    expect(screen.getByText("Create skill from conventions")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Merged from 3 accepted conventions in payments-api. Everything below is editable before you save.",
    );
    expect(screen.getByDisplayValue("payments-api-conventions")).toBeInTheDocument();
    expect(screen.getByDisplayValue(DRAFT.description)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/## async-await-then-chains/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByText("payments-api-conventions.md")).toBeInTheDocument();
  });

  it("submits the edited draft and navigates to the new skill", () => {
    const { onClose } = renderModal();
    fireEvent.change(screen.getByDisplayValue("payments-api-conventions"), { target: { value: "  pay-rules  " } });
    fireEvent.change(screen.getByDisplayValue(/## async-await-then-chains/), { target: { value: "# edited" } });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [payload, opts] = mutate.mock.calls[0]!;
    expect(payload).toEqual({
      name: "pay-rules",
      description: DRAFT.description,
      type: "convention",
      enabled: false,
      body: "# edited",
    });
    opts.onSuccess({ id: "s9", name: "pay-rules" });
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/skills/s9");
  });

  it("blocks submit without a name or body", () => {
    renderModal();
    fireEvent.change(screen.getByDisplayValue("payments-api-conventions"), { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Create skill" })).toBeDisabled();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("shows a loading state while the draft merges", () => {
    draftState = { isLoading: true, isError: false };
    renderModal();
    expect(screen.getByText("Merging accepted conventions…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create skill" })).toBeNull();
  });
});
