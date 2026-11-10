import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { SkillType } from '@devdigest/shared';
import type { SkillRow, SkillVersionRow } from '../../../db/rows.js';
import {
  DEFAULT_SKILL_BODY,
  DEFAULT_SKILL_DESCRIPTION,
  DEFAULT_SKILL_TYPE,
  INITIAL_SKILL_VERSION,
} from '../constants.js';

/**
 * Skills data-access. Owns `skills` and `skill_versions`. The `agent_skills`
 * link table is owned by the agents repository (agent side); here it is only
 * read, for the per-skill agent count. Workspace-scoped throughout.
 *
 * Versioning: only a BODY change bumps `skills.version` and snapshots the new
 * body into `skill_versions` — `skill_versions` stores nothing but the body, so
 * metadata edits (name/description/type/enabled) update in place.
 */

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/** A skill row plus how many agents link it. */
export interface SkillWithAgentCount {
  skill: SkillRow;
  agentCount: number;
}

export class SkillsRepository {
  constructor(private db: Db) {}

  /** All skills in the workspace (name ascending) with their linked-agent count. */
  async list(workspaceId: string): Promise<SkillWithAgentCount[]> {
    const rows = await this.db
      .select({ skill: t.skills, agentCount: count(t.agentSkills.agentId) })
      .from(t.skills)
      .leftJoin(t.agentSkills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.skills.workspaceId, workspaceId))
      .groupBy(t.skills.id)
      .orderBy(asc(t.skills.name));
    return rows.map((r) => ({ skill: r.skill, agentCount: r.agentCount }));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** True when EVERY id names a skill in this workspace (an empty list is trivially true). */
  async allInWorkspace(workspaceId: string, ids: string[]): Promise<boolean> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return true;
    const [row] = await this.db
      .select({ n: count() })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, unique)));
    return (row?.n ?? 0) === unique.length;
  }

  /** Delete a skill (scoped to workspace). Versions and agent links cascade. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  /** Insert a manual skill AND record its v1 body snapshot, atomically. */
  async insert(values: InsertSkill): Promise<SkillRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.skills)
        .values({
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description ?? DEFAULT_SKILL_DESCRIPTION,
          type: values.type ?? DEFAULT_SKILL_TYPE,
          source: 'manual',
          body: values.body ?? DEFAULT_SKILL_BODY,
          enabled: values.enabled ?? true,
          version: INITIAL_SKILL_VERSION,
        })
        .returning();
      await tx
        .insert(t.skillVersions)
        .values({ skillId: row!.id, version: INITIAL_SKILL_VERSION, body: row!.body })
        .onConflictDoNothing();
      return row!;
    });
  }

  /**
   * Update a skill. A changed body bumps the version (incremented in SQL, so two
   * concurrent saves can't both claim the same number) and snapshots the new body
   * in the same transaction.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkill,
  ): Promise<SkillRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(t.skills)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
      if (!existing) return undefined;

      const bodyChanged = patch.body !== undefined && patch.body !== existing.body;
      const changes = {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(bodyChanged ? { body: patch.body, version: sql`${t.skills.version} + 1` } : {}),
      };
      // Nothing to write (empty patch, or only an unchanged body) — Drizzle
      // rejects an empty SET, and there is nothing to version anyway.
      if (Object.keys(changes).length === 0) return existing;

      const [row] = await tx
        .update(t.skills)
        .set(changes)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .returning();

      if (bodyChanged && row) {
        await tx
          .insert(t.skillVersions)
          .values({ skillId: row.id, version: row.version, body: row.body })
          .onConflictDoNothing();
      }
      return row;
    });
  }

  // ---- skill_versions (immutable body snapshots) ---------------------------

  /** All body snapshots for a skill, newest version first. */
  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  /** A single body snapshot, or undefined if that version was never recorded. */
  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }
}
