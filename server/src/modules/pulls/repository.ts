import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PrMeta, PrDetail } from '@devdigest/shared';

/**
 * F1 — pulls data-access layer. The ONLY place that touches the
 * `pull_requests`, `pr_files`, and `pr_commits` tables. Every PR lookup is
 * scoped by `workspaceId` (tenancy guard).
 *
 * Repo rows are read here (never written — RepoRepository owns those) to
 * resolve owner/name for the GitHub sync. The PR-list rollups at the bottom are
 * READ-ONLY projections over the review domain (reviews/findings/agent_runs,
 * which ReviewRepository owns for writes) — the Pull Requests list needs them
 * for its SCORE / FINDINGS / COST columns, kept here so the list is one call.
 */

export type PullRow = typeof t.pullRequests.$inferSelect;
export type RepoRow = typeof t.repos.$inferSelect;
export type PrFileRow = typeof t.prFiles.$inferSelect;
export type PrCommitRow = typeof t.prCommits.$inferSelect;

export class PullsRepository {
  constructor(private db: Db) {}

  // ---- repo lookups (read-only; RepoRepository owns writes) ---------------

  async getRepoInWorkspace(workspaceId: string, id: string): Promise<RepoRow | undefined> {
    const [repo] = await this.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, id)));
    return repo;
  }

  async getRepoById(repoId: string): Promise<RepoRow | undefined> {
    const [repo] = await this.db.select().from(t.repos).where(eq(t.repos.id, repoId));
    return repo;
  }

  /** Bump `last_polled_at` after a manual PR-list sync. */
  async markPolled(repoId: string): Promise<void> {
    await this.db.update(t.repos).set({ lastPolledAt: new Date() }).where(eq(t.repos.id, repoId));
  }

  // ---- pull_requests aggregate --------------------------------------------

  async getInWorkspace(workspaceId: string, id: string): Promise<PullRow | undefined> {
    const [pr] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, id)));
    return pr;
  }

  async listByRepo(repoId: string): Promise<PullRow[]> {
    return this.db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repoId));
  }

  /** Idempotent upsert of a PR from a GitHub list payload (unique repo_id+number). */
  async upsertFromGitHub(workspaceId: string, repoId: string, pr: PrMeta): Promise<void> {
    await this.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        branch: pr.branch,
        base: pr.base,
        headSha: pr.head_sha,
        additions: pr.additions,
        deletions: pr.deletions,
        filesCount: pr.files_count,
        status: pr.status,
        openedAt: pr.opened_at ? new Date(pr.opened_at) : null,
        updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
      })
      .onConflictDoUpdate({
        target: [t.pullRequests.repoId, t.pullRequests.number],
        set: {
          title: pr.title,
          headSha: pr.head_sha,
          status: pr.status,
          updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
        },
      });
  }

  /** Backfill diff stats (absent from GitHub's PR-list payload). */
  async updateStats(
    prId: string,
    stats: { additions: number; deletions: number; filesCount: number },
  ): Promise<void> {
    await this.db.update(t.pullRequests).set(stats).where(eq(t.pullRequests.id, prId));
  }

  /** Persist the body + diff stats fetched from a PR detail refresh. */
  async updateDetail(
    prId: string,
    detail: { body: string | null; additions: number; deletions: number; filesCount: number },
  ): Promise<void> {
    await this.db.update(t.pullRequests).set(detail).where(eq(t.pullRequests.id, prId));
  }

  // ---- pr_files / pr_commits (replace-all mirror of a GitHub detail) -------

  async replaceFiles(prId: string, files: PrDetail['files']): Promise<void> {
    await this.db.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
    if (files.length > 0) {
      await this.db.insert(t.prFiles).values(
        files.map((f) => ({
          prId,
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
        })),
      );
    }
  }

  async replaceCommits(prId: string, commits: PrDetail['commits']): Promise<void> {
    await this.db.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
    if (commits.length > 0) {
      await this.db.insert(t.prCommits).values(
        commits.map((c) => ({
          prId,
          sha: c.sha,
          message: c.message,
          author: c.author,
          committedAt: c.committed_at ? new Date(c.committed_at) : null,
        })),
      );
    }
  }

  async getFiles(prId: string): Promise<PrFileRow[]> {
    return this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
  }

  async getCommits(prId: string): Promise<PrCommitRow[]> {
    return this.db.select().from(t.prCommits).where(eq(t.prCommits.prId, prId));
  }

  // ---- PR-list review rollups (read-only projection over the review domain) -

  /** Review rows for the listed PRs (newest-first) — SCORE + FINDINGS source. */
  async reviewRowsForPulls(
    prIds: string[],
  ): Promise<{ prId: string; score: number | null; id: string; agentId: string | null }[]> {
    if (prIds.length === 0) return [];
    return this.db
      .select({
        prId: t.reviews.prId,
        score: t.reviews.score,
        id: t.reviews.id,
        agentId: t.reviews.agentId,
      })
      .from(t.reviews)
      .where(and(inArray(t.reviews.prId, prIds), eq(t.reviews.kind, 'review')))
      .orderBy(desc(t.reviews.createdAt));
  }

  /** Finding severities for the given review ids (FINDINGS column tally). */
  async findingSeverities(reviewIds: string[]): Promise<{ reviewId: string; severity: string }[]> {
    if (reviewIds.length === 0) return [];
    return this.db
      .select({ reviewId: t.findings.reviewId, severity: t.findings.severity })
      .from(t.findings)
      .where(inArray(t.findings.reviewId, reviewIds));
  }

  /** Completed-run costs for the listed PRs (COST column is their sum). */
  async doneRunCosts(prIds: string[]): Promise<{ prId: string | null; costUsd: number | null }[]> {
    if (prIds.length === 0) return [];
    return this.db
      .select({ prId: t.agentRuns.prId, costUsd: t.agentRuns.costUsd })
      .from(t.agentRuns)
      .where(and(inArray(t.agentRuns.prId, prIds), eq(t.agentRuns.status, 'done')));
  }
}
