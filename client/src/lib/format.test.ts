import { describe, it, expect } from "vitest";
import { formatCost } from "./format";

describe("formatCost — adaptive precision USD formatting", () => {
  it.each([
    [null, "—"],
    [undefined, "—"],
    [0, "$0.0000"],
    [0.0013, "$0.0013"],
    [0.014, "$0.014"],
    [0.5, "$0.500"],
    [1.0, "$1.00"],
    [12.345, "$12.35"],
  ])("formatCost(%s) → %s", (input, expected) => {
    expect(formatCost(input as number | null | undefined)).toBe(expected);
  });
});
