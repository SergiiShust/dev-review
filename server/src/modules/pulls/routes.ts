import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { PrMeta, PrDetail, PrReviewComment } from '@devdigest/shared';
import { PrCommentInput } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { PullsService } from './service.js';

/**
 * F1 — pulls module. Transport layer only: parses requests and delegates all
 * business logic to PullsService.
 *   GET  /repos/:id/pulls      → list PRs for a repo (synced from GitHub, persisted)
 *   GET  /pulls/:id            → full PR detail (diff/files, commits, body)
 *   GET  /pulls/:id/comments   → inline review comments (proxied live to GitHub)
 *   POST /pulls/:id/comments   → create one inline review comment / reply
 *   POST /repos/:id/poll       → MANUAL refresh: sync the PR list from GitHub and
 *                                bump last_polled_at. Never triggers a review.
 *
 * Import is idempotent (unique repo_id+number). Review trigger is MANUAL and
 * owned by A2 — this module only imports/reads.
 */
export default async function pullsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new PullsService(app.container);

  app.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req): Promise<PrMeta[]> => {
    const { workspaceId } = await getContext(app.container, req);
    return service.listForRepo(workspaceId, req.params.id, req.log);
  });

  app.get('/pulls/:id', { schema: { params: IdParams } }, async (req): Promise<PrDetail> => {
    const { workspaceId } = await getContext(app.container, req);
    return service.detail(workspaceId, req.params.id, req.log);
  });

  app.get(
    '/pulls/:id/comments',
    { schema: { params: IdParams } },
    async (req): Promise<PrReviewComment[]> => {
      const { workspaceId } = await getContext(app.container, req);
      return service.listComments(workspaceId, req.params.id, req.log);
    },
  );

  app.post(
    '/pulls/:id/comments',
    { schema: { params: IdParams, body: PrCommentInput } },
    async (req): Promise<PrReviewComment> => {
      const { workspaceId } = await getContext(app.container, req);
      return service.createComment(workspaceId, req.params.id, req.body);
    },
  );

  // Lived in a separate `polling` module that imported PullsService across
  // module folders; PR-list sync is pulls' own feature, so the route lives here.
  app.post('/repos/:id/poll', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.syncList(workspaceId, req.params.id);
  });
}
