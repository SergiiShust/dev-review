import type { Skill } from "@devdigest/shared";

/**
 * Pure ordering helpers for the agent's linked-skill list. Each returns the NEW
 * full ordered id list, which the tab POSTs as `skill_ids` (order = index).
 */

/** Link (append to the end) or unlink a skill. */
export function toggleSkill(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Swap a linked skill with its neighbour; a no-op at either end or for an unlinked id. */
export function moveSkill(ids: readonly string[], id: string, dir: "up" | "down"): string[] {
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const next = [...ids];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** A row in the tab: every workspace skill, linked ones first in link order. */
export interface SkillRowView {
  skill: Skill;
  linked: boolean;
  /** Position among linked skills (0-based); -1 when unlinked. */
  position: number;
}

/** Linked skills first (in link order), then the unlinked rest by name. Ids of deleted skills are dropped. */
export function buildRows(all: readonly Skill[], linkedIds: readonly string[]): SkillRowView[] {
  const byId = new Map(all.map((sk) => [sk.id, sk]));
  const linked = linkedIds
    .map((id) => byId.get(id))
    .filter((sk): sk is Skill => sk !== undefined)
    .map((skill, position) => ({ skill, linked: true, position }));
  const unlinked = all
    .filter((sk) => !linkedIds.includes(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => ({ skill, linked: false, position: -1 }));
  return [...linked, ...unlinked];
}
