import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { buildRows, moveSkill, toggleSkill } from "./helpers";

const skill = (id: string, name: string): Skill => ({
  id,
  name,
  description: "",
  type: "custom",
  source: "manual",
  body: "",
  enabled: true,
  version: 1,
  evidence_files: null,
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("toggleSkill", () => {
  it("appends an unlinked skill to the end", () => {
    expect(toggleSkill(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });
  it("removes a linked skill, keeping the others' order", () => {
    expect(toggleSkill(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});

describe("moveSkill", () => {
  it("swaps with the previous / next neighbour", () => {
    expect(moveSkill(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveSkill(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });
  it("is a no-op at the ends and for unlinked ids", () => {
    expect(moveSkill(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveSkill(["a", "b"], "b", "down")).toEqual(["a", "b"]);
    expect(moveSkill(["a", "b"], "zz", "up")).toEqual(["a", "b"]);
  });
});

describe("buildRows", () => {
  const all = [skill("1", "zeta"), skill("2", "alpha"), skill("3", "mid"), skill("4", "beta")];

  it("lists linked skills first in link order, then the rest by name", () => {
    const rows = buildRows(all, ["3", "1"]);
    expect(rows.map((r) => [r.skill.name, r.linked, r.position])).toEqual([
      ["mid", true, 0],
      ["zeta", true, 1],
      ["alpha", false, -1],
      ["beta", false, -1],
    ]);
  });

  it("drops linked ids whose skill no longer exists", () => {
    expect(buildRows(all, ["gone", "2"]).filter((r) => r.linked).map((r) => r.skill.name)).toEqual(["alpha"]);
  });
});
