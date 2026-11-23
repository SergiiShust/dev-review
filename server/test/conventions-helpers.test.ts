import { describe, it, expect } from 'vitest';
import {
  ConventionCandidate,
  ConventionSkillDraft,
  SKILL_BODY_MAX_CHARS,
} from '@devdigest/shared';
import {
  buildSkillDraft,
  groundCandidate,
  normalizeCategory,
  renderPromptFile,
  ruleKey,
  safeRelativePath,
  slugify,
  splitLines,
  toConventionDto,
} from '../src/modules/conventions/helpers.js';
import type { ExtractionCandidate } from '../src/modules/conventions/prompt.js';
import type { ConventionRow } from '../src/db/rows.js';

const USERS_TS = [
  "import { db } from '../db';",
  '',
  'export async function getUser(id: string) {',
  '  const user = await db.users.find(id);',
  '  const posts = await db.posts.findMany({ userId: id });',
  '  return { user, posts };',
  '}',
].join('\n');

const files = new Map([['src/api/users.ts', splitLines(USERS_TS)]]);

function cand(over: Partial<ExtractionCandidate['evidence']> & { rule?: string } = {}): ExtractionCandidate {
  const { rule, ...ev } = over;
  return {
    category: 'Async Style',
    rule: rule ?? 'Always use async/await instead of .then() chains',
    evidence: {
      path: 'src/api/users.ts',
      line_start: 4,
      line_end: 5,
      snippet: 'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId: id });',
      ...ev,
    },
    confidence: 0.91,
  };
}

describe('safeRelativePath', () => {
  it('normalizes ./ and backslashes', () => {
    expect(safeRelativePath('./src/a.ts')).toBe('src/a.ts');
    expect(safeRelativePath('src\\a.ts')).toBe('src/a.ts');
  });
  it('rejects traversal, absolute and NUL paths', () => {
    expect(safeRelativePath('../etc/passwd')).toBeNull();
    expect(safeRelativePath('src/../../x')).toBeNull();
    expect(safeRelativePath('/etc/passwd')).toBeNull();
    expect(safeRelativePath('C:/x')).toBeNull();
    expect(safeRelativePath('a\0b')).toBeNull();
    expect(safeRelativePath('')).toBeNull();
  });
});

describe('renderPromptFile', () => {
  it('prefixes 1-based line numbers', () => {
    const f = renderPromptFile('a.ts', 'x\ny', 10, 1000);
    expect(f.numbered).toBe('1| x\n2| y');
    expect(f.truncated).toBe(false);
  });
  it('truncates by line and char budget', () => {
    expect(renderPromptFile('a.ts', 'a\nb\nc', 2, 1000)).toMatchObject({ numbered: '1| a\n2| b', truncated: true });
    expect(renderPromptFile('a.ts', 'aaaa\nbbbb', 10, 8).numbered).toBe('1| aaaa');
  });
});

describe('groundCandidate (evidence gate)', () => {
  it('keeps a candidate whose snippet is at the cited lines, storing the REAL text', () => {
    const r = groundCandidate(cand(), files);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reanchored).toBe(false);
    expect(r.value).toMatchObject({ path: 'src/api/users.ts', lineStart: 4, lineEnd: 5, category: 'async-style', confidence: 0.91 });
    // Real file indentation, not the model's copy.
    expect(r.value.snippet).toBe('  const user = await db.users.find(id);\n  const posts = await db.posts.findMany({ userId: id });');
  });

  it('accepts a partial snippet and strips copied line-number prefixes', () => {
    const r = groundCandidate(cand({ snippet: '4|   const user = await db.users.find(id);' }), files);
    expect(r.ok).toBe(true);
  });

  it('re-anchors a citation that is off by a couple of lines', () => {
    const r = groundCandidate(cand({ line_start: 2, line_end: 3, snippet: 'const user = await db.users.find(id);' }), files);
    expect(r).toMatchObject({ ok: true, reanchored: true, value: { lineStart: 3, lineEnd: 4 } });
  });

  it('drops a file outside the sample', () => {
    expect(groundCandidate(cand({ path: 'src/other.ts' }), files)).toMatchObject({ ok: false });
  });

  it('drops traversal paths', () => {
    expect(groundCandidate(cand({ path: '../src/api/users.ts' }), files)).toMatchObject({ ok: false });
  });

  it('drops out-of-range lines', () => {
    expect(groundCandidate(cand({ line_start: 6, line_end: 99 }), files)).toMatchObject({ ok: false });
    expect(groundCandidate(cand({ line_start: 0, line_end: 1 }), files)).toMatchObject({ ok: false });
  });

  it('drops a hallucinated snippet', () => {
    const r = groundCandidate(cand({ snippet: 'fetchUser(id).then((u) => u.name)' }), files);
    expect(r).toMatchObject({ ok: false });
  });

  it('drops a too-short snippet and an empty rule', () => {
    expect(groundCandidate(cand({ snippet: '}' }), files)).toMatchObject({ ok: false });
    expect(groundCandidate(cand({ rule: '  ' }), files)).toMatchObject({ ok: false });
  });

  it('swaps reversed ranges and clamps confidence', () => {
    const c = { ...cand({ line_start: 5, line_end: 4 }), confidence: 3 };
    expect(groundCandidate(c, files)).toMatchObject({ ok: true, value: { lineStart: 4, lineEnd: 5, confidence: 1 } });
  });
});

describe('rule/category normalization', () => {
  it('ruleKey ignores case and punctuation', () => {
    expect(ruleKey('Use async/await, not .then()!')).toBe(ruleKey('use async await not then'));
  });
  it('normalizeCategory kebab-cases with a fallback', () => {
    expect(normalizeCategory('Error Handling')).toBe('error-handling');
    expect(normalizeCategory('!!')).toBe('general');
  });
  it('slugify trims to a heading-safe slug', () => {
    expect(slugify('Always use async/await instead of .then() chains')).toBe('always-use-async-await-instead-of-then-chains');
  });
});

function dto(over: Partial<ConventionCandidate> = {}): ConventionCandidate {
  return {
    id: 'c1',
    category: 'async',
    rule: 'Always use async/await instead of .then() chains.',
    evidence_path: 'src/api/users.ts',
    evidence_line_start: 23,
    evidence_line_end: 31,
    evidence_snippet: 'const user = await db.users.find(id);',
    confidence: 0.91,
    status: 'accepted',
    created_at: '2026-11-09T00:00:00.000Z',
    ...over,
  };
}

describe('buildSkillDraft', () => {
  it('merges accepted candidates into the mockup layout', () => {
    const draft = buildSkillDraft('payments-api', [
      dto(),
      dto({ id: 'c2', rule: 'Redis access goes through src/lib/redis.ts singleton', evidence_path: 'src/lib/redis.ts', evidence_line_start: 1, evidence_line_end: 1, evidence_snippet: 'export const redis = new Redis(config.redisUrl);' }),
    ]);
    expect(ConventionSkillDraft.parse(draft)).toEqual(draft);
    expect(draft).toMatchObject({
      name: 'payments-api-conventions',
      description: '2 house conventions extracted from payments-api',
      type: 'convention',
      enabled: true,
      accepted_count: 2,
    });
    expect(draft.body).toContain('# payments-api-conventions');
    expect(draft.body).toContain('cite the offending `file:line`');
    expect(draft.body).toContain('## always-use-async-await-instead-of-then-chains');
    expect(draft.body).toContain('Detected in `src/api/users.ts:23-31`:');
    expect(draft.body).toContain('Detected in `src/lib/redis.ts:1`:');
    expect(draft.body).toContain('```ts\nconst user = await db.users.find(id);\n```');
  });

  it('de-duplicates headings and respects the body limit', () => {
    const big = 'x'.repeat(SKILL_BODY_MAX_CHARS / 2);
    const draft = buildSkillDraft('r', [dto({ evidence_snippet: big }), dto({ evidence_snippet: big }), dto()]);
    expect(draft.body.length).toBeLessThanOrEqual(SKILL_BODY_MAX_CHARS + 1);
    expect(draft.description).toBe('1 house convention extracted from r');
    const d2 = buildSkillDraft('r', [dto(), dto()]);
    expect(d2.body).toContain('## always-use-async-await-instead-of-then-chains-2');
  });
});

describe('toConventionDto', () => {
  it('maps a row to a contract-valid candidate', () => {
    const row: ConventionRow = {
      id: 'c1',
      workspaceId: 'w',
      repoId: 'r',
      scanId: null,
      category: 'async',
      rule: 'r',
      evidencePath: 'a.ts',
      evidenceLineStart: 1,
      evidenceLineEnd: 2,
      evidenceSnippet: 'x',
      confidence: 0.5,
      status: 'pending',
      createdAt: new Date('2026-11-09T00:00:00.000Z'),
      updatedAt: new Date('2026-11-09T00:00:00.000Z'),
    };
    const d = toConventionDto(row);
    expect(ConventionCandidate.parse(d)).toEqual(d);
  });
});
