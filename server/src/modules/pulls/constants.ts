/**
 * F1 — pulls module literals.
 */

/**
 * Diff stats aren't on GitHub's PR-list payload, so freshly-imported PRs land
 * with zeroed size/diff. We backfill them once from the detail endpoint — but
 * each backfill is its own detail fetch, so cap how many we do per list request
 * (the periodic refetch chips away at any remainder).
 */
export const BACKFILL_LIMIT = 10;
