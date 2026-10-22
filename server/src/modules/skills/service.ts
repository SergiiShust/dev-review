import type { Container } from '../../platform/container.js';
import type { Skill, SkillType, SkillVersion } from '@devdigest/shared';
import type { SkillsRepository } from './repository/skills.repo.js';
import { toSkillDto, toSkillVersionDto } from './helpers.js';

/**
 * Skills service. Business logic for the Skills Lab: CRUD over reusable,
 * text-only prompt snippets that agents link (see agents module) and the review
 * run injects into the assembled prompt. Body edits are versioned via
 * `skill_versions` (repository); restore re-applies an old body as a NEW version.
 */

export interface CreateSkillInput {
  name: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(container: Container) {
    this.repo = container.skillsRepo;
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map((r) => toSkillDto(r.skill, r.agentCount));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row) : undefined;
  }

  /** Create a manual skill (source is always 'manual' — import flows are out of scope). */
  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({ workspaceId, ...input });
    return toSkillDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? toSkillDto(row) : undefined;
  }

  /** Delete a skill (its versions and agent links cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /**
   * Body history for a skill, newest first. Returns undefined when the skill
   * isn't in this workspace (route → 404), so snapshots can't be read across tenants.
   */
  async listVersions(workspaceId: string, skillId: string): Promise<SkillVersion[] | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const rows = await this.repo.listVersions(skillId);
    return rows.map(toSkillVersionDto);
  }

  /** One body snapshot; undefined when the skill isn't in this workspace or the version is unknown. */
  async getVersion(
    workspaceId: string,
    skillId: string,
    version: number,
  ): Promise<SkillVersion | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const row = await this.repo.getVersion(skillId, version);
    return row ? toSkillVersionDto(row) : undefined;
  }

  /**
   * Restore an old body. History is immutable: this writes a NEW head version
   * carrying that body. Restoring a body identical to the current one is a no-op
   * (no version churn from double-clicks). Undefined → route 404.
   */
  async restore(workspaceId: string, skillId: string, version: number): Promise<Skill | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const snapshot = await this.repo.getVersion(skillId, version);
    if (!snapshot) return undefined;
    if (snapshot.body === skill.body) return toSkillDto(skill);
    return this.update(workspaceId, skillId, { body: snapshot.body });
  }
}
