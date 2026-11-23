import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "@/../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "s1",
  name: "secret-leakage-gate",
  description: "Detects sk_live and service_role keys",
  type: "security",
  source: "manual",
  body: "# Gate",
  enabled: true,
  version: 3,
  evidence_files: null,
  created_at: "2026-01-01T00:00:00.000Z",
  agent_count: 2,
};

function renderCard(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillCard", () => {
  it("renders name, type, source, version and agent count", () => {
    renderCard(<SkillCard skill={SKILL} />);
    expect(screen.getByText("secret-leakage-gate")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
  });

  it("toggling enabled does not trigger the card click", () => {
    const onClick = vi.fn();
    const onToggle = vi.fn();
    renderCard(<SkillCard skill={SKILL} onClick={onClick} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});
