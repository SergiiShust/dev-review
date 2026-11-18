import type { SkillVersion } from '@devdigest/shared';
import type { SkillVersionRow } from '../../db/rows.js';

/**
 * Pure helpers for the skills module — DB row → DTO mapping. No I/O.
 */

export { toSkillDto } from '../_shared/skill-dto.js';

/** Map a persisted `skill_versions` row to the public `SkillVersion` DTO. */
export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}
