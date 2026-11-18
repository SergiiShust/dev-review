import type {
  ConventionCandidate,
  ConventionSkillDraft,
  ConventionsList,
  ConventionStatus,
  RepoRef,
  Skill,
  SkillType,
  StructuredResult,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, ExternalServiceError, NotFoundError } from '../../platform/errors.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import {
  CONFIG_FILE_CANDIDATES,
  EXTRACTION_MAX_RETRIES,
  EXTRACTION_SCHEMA_NAME,
  EXTRACTION_TEMPERATURE,
  EXTRACTION_TIMEOUT_MS,
  MAX_CHARS_PER_FILE,
  MAX_LINES_PER_FILE,
  SAMPLE_SOURCE_FILES,
} from './constants.js';
import {
  buildSkillDraft,
  groundCandidate,
  renderPromptFile,
  ruleKey,
  safeRelativePath,
  sortCandidates,
  splitLines,
  toConventionDto,
  toCreatedSkillDto,
  toScanDto,
  type GroundedCandidate,
} from './helpers.js';
import { buildExtractionMessages, ExtractionResult } from './prompt.js';
import {
  ConventionsRepository,
  type ConventionPatch,
  type RepoRow,
} from './repository/conventions.repo.js';

/**
 * Conventions Extractor.
 *
 *   sample (code only) → cheap LLM (structured) → grounding gate (code) → persist
 *
 * 1. Sampling: root config files (eslint/tsconfig/prettier/…) + the top-ranked
 *    source files from repo-intel (`getConventionSamples`). No model involved.
 * 2. One structured call to the workspace's `conventions` feature model.
 * 3. Every candidate's evidence is re-checked against the real file: path in
 *    the sample, valid line range, snippet present at those lines. Candidates
 *    without proof are dropped; kept ones store the REAL file text.
 * 4. A scan replaces the repo's pending candidates; accepted/rejected decisions
 *    survive, and a re-detected rule that was already decided is skipped.
 *
 * Accepted candidates merge into ONE `convention` skill (source 'extracted').
 * Linking that skill to agents stays a separate, explicit step (agents module).
 */

export interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

export interface CreateConventionSkillInput {
  name: string;
  description?: string;
  type?: SkillType;
  enabled?: boolean;
  body: string;
}

interface SampledFile {
  path: string;
  content: string;
}

export class ConventionsService {
  private repo: ConventionsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  private async requireRepo(workspaceId: string, repoId: string): Promise<RepoRow> {
    const repo = await this.repo.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return repo;
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionsList> {
    await this.requireRepo(workspaceId, repoId);
    const [scan, rows] = await Promise.all([
      this.repo.latestScan(workspaceId, repoId),
      this.repo.list(workspaceId, repoId),
    ]);
    return {
      scan: scan ? toScanDto(scan) : null,
      candidates: sortCandidates(rows.map(toConventionDto)),
    };
  }

  async extract(workspaceId: string, repoId: string, log?: Logger): Promise<ConventionsList> {
    const repo = await this.requireRepo(workspaceId, repoId);
    if (!repo.clonePath) {
      throw new AppError('repo_not_cloned', 'Repo has no local clone yet — re-import it first.', 409);
    }
    const ref: RepoRef = { owner: repo.owner, name: repo.name };

    // 1. Sample — fully deterministic.
    const sourcePaths = await this.container.repoIntel.getConventionSamples(
      repoId,
      SAMPLE_SOURCE_FILES,
    );
    if (sourcePaths.length === 0) {
      throw new AppError(
        'repo_not_indexed',
        'Repo is not indexed yet — run indexing (repo-intel) before extracting conventions.',
        409,
      );
    }
    const files = await this.readSample(ref, [...CONFIG_FILE_CANDIDATES, ...sourcePaths]);
    if (files.length === 0) {
      throw new AppError('repo_not_indexed', 'No readable sample files in the clone.', 409);
    }

    // 2. Cheap structured LLM call.
    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'conventions');
    const llm = await this.container.llm(provider);
    const promptFiles = files.map((f) =>
      renderPromptFile(f.path, f.content, MAX_LINES_PER_FILE, MAX_CHARS_PER_FILE),
    );
    let res: StructuredResult<ExtractionResult>;
    try {
      res = await llm.completeStructured<ExtractionResult>({
        model,
        schema: ExtractionResult,
        schemaName: EXTRACTION_SCHEMA_NAME,
        messages: buildExtractionMessages(repo.fullName, promptFiles),
        temperature: EXTRACTION_TEMPERATURE,
        maxRetries: EXTRACTION_MAX_RETRIES,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      });
    } catch (err) {
      // Provider failures (quota, rate limit, timeout, bad output) are upstream
      // problems → 502 with the provider's message, not an opaque 500.
      log?.warn({ repoId, provider, model, err: (err as Error).message }, 'conventions: LLM call failed');
      throw new ExternalServiceError(`${provider}/${model}: ${(err as Error).message}`);
    }

    // 3. Grounding gate — only the VISIBLE (prompt) lines are citable.
    const citable = new Map(
      promptFiles.map((pf) => {
        const all = splitLines(files.find((f) => f.path === pf.path)!.content);
        const visible = pf.numbered === '' ? 0 : splitLines(pf.numbered).length;
        return [pf.path, all.slice(0, visible)] as const;
      }),
    );
    const decidedKeys = new Set(
      (await this.repo.listDecided(workspaceId, repoId)).map((r) => ruleKey(r.rule)),
    );
    const kept: GroundedCandidate[] = [];
    const seen = new Set<string>();
    let dropped = 0;
    let duplicates = 0;
    for (const c of res.data.candidates) {
      const g = groundCandidate(c, citable);
      if (!g.ok) {
        dropped++;
        log?.info({ repoId, rule: c.rule, reason: g.reason }, 'conventions: dropped ungrounded candidate');
        continue;
      }
      const key = ruleKey(g.value.rule);
      if (decidedKeys.has(key) || seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      kept.push(g.value);
    }

    // 4. Persist (scan row + replace pending) atomically.
    await this.repo.saveScan(
      workspaceId,
      repoId,
      {
        sampleCount: files.length,
        candidateCount: kept.length,
        droppedCount: dropped,
        model: res.model,
        costUsd: res.costUsd,
      },
      kept.map((k) => ({
        category: k.category,
        rule: k.rule,
        evidencePath: k.path,
        evidenceLineStart: k.lineStart,
        evidenceLineEnd: k.lineEnd,
        evidenceSnippet: k.snippet,
        confidence: k.confidence,
      })),
    );
    log?.info(
      {
        repoId,
        model: res.model,
        sampled: files.length,
        returned: res.data.candidates.length,
        dropped,
        duplicates,
        kept: kept.length,
        costUsd: res.costUsd,
      },
      'conventions: extraction complete',
    );
    return this.list(workspaceId, repoId);
  }

  /** Read sample files, skipping missing/empty/unsafe paths and duplicates. */
  private async readSample(ref: RepoRef, paths: readonly string[]): Promise<SampledFile[]> {
    const unique = [...new Set(paths.map(safeRelativePath).filter((p): p is string => !!p))];
    const read = await Promise.all(
      unique.map(async (path) => {
        try {
          const content = await this.container.git.readFile(ref, path);
          return content.trim() ? { path, content } : null;
        } catch {
          return null; // missing config file — expected
        }
      }),
    );
    return read.filter((f): f is SampledFile => f !== null);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionCandidate> {
    const row = await this.repo.update(workspaceId, id, patch);
    if (!row) throw new NotFoundError('Convention not found');
    return toConventionDto(row);
  }

  async bulkUpdateStatus(
    workspaceId: string,
    repoId: string,
    ids: string[],
    status: ConventionStatus,
  ): Promise<ConventionCandidate[]> {
    await this.requireRepo(workspaceId, repoId);
    const rows = await this.repo.bulkUpdateStatus(workspaceId, repoId, ids, status);
    return rows.map(toConventionDto);
  }

  private async accepted(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const rows = await this.repo.list(workspaceId, repoId, 'accepted');
    if (rows.length === 0) {
      throw new AppError('no_accepted_conventions', 'Accept at least one convention first.', 409);
    }
    return sortCandidates(rows.map(toConventionDto));
  }

  /** Merge accepted candidates into an editable skill draft (create-modal prefill). */
  async skillDraft(workspaceId: string, repoId: string): Promise<ConventionSkillDraft> {
    const repo = await this.requireRepo(workspaceId, repoId);
    return buildSkillDraft(repo.name, await this.accepted(workspaceId, repoId));
  }

  /**
   * Save the (user-edited) merged skill. `source='extracted'` and
   * `evidence_files` = distinct evidence paths of the accepted candidates.
   * Not linked to any agent — that is an explicit step in the agents module.
   */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateConventionSkillInput,
  ): Promise<Skill> {
    await this.requireRepo(workspaceId, repoId);
    const accepted = await this.accepted(workspaceId, repoId);
    const evidenceFiles = [...new Set(accepted.map((c) => c.evidence_path).filter(Boolean))];
    const row = await this.container.skillsRepo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type ?? 'convention',
      enabled: input.enabled ?? true,
      body: input.body,
      source: 'extracted',
      evidenceFiles,
    });
    return toCreatedSkillDto(row);
  }
}
