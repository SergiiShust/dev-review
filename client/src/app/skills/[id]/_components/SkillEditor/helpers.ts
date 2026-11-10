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

/**
 * Carry the draft over a server-side change to the saved skill (e.g. the enabled
 * toggle on the rail card, or a save that trimmed the name): fields the user
 * hasn't edited (draft === previous saved) take the new saved value; fields with
 * unsaved edits keep the user's value. Prevents a later Save from silently
 * reverting a change made elsewhere.
 */
export function rebaseDraft(draft: SkillDraft, prevSaved: SkillDraft, nextSaved: SkillDraft): SkillDraft {
  const out = { ...draft };
  for (const k of Object.keys(nextSaved) as (keyof SkillDraft)[]) {
    if (draft[k] === prevSaved[k]) (out as Record<keyof SkillDraft, unknown>)[k] = nextSaved[k];
  }
  return out;
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
