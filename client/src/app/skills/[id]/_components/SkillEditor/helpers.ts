import type { Skill, SkillType } from "@devdigest/shared";
import { CHARS_PER_TOKEN } from "./constants";

/** The editable fields of a skill — held as one draft so every tab sees unsaved edits. */
export interface SkillDraft {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
}

export function draftFromSkill(skill: Skill): SkillDraft {
  return {
    name: skill.name,
    description: skill.description,
    type: skill.type,
    body: skill.body,
    enabled: skill.enabled,
  };
}

/** True when the draft differs from the saved skill in any editable field. */
export function isDraftDirty(draft: SkillDraft, skill: Skill): boolean {
  const saved = draftFromSkill(skill);
  return (Object.keys(saved) as (keyof SkillDraft)[]).some((k) => draft[k] !== saved[k]);
}

/** Rough token estimate for a body (display only — the server never relies on it). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
