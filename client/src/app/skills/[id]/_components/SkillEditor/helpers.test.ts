import { describe, it, expect } from "vitest";
import { rebaseDraft, type SkillDraft } from "./helpers";

const base: SkillDraft = { name: "n", description: "d", type: "rubric", body: "b", enabled: true };

describe("rebaseDraft", () => {
  it("takes the new saved value for fields the user hasn't edited", () => {
    expect(rebaseDraft(base, base, { ...base, enabled: false })).toEqual({ ...base, enabled: false });
  });
  it("keeps fields with unsaved edits", () => {
    const draft = { ...base, body: "my edit" };
    expect(rebaseDraft(draft, base, { ...base, body: "server", enabled: false })).toEqual({
      ...base,
      body: "my edit",
      enabled: false,
    });
  });
});
