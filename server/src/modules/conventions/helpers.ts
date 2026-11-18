import {
  SKILL_BODY_MAX_CHARS,
  type ConventionCandidate,
  type ConventionScan,
  type ConventionSkillDraft,
  type Skill,
  type SkillSource,
  type SkillType,
} from '@devdigest/shared';
import type { ConventionRow, ConventionScanRow, SkillRow } from '../../db/rows.js';
import {
  DEFAULT_CATEGORY,
  MAX_EVIDENCE_LINES,
  MIN_SNIPPET_CHARS,
  REANCHOR_WINDOW,
} from './constants.js';
import type { ExtractionCandidate, PromptFile } from './prompt.js';

/**
 * Pure helpers for the conventions module — prompt file rendering, the
 * evidence-grounding gate, rule de-duplication, the accepted→skill merge, and
 * row → DTO mapping. No I/O.
 */

// ---------------------------------------------------------------- paths

/**
 * Normalize a repo-relative path and reject anything that could escape the
 * clone (absolute, `..` segments, NUL). Returns null when unsafe. The git
 * adapter's `readFile` has no traversal guard of its own.
 */
export function safeRelativePath(path: string): string | null {
  if (!path || path.includes('\0')) return null;
  const p = path.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  if (!p || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return null;
  if (p.split('/').some((seg) => seg === '..')) return null;
  return p;
}

// ---------------------------------------------------------------- prompt files

/** Split file text into lines (CRLF-safe). */
export function splitLines(content: string): string[] {
  return content.replace(/\r\n/g, '\n').split('\n');
}

/**
 * Render a file for the prompt with 1-based `N| ` prefixes, cut to a line and
 * char budget. Only the visible lines are citable — the grounding gate checks
 * against the full file, so a truncated tail can't be cited by accident.
 */
export function renderPromptFile(
  path: string,
  content: string,
  maxLines: number,
  maxChars: number,
): PromptFile {
  const lines = splitLines(content);
  const out: string[] = [];
  let chars = 0;
  for (let i = 0; i < lines.length && i < maxLines; i++) {
    const line = `${i + 1}| ${lines[i]}`;
    if (chars + line.length + 1 > maxChars) break;
    out.push(line);
    chars += line.length + 1;
  }
  return { path, numbered: out.join('\n'), truncated: out.length < lines.length };
}

// ---------------------------------------------------------------- grounding

/** Collapse all whitespace so formatting differences don't fail a real match. */
export function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Strip `12| ` prefixes the model may have copied from the numbered prompt. */
export function stripLinePrefixes(snippet: string): string {
  return splitLines(snippet)
    .map((l) => l.replace(/^\s*\d+\|\s?/, ''))
    .join('\n');
}

export interface GroundedCandidate {
  category: string;
  rule: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  /** The REAL file text at [lineStart, lineEnd] — never the model's copy. */
  snippet: string;
  confidence: number;
}

export type GroundResult =
  | { ok: true; value: GroundedCandidate; reanchored: boolean }
  | { ok: false; reason: string };

function rangeText(lines: string[], start: number, end: number): string {
  return lines.slice(start - 1, end).join('\n');
}

/**
 * The evidence gate. A candidate survives only when its path is one of the
 * sampled files, its line range is valid, and its snippet is actually present
 * at those lines (whitespace-insensitive). A citation off by up to
 * REANCHOR_WINDOW lines is re-anchored to where the snippet really is.
 *
 * `files` maps sampled repo-relative path → its lines.
 */
export function groundCandidate(
  c: ExtractionCandidate,
  files: ReadonlyMap<string, string[]>,
): GroundResult {
  const rule = c.rule.trim();
  if (!rule) return { ok: false, reason: 'empty rule' };

  const path = safeRelativePath(c.evidence.path);
  if (!path) return { ok: false, reason: `unsafe path "${c.evidence.path}"` };
  const lines = files.get(path);
  if (!lines) return { ok: false, reason: `file not in sample: ${path}` };

  let start = Math.trunc(c.evidence.line_start);
  let end = Math.trunc(c.evidence.line_end);
  if (end < start) [start, end] = [end, start];
  if (start < 1 || end > lines.length) {
    return { ok: false, reason: `lines ${start}-${end} out of range (${lines.length})` };
  }
  if (end - start + 1 > MAX_EVIDENCE_LINES) {
    return { ok: false, reason: `evidence too long (${end - start + 1} lines)` };
  }

  const snippet = normalizeWs(stripLinePrefixes(c.evidence.snippet));
  if (snippet.length < MIN_SNIPPET_CHARS) return { ok: false, reason: 'snippet too short' };

  const value = (s: number, e: number): GroundedCandidate => ({
    category: normalizeCategory(c.category),
    rule,
    path,
    lineStart: s,
    lineEnd: e,
    snippet: rangeText(lines, s, e),
    confidence: clamp01(c.confidence),
  });

  if (normalizeWs(rangeText(lines, start, end)).includes(snippet)) {
    return { ok: true, value: value(start, end), reanchored: false };
  }

  // Re-anchor: same span length, shifted by ±1..REANCHOR_WINDOW (nearest first).
  for (let d = 1; d <= REANCHOR_WINDOW; d++) {
    for (const shift of [-d, d]) {
      const s = start + shift;
      const e = end + shift;
      if (s < 1 || e > lines.length) continue;
      if (normalizeWs(rangeText(lines, s, e)).includes(snippet)) {
        return { ok: true, value: value(s, e), reanchored: true };
      }
    }
  }
  return { ok: false, reason: `snippet not found at ${path}:${start}-${end}` };
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function normalizeCategory(raw: string): string {
  const c = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return c || DEFAULT_CATEGORY;
}

/** Key for "same rule" de-duplication across scans (case/punctuation-insensitive). */
export function ruleKey(rule: string): string {
  return rule
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- merge → skill

/** Kebab-case slug of a rule, used as the `##` heading in the merged skill. */
export function slugify(text: string, maxLen = 48): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug.slice(0, maxLen).replace(/-+$/, '') || 'rule');
}

const LANG_BY_EXT: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
  mjs: 'js',
  cjs: 'js',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  rb: 'ruby',
  json: 'json',
  sql: 'sql',
  css: 'css',
  md: 'md',
  yml: 'yaml',
  yaml: 'yaml',
};

export function langFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return LANG_BY_EXT[ext] ?? '';
}

export function formatEvidenceRef(c: Pick<ConventionCandidate, 'evidence_path' | 'evidence_line_start' | 'evidence_line_end'>): string {
  const { evidence_path: p, evidence_line_start: s, evidence_line_end: e } = c;
  if (s == null) return p;
  return e != null && e !== s ? `${p}:${s}-${e}` : `${p}:${s}`;
}

/**
 * Merge accepted candidates into ONE `convention` skill draft (the create-modal
 * prefill). Body layout mirrors the Skills Lab mockup: a header instructing the
 * reviewer to cite `file:line`, then one `##` section per rule with its evidence.
 * Sections that would push the body past SKILL_BODY_MAX_CHARS are left out.
 */
export function buildSkillDraft(
  repoName: string,
  accepted: ConventionCandidate[],
): ConventionSkillDraft {
  const name = `${slugify(repoName, 64)}-conventions`;
  const header = [
    `# ${name}`,
    '',
    `House conventions for \`${repoName}\`. Flag changes that violate any rule below and cite the offending \`file:line\`.`,
  ].join('\n');

  const usedHeadings = new Set<string>();
  let body = header;
  let included = 0;
  for (const c of accepted) {
    let heading = slugify(c.rule);
    for (let i = 2; usedHeadings.has(heading); i++) heading = `${slugify(c.rule)}-${i}`;
    usedHeadings.add(heading);
    const section = [
      '',
      '',
      `## ${heading}`,
      c.rule,
      '',
      `Detected in \`${formatEvidenceRef(c)}\`:`,
      '```' + langFor(c.evidence_path),
      c.evidence_snippet,
      '```',
    ].join('\n');
    if (body.length + section.length > SKILL_BODY_MAX_CHARS) break;
    body += section;
    included++;
  }

  return {
    name,
    description: `${included} house convention${included === 1 ? '' : 's'} extracted from ${repoName}`,
    type: 'convention',
    enabled: true,
    body: `${body}\n`,
    accepted_count: accepted.length,
  };
}

// ---------------------------------------------------------------- DTOs

/**
 * Stable list order: confidence desc, then rule. Deliberately NOT by status —
 * accepting/rejecting a card must not make it jump in the list.
 */
export function sortCandidates(list: ConventionCandidate[]): ConventionCandidate[] {
  return [...list].sort((a, b) => b.confidence - a.confidence || a.rule.localeCompare(b.rule));
}

export function toConventionDto(row: ConventionRow): ConventionCandidate {
  return {
    id: row.id,
    category: row.category,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_line_start: row.evidenceLineStart ?? null,
    evidence_line_end: row.evidenceLineEnd ?? null,
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: clamp01(row.confidence ?? 0),
    status: row.status,
    created_at: row.createdAt.toISOString(),
  };
}

export function toScanDto(row: ConventionScanRow): ConventionScan {
  return {
    id: row.id,
    sample_count: row.sampleCount,
    candidate_count: row.candidateCount,
    dropped_count: row.droppedCount,
    model: row.model,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * Map a created skill row to the public `Skill` DTO. Mirrors `toSkillDto` in
 * the skills module (kept local — modules don't import from each other's
 * folders); keep the field mappings in sync.
 */
export function toCreatedSkillDto(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    created_at: row.createdAt.toISOString(),
  };
}
