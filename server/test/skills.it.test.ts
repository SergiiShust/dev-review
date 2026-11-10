import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import { SkillsRepository } from '../src/modules/skills/repository/skills.repo.js';
import { SKILL_BODY_MAX_CHARS } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

/**
 * Skills — CRUD, body versioning (`skill_versions`), restore, workspace
 * isolation, agent linking, and injection of linked skill bodies into the
 * review prompt.
 */
d('skills (Testcontainers pg)', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp(llm?: MockLLMProvider) {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({ diff: DIFF }),
        github: new MockGitHubClient(),
        ...(llm ? { llm: { openai: llm } } : {}),
      },
    });
  }

  type App = Awaited<ReturnType<typeof makeApp>>;

  async function createSkill(app: App, payload: Record<string, unknown>) {
    const res = await app.inject({ method: 'POST', url: '/skills', payload });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number; body: string };
  }

  it('create → manual source, v1, and a v1 body snapshot', async () => {
    const app = await makeApp();
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name: 'pr-quality-rubric', type: 'rubric', body: '# Rubric v1' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      name: 'pr-quality-rubric',
      type: 'rubric',
      source: 'manual',
      enabled: true,
      version: 1,
      body: '# Rubric v1',
      description: '',
    });
    expect(typeof created.json().created_at).toBe('string');

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${created.json().id}/versions` })
    ).json();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, body: '# Rubric v1' });
    await app.close();
  });

  it('seed creates demo skills with history + links, and re-seeding is a no-op', async () => {
    const { db } = pg.handle;
    const [ws] = await db.select().from(t.workspaces).where(eq(t.workspaces.name, 'default'));
    const seeded = await db.select().from(t.skills).where(eq(t.skills.workspaceId, ws!.id));
    // Earlier tests may create same-named skills; the seeded row is the oldest.
    const rubric = seeded
      .filter((s) => s.name === 'pr-quality-rubric')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]!;
    expect(rubric).toMatchObject({ version: 2, type: 'rubric', source: 'manual' });
    const versions = await db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, rubric.id));
    expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);
    expect(versions.find((v) => v.version === 2)!.body).toBe(rubric.body);

    const [security] = await db
      .select()
      .from(t.agents)
      .where(eq(t.agents.name, 'Security Reviewer'));
    const app = await makeApp();
    const links = (await app.inject({ method: 'GET', url: `/agents/${security!.id}/skills` })).json();
    expect(links.map((l: { name: string }) => l.name)).toEqual(['pr-quality-rubric', 'secret-leakage-gate']);

    // A user edit survives a re-seed, a deleted demo skill is NOT resurrected
    // (or re-linked), and nothing is duplicated.
    await app.inject({ method: 'PUT', url: `/skills/${rubric.id}`, payload: { body: 'edited by user' } });
    const gate = seeded.find((s) => s.name === 'secret-leakage-gate')!;
    await app.inject({ method: 'DELETE', url: `/skills/${gate.id}` });
    const countBefore = (await db.select().from(t.skills).where(eq(t.skills.workspaceId, ws!.id))).length;
    await seed(db);
    const countAfter = (await db.select().from(t.skills).where(eq(t.skills.workspaceId, ws!.id))).length;
    expect(countAfter).toBe(countBefore);
    const [after] = await db.select().from(t.skills).where(eq(t.skills.id, rubric.id));
    expect(after).toMatchObject({ body: 'edited by user', version: 3 });
    const relinked = (await app.inject({ method: 'GET', url: `/agents/${security!.id}/skills` })).json();
    expect(relinked.map((l: { name: string }) => l.name)).toEqual(['pr-quality-rubric']);
    await app.close();
  });

  it('defaults type to custom and body to empty for a stub', async () => {
    const app = await makeApp();
    const skill = await createSkill(app, { name: 'stub' });
    expect(skill).toMatchObject({ type: 'custom', body: '', version: 1 });
    await app.close();
  });

  it('rejects a body over SKILL_BODY_MAX_CHARS on create and update (422)', async () => {
    const app = await makeApp();
    const tooLong = 'x'.repeat(SKILL_BODY_MAX_CHARS + 1);
    expect(
      (await app.inject({ method: 'POST', url: '/skills', payload: { name: 'big', body: tooLong } }))
        .statusCode,
    ).toBe(422);
    const { id } = await createSkill(app, { name: 'at-limit', body: 'x'.repeat(SKILL_BODY_MAX_CHARS) });
    expect(
      (await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: tooLong } })).statusCode,
    ).toBe(422);
    await app.close();
  });

  it('changing an agent\'s linked skills bumps + snapshots its version; a no-op re-post does not', async () => {
    const app = await makeApp();
    const a = await createSkill(app, { name: 'ver-a' });
    const b = await createSkill(app, { name: 'ver-b' });
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Versioned Linker', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'x' },
      })
    ).json().id as string;
    const version = async () =>
      (await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json().version as number;
    const post = (payload: object) =>
      app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload });

    expect(await version()).toBe(1);
    await post({ skill_ids: [a.id, b.id] });
    expect(await version()).toBe(2);
    await post({ skill_ids: [a.id, b.id] }); // identical → no bump
    expect(await version()).toBe(2);
    await post({ skill_ids: [b.id, a.id] }); // reorder → bump
    expect(await version()).toBe(3);
    await post({ skill_id: a.id }); // already linked at its order → no bump
    expect(await version()).toBe(3);

    const v3 = (await app.inject({ method: 'GET', url: `/agents/${agentId}/versions/3` })).json();
    expect(v3.config.skills).toEqual([b.id, a.id]);
    await app.close();
  });

  it('rejects a blank name and an unknown type at the edge', async () => {
    const app = await makeApp();
    expect(
      (await app.inject({ method: 'POST', url: '/skills', payload: { name: '   ' } })).statusCode,
    ).toBe(422);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/skills',
          payload: { name: 'x', type: 'nonsense' },
        })
      ).statusCode,
    ).toBe(422);
    await app.close();
  });

  it('a body change bumps the version; metadata/enabled edits do not', async () => {
    const app = await makeApp();
    const { id } = await createSkill(app, { name: 'versioned', body: 'one' });

    const meta = await app.inject({
      method: 'PUT',
      url: `/skills/${id}`,
      payload: { name: 'renamed', description: 'd', type: 'security', enabled: false },
    });
    expect(meta.statusCode).toBe(200);
    expect(meta.json()).toMatchObject({ name: 'renamed', type: 'security', enabled: false, version: 1 });

    // Saving the SAME body (or an empty patch) is not a change — and must not 500.
    const same = await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: 'one' } });
    expect(same.statusCode).toBe(200);
    expect(same.json().version).toBe(1);
    const empty = await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: {} });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().name).toBe('renamed');

    const bumped = await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: 'two' } });
    expect(bumped.json()).toMatchObject({ version: 2, body: 'two' });

    const versions = (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);

    const v1 = await app.inject({ method: 'GET', url: `/skills/${id}/versions/1` });
    expect(v1.statusCode).toBe(200);
    expect(v1.json()).toMatchObject({ version: 1, body: 'one' });
    await app.close();
  });

  it('restore writes a NEW version with the old body; restoring the current body is a no-op', async () => {
    const app = await makeApp();
    const { id } = await createSkill(app, { name: 'restorable', body: 'original' });
    await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: 'edited' } });

    const restored = await app.inject({ method: 'POST', url: `/skills/${id}/versions/1/restore` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ version: 3, body: 'original' });

    // v3 already carries v1's body → restoring v1 again changes nothing.
    const again = await app.inject({ method: 'POST', url: `/skills/${id}/versions/1/restore` });
    expect(again.json().version).toBe(3);

    const versions = (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json();
    expect(versions.map((v: { version: number; body: string }) => [v.version, v.body])).toEqual([
      [3, 'original'],
      [2, 'edited'],
      [1, 'original'],
    ]);
    await app.close();
  });

  it('404s for unknown skills/versions; 422 for a non-numeric version', async () => {
    const app = await makeApp();
    const { id } = await createSkill(app, { name: 'probe' });
    const ghost = '00000000-0000-0000-0000-000000000000';

    for (const [method, url] of [
      ['GET', `/skills/${ghost}`],
      ['PUT', `/skills/${ghost}`],
      ['DELETE', `/skills/${ghost}`],
      ['GET', `/skills/${ghost}/versions`],
      ['GET', `/skills/${id}/versions/99`],
      ['POST', `/skills/${id}/versions/99/restore`],
    ] as const) {
      const res = await app.inject({ method, url, ...(method === 'PUT' ? { payload: {} } : {}) });
      expect(res.statusCode, `${method} ${url}`).toBe(404);
    }
    expect((await app.inject({ method: 'GET', url: `/skills/${id}/versions/abc` })).statusCode).toBe(422);
    await app.close();
  });

  it('skills are workspace-scoped: another tenant cannot read, edit or link them', async () => {
    const { db } = pg.handle;
    const [otherWs] = await db.insert(t.workspaces).values({ name: 'other-skills' }).returning();
    const foreign = await new SkillsRepository(db).insert({
      workspaceId: otherWs!.id,
      name: 'foreign',
      body: 'secret rules',
    });

    const app = await makeApp();
    expect((await app.inject({ method: 'GET', url: `/skills/${foreign.id}` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: `/skills/${foreign.id}/versions` })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'PUT', url: `/skills/${foreign.id}`, payload: { body: 'x' } }))
        .statusCode,
    ).toBe(404);
    const listed = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(listed.some((s: { id: string }) => s.id === foreign.id)).toBe(false);

    // Linking another tenant's skill to a local agent is refused.
    const [agent] = await db.select().from(t.agents).limit(1);
    for (const payload of [{ skill_ids: [foreign.id] }, { skill_id: foreign.id }]) {
      const res = await app.inject({ method: 'POST', url: `/agents/${agent!.id}/skills`, payload });
      expect(res.statusCode).toBe(404);
    }
    await app.close();
  });

  it('agent links return full skills in order; list reports agent_count; delete cascades', async () => {
    const app = await makeApp();
    const a = await createSkill(app, { name: 'link-a', body: 'A' });
    const b = await createSkill(app, { name: 'link-b', body: 'B' });
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Linker', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'x' },
      })
    ).json().id as string;

    const set = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [b.id, a.id] },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().map((s: { name: string; order: number }) => [s.name, s.order])).toEqual([
      ['link-b', 0],
      ['link-a', 1],
    ]);

    const got = (await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json();
    expect(got[0]).toMatchObject({ id: b.id, name: 'link-b', body: 'B', type: 'custom', order: 0 });

    const listed = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(listed.find((s: { id: string }) => s.id === a.id).agent_count).toBe(1);

    expect((await app.inject({ method: 'DELETE', url: `/skills/${b.id}` })).statusCode).toBe(200);
    const after = (await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json();
    expect(after.map((s: { id: string }) => s.id)).toEqual([a.id]);
    const orphanVersions = await pg.handle.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, b.id));
    expect(orphanVersions).toHaveLength(0);
    await app.close();
  });

  it('a review injects linked, enabled skill bodies into the prompt in link order', async () => {
    const { db } = pg.handle;
    const llm = new MockLLMProvider('openai', {
      structured: { verdict: 'approve', summary: 'ok', score: 90, findings: [] },
    });
    const app = await makeApp(llm);
    const [ws] = await db.select().from(t.workspaces).where(eq(t.workspaces.name, 'default'));

    const first = await createSkill(app, { name: 'inject-first', body: 'SKILL-BODY-FIRST' });
    const second = await createSkill(app, { name: 'inject-second', body: 'SKILL-BODY-SECOND' });
    const off = await createSkill(app, { name: 'inject-off', body: 'SKILL-BODY-DISABLED' });
    await app.inject({ method: 'PUT', url: `/skills/${off.id}`, payload: { enabled: false } });

    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Skilled', provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review.' },
      })
    ).json().id as string;
    await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [second.id, off.id, first.id] },
    });

    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId: ws!.id, owner: 'acme', name: 'skills-api', fullName: 'acme/skills-api' })
      .returning();
    const [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId: ws!.id,
        repoId: repo!.id,
        number: 7,
        title: 'Add key',
        author: 'dev',
        branch: 'feat/key',
        base: 'main',
        headSha: 'abc123',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();

    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${pr!.id}/review`,
      payload: { agentId },
    });
    expect(res.statusCode).toBeLessThan(300);
    const runs = await waitForPrRuns(db, pr!.id, { expected: 1 });
    expect(runs[0]!.status).toBe('done');

    const prompt = JSON.stringify(
      llm.calls.filter((c) => c.method === 'completeStructured').map((c) => c.req),
    );
    expect(prompt).toContain('SKILL-BODY-SECOND');
    expect(prompt).toContain('SKILL-BODY-FIRST');
    expect(prompt.indexOf('SKILL-BODY-SECOND')).toBeLessThan(prompt.indexOf('SKILL-BODY-FIRST'));
    expect(prompt).not.toContain('SKILL-BODY-DISABLED');
    await app.close();
  });
});
