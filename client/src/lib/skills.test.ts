import { describe, it, expect } from "vitest";
import { filterSkills, skillTypeColors } from "./skills";

const rows = [
  { name: "pr-quality-rubric", description: "Overall PR quality", type: "rubric" as const },
  { name: "no-then-chains", description: "Use async/await", type: "convention" as const },
];

describe("filterSkills", () => {
  it("returns everything for a blank query", () => {
    expect(filterSkills(rows, "  ")).toHaveLength(2);
  });
  it("matches name, description and type case-insensitively", () => {
    expect(filterSkills(rows, "ASYNC").map((r) => r.name)).toEqual(["no-then-chains"]);
    expect(filterSkills(rows, "rubric").map((r) => r.name)).toEqual(["pr-quality-rubric"]);
    expect(filterSkills(rows, "convention").map((r) => r.name)).toEqual(["no-then-chains"]);
  });
});

describe("skillTypeColors", () => {
  it("gives security the critical palette and custom a neutral one", () => {
    expect(skillTypeColors("security").color).toBe("var(--crit)");
    expect(skillTypeColors("custom").bg).toBe("var(--bg-hover)");
  });
});
