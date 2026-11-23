import { describe, it, expect } from "vitest";
import { computeLineDiff, hasChanges, versionLabel, formatVersionDate } from "./helpers";

const kinds = (before: string, after: string) =>
  computeLineDiff(before, after).map((l) => `${l.kind}:${l.text}`);

describe("computeLineDiff", () => {
  it("marks identical bodies as all-same", () => {
    const diff = computeLineDiff("a\nb", "a\nb");
    expect(diff.every((l) => l.kind === "same")).toBe(true);
    expect(hasChanges(diff)).toBe(false);
  });

  it("detects an added line in the middle", () => {
    expect(kinds("a\nc", "a\nb\nc")).toEqual(["same:a", "add:b", "same:c"]);
  });

  it("detects a removed line", () => {
    expect(kinds("a\nb\nc", "a\nc")).toEqual(["same:a", "del:b", "same:c"]);
  });

  it("shows a changed line as delete-then-add", () => {
    expect(kinds("# Title\nold rule\nend", "# Title\nnew rule\nend")).toEqual([
      "same:# Title",
      "del:old rule",
      "add:new rule",
      "same:end",
    ]);
  });

  it("handles empty sides", () => {
    expect(kinds("", "x")).toEqual(["del:", "add:x"]);
    expect(hasChanges(computeLineDiff("x", "x"))).toBe(false);
  });

  it("keeps every line from both sides exactly once", () => {
    const before = "1\n2\n3\n4\n5";
    const after = "1\n3\nx\n4\n6";
    const diff = computeLineDiff(before, after);
    expect(diff.filter((l) => l.kind !== "add").map((l) => l.text)).toEqual(before.split("\n"));
    expect(diff.filter((l) => l.kind !== "del").map((l) => l.text)).toEqual(after.split("\n"));
  });
});

describe("versionLabel", () => {
  it("uses the first non-empty line without heading marks", () => {
    expect(versionLabel("\n\n## PR Quality Rubric\nbody")).toBe("PR Quality Rubric");
  });
  it("falls back to a dash for an empty body", () => {
    expect(versionLabel("  \n")).toBe("—");
  });
});

describe("formatVersionDate", () => {
  it("formats as YYYY-MM-DD HH:mm and passes through junk", () => {
    expect(formatVersionDate("2026-05-30T10:05:00")).toBe("2026-05-30 10:05");
    expect(formatVersionDate("not a date")).toBe("not a date");
  });
});
