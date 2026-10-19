import type { FastifyBaseLogger } from 'fastify';
import type { GitHubClient, PrMeta, PrDetail, PrReviewComment, PrCommentInput } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { PullsRepository, type PullRow, type RepoRow } from './repository.js';
import { BACKFILL_LIMIT } from './constants.js';
import {
  selectListReviews,
  groupFindingsByPr,
  groupCostByPr,
  toPrMeta,
  toPrDetailOffline,
} from './helpers.js';

/**
 * F1 — pulls service. Business logic for the Pull Requests feature:
 *   - list / detail (local-first: sync from GitHub when a token is configured,
 *     never fail the read — persisted/seeded data stays viewable offline)
 *   - manual PR-list sync (the `poll` endpoint, delegated from the polling module)
 *   - inline review comments (proxied live to GitHub, no local mirror)
 *
 * No HTTP and no raw SQL live here — persistence goes through PullsRepository,
 * pure transforms through helpers.ts, literals through constants.ts. The
 * GitHub port is resolved through the container.
 */
export class PullsService {
  private pulls: PullsRepository;

  constructor(private container: Container) {
    this.pulls = new PullsRepository(container.db);
  }

  /**
   * GET /repos/:id/pulls — the Pull Requests list. Syncs from GitHub when a
   * token is configured, backfills missing diff stats, and decorates each PR
   * with its latest-review SCORE, per-severity FINDINGS, and aggregate COST.
   */
  async listForRepo(workspaceId: string, repoId: string, log: FastifyBaseLogger): Promise<PrMeta[]> {
    const repo = await this.pulls.getRepoInWorkspace(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    // Local-first: sync from GitHub when a token is configured, but never fail
    // the read — already-imported/seeded PRs stay viewable offline.
    const gh = await this.tryGithub(log, 'GitHub client unavailable (no token / offline); serving persisted PRs');
    if (gh) {
      try {
        const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
        for (const pr of pulls) await this.pulls.upsertFromGitHub(workspaceId, repo.id, pr);
      } catch (err) {
        log.warn({ err }, 'GitHub PR sync skipped (no token / offline); serving persisted PRs');
      }
    }

    const rows = await this.pulls.listByRepo(repo.id);
    if (gh) await this.backfillStats(gh, repo, rows, log);

    // Latest-review SCORE + per-severity FINDINGS + aggregate COST per PR, for
    // the list columns. Computed on read (no FK denorm); the list is small, so a
    // couple of IN-queries + JS grouping is cheap.
    const prIds = rows.map((r) => r.id);
    const { scoreByPr, findingReviewIds, reviewToPr } = selectListReviews(
      await this.pulls.reviewRowsForPulls(prIds),
    );
    const findingsByPr = groupFindingsByPr(await this.pulls.findingSeverities(findingReviewIds), reviewToPr);
    const costByPr = groupCostByPr(await this.pulls.doneRunCosts(prIds));

    const now = Date.now();
    return rows.map((r) =>
      toPrMeta(r, {
        score: scoreByPr.get(r.id),
        cost: costByPr.get(r.id),
        findings: findingsByPr.get(r.id),
        now,
      }),
    );
  }

  /**
   * Backfill diff stats for PRs that landed with zeroed size/diff (GitHub's
   * PR-list payload omits them). Capped per request (each backfill is a detail
   * fetch); the periodic refetch chips away at any remainder. Mutates `rows`
   * in place so the mapped DTO reflects the fresh stats.
   */
  private async backfillStats(
    gh: GitHubClient,
    repo: RepoRow,
    rows: PullRow[],
    log: FastifyBaseLogger,
  ): Promise<void> {
    const needStats = rows
      .filter((r) => r.additions === 0 && r.deletions === 0 && r.filesCount === 0)
      .slice(0, BACKFILL_LIMIT);
    for (const r of needStats) {
      try {
        const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, r.number);
        await this.pulls.updateStats(r.id, {
          additions: detail.additions,
          deletions: detail.deletions,
          filesCount: detail.files_count,
        });
        r.additions = detail.additions;
        r.deletions = detail.deletions;
        r.filesCount = detail.files_count;
      } catch (err) {
        log.warn({ err, number: r.number }, 'PR diff-stat backfill skipped');
      }
    }
  }

  /**
   * GET /pulls/:id — full PR detail. Refreshes files/commits/body from GitHub
   * when a token is configured; otherwise serves the persisted detail so the
   * page works offline.
   */
  async detail(workspaceId: string, prId: string, log: FastifyBaseLogger): Promise<PrDetail> {
    const pr = await this.pulls.getInWorkspace(workspaceId, prId);
    if (!pr) throw new NotFoundError('Pull request not found');
    const repo = await this.pulls.getRepoById(pr.repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    try {
      const gh = await this.container.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);
      await this.pulls.replaceFiles(pr.id, detail.files);
      await this.pulls.replaceCommits(pr.id, detail.commits);
      await this.pulls.updateDetail(pr.id, {
        body: detail.body ?? null,
        additions: detail.additions,
        deletions: detail.deletions,
        filesCount: detail.files_count,
      });
      return { ...detail, id: pr.id };
    } catch (err) {
      log.warn({ err }, 'GitHub PR detail refresh skipped (no token / offline); serving persisted detail');
      const files = await this.pulls.getFiles(pr.id);
      const commits = await this.pulls.getCommits(pr.id);
      return toPrDetailOffline(pr, files, commits);
    }
  }

  /**
   * POST /repos/:id/poll — manual PR-list sync (delegated from the polling
   * module). Requires a GitHub token (throws when missing). Never triggers a
   * review — review is a manual, separately-owned action.
   */
  async syncList(workspaceId: string, repoId: string): Promise<{ synced: number; reviewTriggered: false }> {
    const repo = await this.pulls.getRepoInWorkspace(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    const gh = await this.container.github();
    const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
    for (const pr of pulls) await this.pulls.upsertFromGitHub(workspaceId, repo.id, pr);
    await this.pulls.markPolled(repo.id);
    return { synced: pulls.length, reviewTriggered: false };
  }

  // ---- inline review comments (proxied live to GitHub, no local mirror) ----

  async listComments(workspaceId: string, prId: string, log: FastifyBaseLogger): Promise<PrReviewComment[]> {
    const { pr, repo } = await this.resolvePrAndRepo(workspaceId, prId);
    let gh: GitHubClient;
    try {
      gh = await this.container.github();
    } catch (err) {
      log.warn({ err }, 'GitHub client unavailable; serving no PR comments');
      return [];
    }
    try {
      return await gh.listReviewComments({ owner: repo.owner, name: repo.name }, pr.number);
    } catch (err) {
      log.warn({ err }, 'GitHub review-comments fetch skipped (offline / error)');
      return [];
    }
  }

  async createComment(workspaceId: string, prId: string, input: PrCommentInput): Promise<PrReviewComment> {
    const { pr, repo } = await this.resolvePrAndRepo(workspaceId, prId);
    let gh: GitHubClient;
    try {
      gh = await this.container.github();
    } catch {
      throw new AppError('github_unavailable', 'Connect a GitHub token to post comments.', 400);
    }
    try {
      return await gh.createReviewComment({ owner: repo.owner, name: repo.name }, pr.number, {
        commitId: pr.headSha,
        path: input.path,
        line: input.line,
        ...(input.side ? { side: input.side } : {}),
        body: input.body,
        ...(input.in_reply_to != null ? { inReplyTo: input.in_reply_to } : {}),
      });
    } catch (err) {
      // GitHub rejects comments on lines outside the diff / on closed PRs (422).
      const msg = err instanceof Error ? err.message : 'Failed to post the comment to GitHub.';
      throw new AppError('github_comment_failed', msg, 400, { cause: String(err) });
    }
  }

  private async resolvePrAndRepo(
    workspaceId: string,
    id: string,
  ): Promise<{ pr: PullRow; repo: RepoRow }> {
    const pr = await this.pulls.getInWorkspace(workspaceId, id);
    if (!pr) throw new NotFoundError('Pull request not found');
    const repo = await this.pulls.getRepoById(pr.repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return { pr, repo };
  }

  /** Resolve the GitHub client, logging + returning null when unavailable. */
  private async tryGithub(log: FastifyBaseLogger, warnMsg: string): Promise<GitHubClient | null> {
    try {
      return await this.container.github();
    } catch (err) {
      log.warn({ err }, warnMsg);
      return null;
    }
  }
}
