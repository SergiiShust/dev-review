import { describe, it, expect } from 'vitest';
import { Skill, LinkedSkill } from '@devdigest/shared';
import { toSkillDto, toSkillVersionDto } from '../src/modules/skills/helpers.js';
import { toLinkedSkillDto } from '../src/modules/agents/helpers.js';
import type { SkillRow } from '../src/db/rows.js';

const row: SkillRow = {
  id: '11111111-1111-1111-1111-111111111111',
  workspaceId: '22222222-2222-2222-2222-222222222222',
  name: 'pr-quality-rubric',
  description: 'Rubric',
  type: 'rubric',
  source: 'manual',
  body: '# Rubric',
  enabled: true,
  version: 3,
  evidenceFiles: null,
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
};

describe('skills DTO mapping', () => {
  it('toSkillDto produces a contract-valid snake_case Skill', () => {
    const dto = toSkillDto(row);
    expect(Skill.parse(dto)).toEqual(dto);
    expect(dto).toMatchObject({ version: 3, evidence_files: null, created_at: '2026-05-30T00:00:00.000Z' });
    expect(dto).not.toHaveProperty('agent_count');
    expect(toSkillDto(row, 2).agent_count).toBe(2);
  });

  it('toSkillVersionDto maps a snapshot row', () => {
    expect(
      toSkillVersionDto({ skillId: row.id, version: 1, body: 'b', createdAt: row.createdAt }),
    ).toEqual({ skill_id: row.id, version: 1, body: 'b', created_at: '2026-05-30T00:00:00.000Z' });
  });

  it("agents' toLinkedSkillDto stays in sync with toSkillDto (+ order)", () => {
    const linked = toLinkedSkillDto({ skill: row, order: 4 });
    expect(LinkedSkill.parse(linked)).toEqual(linked);
    expect(linked).toEqual({ ...toSkillDto(row), order: 4 });
  });
});
