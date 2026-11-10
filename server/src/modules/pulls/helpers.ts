import type { PrMeta, PrDetail } from '@devdigest/shared';
import { deriveReviewStatus } from './status.js';
import type { PullRow, PrFileRow, PrCommitRow } from './repository.js';

/**
 * Pure PR-list/detail transforms (no DB / `this`, so they unit-test cleanly).
 * The service fetches rows via PullsRepository, runs these to assemble the
 * SCORE / FINDINGS / COST columns, and maps rows to the API DTOs.
 */

export interface SeverityBreakdown {
  CRITICAL: number;
  WARNING: number;
  SUGGESTION: number;
}

/**
 * From review rows (newest-first), pick:
 *  - the latest review per PR → the SCORE column;
 *  - the latest review per (PR, agent) → the FINDINGS column spans EVERY agent's
 *    latest run, not just whichever finished last.
 */
export function selectListReviews(
  rows: { prId: string; score: number | null; id: string; agentId: string | null }[],
): {
  scoreByPr: Map<string, number | null>;
  findingReviewIds: string[];
  reviewToPr: Map<string, string>;
} {
  const scoreByPr = new Map<string, number | null>();
  const seenAgentKey = new Set<string>(); // `${prId}::${agentId}`
  const findingReviewIds: string[] = []; // one review per agent per PR
  const reviewToPr = new Map<string, string>(); // reviewId → prId (attribution)
  for (const rv of rows) {
    // SCORE: first row seen per PR = latest review overall.
    if (!scoreByPr.has(rv.prId)) scoreByPr.set(rv.prId, rv.score);
    // FINDINGS: first row seen per (PR, agent) = that agent's latest run.
    const agentKey = `${rv.prId}::${rv.agentId ?? 'none'}`;
    if (!seenAgentKey.has(agentKey)) {
      seenAgentKey.add(agentKey);
      findingReviewIds.push(rv.id);
      reviewToPr.set(rv.id, rv.prId);
    }
  }
  return { scoreByPr, findingReviewIds, reviewToPr };
}

/** Per-severity finding counts per PR, summed across each agent's latest review. */
export function groupFindingsByPr(
  rows: { reviewId: string; severity: string }[],
  reviewToPr: Map<string, string>,
): Map<string, SeverityBreakdown> {
  const byPr = new Map<string, SeverityBreakdown>();
  for (const f of rows) {
    const prId = reviewToPr.get(f.reviewId);
    if (!prId) continue;
    let counts = byPr.get(prId);
    if (!counts) {
      counts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
      byPr.set(prId, counts);
    }
    if (f.severity === 'CRITICAL' || f.severity === 'WARNING' || f.severity === 'SUGGESTION') {
      counts[f.severity]++;
    }
  }
  return byPr;
}

/** Aggregate cost per PR: SUM of cost_usd across all completed runs. */
export function groupCostByPr(rows: { prId: string | null; costUsd: number | null }[]): Map<string, number> {
  const byPr = new Map<string, number>();
  for (const rr of rows) {
    if (rr.prId != null && rr.costUsd != null) {
      byPr.set(rr.prId, (byPr.get(rr.prId) ?? 0) + rr.costUsd);
    }
  }
  return byPr;
}

/** Map a persisted PR row + its rollups to the PrMeta list DTO. */
export function toPrMeta(
  r: PullRow,
  rollups: {
    score: number | null | undefined;
    cost: number | undefined;
    findings: SeverityBreakdown | undefined;
    now: number;
  },
): PrMeta {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    author: r.author,
    branch: r.branch,
    base: r.base,
    head_sha: r.headSha,
    additions: r.additions,
    deletions: r.deletions,
    files_count: r.filesCount,
    status: deriveReviewStatus({
      ghStatus: r.status,
      lastReviewedSha: r.lastReviewedSha,
      headSha: r.headSha,
      updatedAt: r.updatedAt,
      now: rollups.now,
    }),
    opened_at: r.openedAt?.toISOString() ?? null,
    updated_at: r.updatedAt?.toISOString() ?? null,
    score: rollups.score ?? null,
    cost_usd: rollups.cost ?? null,
    findings_counts: rollups.findings ?? null,
  };
}

/** Reconstruct the PrDetail DTO from persisted rows (offline / no-token path). */
export function toPrDetailOffline(pr: PullRow, files: PrFileRow[], commits: PrCommitRow[]): PrDetail {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    author: pr.author,
    branch: pr.branch,
    base: pr.base,
    head_sha: pr.headSha,
    additions: pr.additions,
    deletions: pr.deletions,
    files_count: pr.filesCount,
    status: pr.status as PrDetail['status'],
    opened_at: pr.openedAt?.toISOString() ?? null,
    updated_at: pr.updatedAt?.toISOString() ?? null,
    body: pr.body ?? null,
    files: files.map((f) => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ?? null,
    })),
    commits: commits.map((c) => ({
      sha: c.sha,
      message: c.message,
      author: c.author,
      committed_at: c.committedAt?.toISOString() ?? null,
    })),
  };
}
