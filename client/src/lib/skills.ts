/* skills.ts — skill type list, badge colors and search filter. Shared by the
   Skills Lab (/skills, /skills/[id]) and the Agent Editor's Skills tab. */
import type { Skill, SkillType } from "@devdigest/shared";

/**
 * Max skill body length — mirrors `SKILL_BODY_MAX_CHARS` in @devdigest/shared,
 * which the API enforces. Duplicated because the Next.js build can't import
 * runtime VALUES from @devdigest/shared (its barrel uses `.js` specifiers that
 * webpack doesn't resolve; type-only imports are erased and fine). skills.test.ts
 * pins the two values together.
 */
export const SKILL_BODY_MAX_CHARS = 20_000;

/** All skill types, in picker order. Mirrors the `SkillType` contract enum. */
export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Foreground/background CSS vars for a skill type's badge (matches the design: rubric blue, convention green, security red). */
export function skillTypeColors(type: SkillType): { color: string; bg: string } {
  switch (type) {
    case "rubric":
      return { color: "var(--accent-text)", bg: "var(--accent-bg)" };
    case "convention":
      return { color: "var(--ok)", bg: "var(--ok-bg)" };
    case "security":
      return { color: "var(--crit)", bg: "var(--crit-bg)" };
    default:
      return { color: "var(--text-secondary)", bg: "var(--bg-hover)" };
  }
}

/** Case-insensitive filter over a skill's name, description and type. */
export function filterSkills<T extends Pick<Skill, "name" | "description" | "type">>(
  skills: T[],
  search: string,
): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((sk) => `${sk.name} ${sk.description} ${sk.type}`.toLowerCase().includes(q));
}
