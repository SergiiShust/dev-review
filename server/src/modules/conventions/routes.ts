import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ConventionStatus, SKILL_BODY_MAX_CHARS, SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { ConventionsService } from './service.js';

/**
 * Conventions module — extract house conventions from a repo, curate them,
 * merge the accepted ones into a skill.
 *   GET   /repos/:id/conventions              → latest scan + candidates
 *   POST  /repos/:id/conventions/extract      → run a scan (sync), returns the list
 *   PATCH /repos/:id/conventions              → bulk status {ids, status}
 *   GET   /repos/:id/conventions/skill-draft  → accepted candidates merged into a skill draft
 *   POST  /repos/:id/conventions/skill        → save the (edited) draft as a skill
 *   PATCH /conventions/:id                    → accept / reject / edit one candidate
 */

const PatchConventionBody = z.object({
  status: ConventionStatus.optional(),
  rule: z.string().trim().min(1).max(500).optional(),
  category: z.string().trim().min(1).max(40).optional(),
});

const BulkStatusBody = z.object({
  ids: z.array(z.string().uuid()).max(200),
  status: ConventionStatus,
});

const CreateSkillBody = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  type: SkillType.optional(),
  enabled: z.boolean().optional(),
  body: z.string().trim().min(1).max(SKILL_BODY_MAX_CHARS),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  // Paid LLM call — tighter limit, like the review trigger.
  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.extract(workspaceId, req.params.id, req.log);
    },
  );

  app.patch(
    '/repos/:id/conventions',
    { schema: { params: IdParams, body: BulkStatusBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.bulkUpdateStatus(workspaceId, req.params.id, req.body.ids, req.body.status);
    },
  );

  app.get('/repos/:id/conventions/skill-draft', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.skillDraft(workspaceId, req.params.id);
  });

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.createSkill(workspaceId, req.params.id, req.body);
      reply.status(201);
      return skill;
    },
  );

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: PatchConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.update(workspaceId, req.params.id, req.body);
    },
  );
}
