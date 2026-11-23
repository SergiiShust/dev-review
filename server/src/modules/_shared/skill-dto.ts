import type { Skill, SkillSource, SkillType } from '@devdigest/shared';
import type { SkillRow } from '../../db/rows.js';

/**
 * `skills` row → public `Skill` DTO. Lives in `_shared` because more than one
 * module returns skills (skills CRUD, conventions' "create skill"), and modules
 * don't import from each other's folders. `agentCount` is set by the list
 * endpoint only.
 */
export function toSkillDto(row: SkillRow, agentCount?: number): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    created_at: row.createdAt.toISOString(),
    ...(agentCount !== undefined ? { agent_count: agentCount } : {}),
  };
}
