import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';
import { ConventionCandidate, ConventionsList } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

const USERS_TS = [
  "import { db } from '../db';",
  '',
  'export async function getUser(id: string) {',
  '  const user = await db.users.find(id);',
  '  const posts = await db.posts.findMany({ userId: id });',
  '  return { user, posts };',
  '}',
].join('\n');
const REDIS_TS = "import Redis from 'ioredis';\nexport const redis = new Redis(config.redisUrl);\n";

const FILES = {
  'src/api/users.ts': USERS_TS,
  'src/lib/redis.ts': REDIS_TS,
  'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
};

const EXTRACTION = {
  candidates: [
    {
      category: 'async',
      rule: 'Always use async/await instead of .then() chains',
      evidence: { path: 'src/api/users.ts', line_start: 4, line_end: 5, snippet: 'const user = await db.users.find(id);' },
      confidence: 0.91,
    },
    {
      category: 'structure',
      rule: 'Redis access goes through the src/lib/redis.ts singleton',
      evidence: { path: 'src/lib/redis.ts', line_start: 2, line_end: 2, snippet: 'export const redis = new Redis(config.redisUrl);' },
      confidence: 0.85,
    },
    {
      category: 'typing',
      rule: 'TypeScript strict mode is on',
      evidence: { path: 'tsconfig.json', line_start: 1, line_end: 1, snippet: '"strict": true' },
      confidence: 0.7,
    },
    // Hallucinated file → dropped.
    {
      category: 'errors',
      rule: 'Route handlers return Result<T, ApiError>',
      evidence: { path: 'src/api/public/index.ts', line_start: 14, line_end: 20, snippet: 'return ok(items);' },
      confidence: 0.78,
    },
    // Real file, fabricated code → dropped.
    {
      category: 'async',
      rule: 'Promises are chained with .then()',
      evidence: { path: 'src/api/users.ts', line_start: 4, line_end: 4, snippet: 'db.users.find(id).then(u => u)' },
      confidence: 0.4,
    },
  ],
};

function stubRepoIntel(samples: string[]): RepoIntel {
  return { getConventionSamples: async () => samples } as unknown as RepoIntel;
}

d('conventions (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces).where(eq(t.workspaces.name, 'default'));
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function makeRepo(clonePath: string | null = '/clones/acme/payments-api') {
    const name = `payments-api-${seq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}`, clonePath })
      .returning();
    return repo!;
  }

  function makeApp(opts: { llm?: MockLLMProvider; samples?: string[] } = {}) {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({ files: FILES }),
        github: new MockGitHubClient(),
        repoIntel: stubRepoIntel(opts.samples ?? ['src/api/users.ts', 'src/lib/redis.ts']),
        llm: { openai: opts.llm ?? new MockLLMProvider('openai', { structuredBySchema: { ConventionExtraction: EXTRACTION } }) },
      },
    });
  }

  it('extract → grounded candidates only; list returns scan meta', async () => {
    const repo = await makeRepo();
    const llm = new MockLLMProvider('openai', { structuredBySchema: { ConventionExtraction: EXTRACTION } });
    const app = await makeApp({ llm });

    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    const body = ConventionsList.parse(res.json());
    expect(body.candidates.map((c) => c.rule)).toEqual([
      'Always use async/await instead of .then() chains',
      'Redis access goes through the src/lib/redis.ts singleton',
      'TypeScript strict mode is on',
    ]);
    expect(body.candidates.every((c) => c.status === 'pending')).toBe(true);
    // Snippet is the real file text at the cited lines.
    expect(body.candidates[0]).toMatchObject({
      evidence_path: 'src/api/users.ts',
      evidence_line_start: 4,
      evidence_line_end: 5,
      evidence_snippet: '  const user = await db.users.find(id);\n  const posts = await db.posts.findMany({ userId: id });',
    });
    expect(body.scan).toMatchObject({ sample_count: 3, candidate_count: 3, dropped_count: 2 });

    // Uses the conventions feature model (cheap default) and numbered sample files.
    const call = llm.calls.find((c) => c.method === 'completeStructured')!.req as {
      model: string;
      schemaName: string;
      messages: { content: string }[];
    };
    expect(call.model).toBe('gpt-4.1-mini');
    expect(call.schemaName).toBe('ConventionExtraction');
    expect(call.messages[1]!.content).toContain('=== FILE: src/api/users.ts ===');
    expect(call.messages[1]!.content).toContain('4|   const user = await db.users.find(id);');

    const list = await app.inject({ method: 'GET', url: `/repos/${repo.id}/conventions` });
    expect(ConventionsList.parse(list.json()).candidates).toHaveLength(3);
    await app.close();
  });

  it('accept / reject / edit / bulk; re-scan keeps decisions and replaces pending', async () => {
    const repo = await makeRepo();
    const app = await makeApp();
    const { candidates } = (
      await app.inject({ method: 'POST', url: `/repos/${repo.id}/conventions/extract` })
    ).json() as ConventionsList;
    const [a, b, c] = candidates;

    const acc = await app.inject({ method: 'PATCH', url: `/conventions/${a!.id}`, payload: { status: 'accepted' } });
    expect(ConventionCandidate.parse(acc.json()).status).toBe('accepted');
    await app.inject({ method: 'PATCH', url: `/conventions/${b!.id}`, payload: { status: 'rejected' } });
    const edit = await app.inject({
      method: 'PATCH',
      url: `/conventions/${a!.id}`,
      payload: { rule: 'Use async/await, never .then()', category: 'async-style' },
    });
    expect(edit.json()).toMatchObject({ rule: 'Use async/await, never .then()', category: 'async-style', status: 'accepted' });

    // Empty patch is a no-op read, not a 500.
    expect((await app.inject({ method: 'PATCH', url: `/conventions/${c!.id}`, payload: {} })).statusCode).toBe(200);
    // Unknown id → 404.
    expect(
      (await app.inject({ method: 'PATCH', url: '/conventions/00000000-0000-0000-0000-000000000000', payload: { status: 'accepted' } })).statusCode,
    ).toBe(404);

    const bulk = await app.inject({
      method: 'PATCH',
      url: `/repos/${repo.id}/conventions`,
      payload: { ids: [c!.id], status: 'accepted' },
    });
    expect(bulk.json()).toHaveLength(1);

    // Re-scan: a & c accepted, b rejected. The model re-detects all three
    // (by rule text), so nothing new becomes pending and decisions survive.
    const again = (
      await app.inject({ method: 'POST', url: `/repos/${repo.id}/conventions/extract` })
    ).json() as ConventionsList;
    const byId = new Map(again.candidates.map((x) => [x.id, x]));
    expect(byId.get(a!.id)?.status).toBe('accepted');
    expect(byId.get(b!.id)?.status).toBe('rejected');
    expect(byId.get(c!.id)?.status).toBe('accepted');
    // a's rule was edited, so the original text comes back once as pending.
    const pending = again.candidates.filter((x) => x.status === 'pending');
    expect(pending.map((x) => x.rule)).toEqual(['Always use async/await instead of .then() chains']);
    await app.close();
  });

  it('skill-draft merges accepted; POST skill creates an extracted, unlinked skill', async () => {
    const repo = await makeRepo();
    const app = await makeApp();

    // Nothing accepted yet → 409.
    expect((await app.inject({ method: 'GET', url: `/repos/${repo.id}/conventions/skill-draft` })).statusCode).toBe(409);

    const { candidates } = (
      await app.inject({ method: 'POST', url: `/repos/${repo.id}/conventions/extract` })
    ).json() as ConventionsList;
    await app.inject({
      method: 'PATCH',
      url: `/repos/${repo.id}/conventions`,
      payload: { ids: candidates.slice(0, 2).map((x) => x.id), status: 'accepted' },
    });

    const draft = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/conventions/skill-draft` })).json();
    expect(draft).toMatchObject({
      name: `${repo.name}-conventions`,
      type: 'convention',
      enabled: true,
      accepted_count: 2,
    });
    expect(draft.body).toContain('Detected in `src/api/users.ts:4-5`:');

    const created = await app.inject({
      method: 'POST',
      url: `/repos/${repo.id}/conventions/skill`,
      payload: { ...draft, body: `${draft.body}\n<!-- edited -->` },
    });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(skill).toMatchObject({
      name: `${repo.name}-conventions`,
      type: 'convention',
      source: 'extracted',
      version: 1,
      enabled: true,
    });
    expect(skill.body).toContain('<!-- edited -->');
    expect([...skill.evidence_files].sort()).toEqual(['src/api/users.ts', 'src/lib/redis.ts']);

    const links = await pg.handle.db.select().from(t.agentSkills).where(eq(t.agentSkills.skillId, skill.id));
    expect(links).toHaveLength(0);
    await app.close();
  });

  it('409 when the repo is not indexed or not cloned; 404 for an unknown repo', async () => {
    const notIndexed = await makeRepo();
    const app = await makeApp({ samples: [] });
    const r1 = await app.inject({ method: 'POST', url: `/repos/${notIndexed.id}/conventions/extract` });
    expect(r1.statusCode).toBe(409);
    expect(r1.json().error.code).toBe('repo_not_indexed');

    const notCloned = await makeRepo(null);
    const r2 = await app.inject({ method: 'POST', url: `/repos/${notCloned.id}/conventions/extract` });
    expect(r2.json().error.code).toBe('repo_not_cloned');

    const r3 = await app.inject({ method: 'GET', url: '/repos/00000000-0000-0000-0000-000000000000/conventions' });
    expect(r3.statusCode).toBe(404);
    await app.close();
  });

  it('502 external_service_error when the LLM call fails; pending list untouched', async () => {
    const repo = await makeRepo();
    const failing = new MockLLMProvider('openai');
    failing.completeStructured = async () => {
      throw new Error('429 You have no credits remaining');
    };
    const app = await makeApp({ llm: failing });
    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/conventions/extract` });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toMatchObject({ code: 'external_service_error' });
    expect(res.json().error.message).toContain('no credits remaining');
    const list = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/conventions` })).json();
    expect(list).toEqual({ scan: null, candidates: [] });
    await app.close();
  });
});
