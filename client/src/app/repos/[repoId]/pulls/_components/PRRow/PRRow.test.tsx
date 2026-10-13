import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

function pr(o: Partial<PrMeta> = {}): PrMeta {
  return {
    id: "pr-1",
    number: 42,
    title: "Add rate limiting",
    author: "alice",
    branch: "feat/rl",
    base: "main",
    head_sha: "abc1234",
    additions: 50,
    deletions: 10,
    files_count: 3,
    status: "needs_review",
    opened_at: null,
    updated_at: "2026-06-10T10:00:00Z",
    score: null,
    cost_usd: null,
    ...o,
  };
}

function renderRow(prData: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={prData} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow — cost column", () => {
  it("renders cost when present", () => {
    renderRow(pr({ cost_usd: 0.014 }));
    expect(screen.getByText("$0.014")).toBeInTheDocument();
  });

  it("renders dash when cost is null", () => {
    renderRow(pr({ cost_usd: null }));
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
