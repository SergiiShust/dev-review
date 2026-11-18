import { z } from 'zod';
import type { ChatMessage } from '@devdigest/shared';
import { MAX_CANDIDATES } from './constants.js';

/**
 * Structured-output contract + prompt for the cheap conventions model. Pure.
 *
 * The model sees each sampled file with 1-based line-number prefixes (`12| …`)
 * so it can cite `line_start`/`line_end`; the server then re-verifies every
 * citation against the real file (helpers.groundCandidate).
 */

export const ExtractionCandidate = z.object({
  category: z
    .string()
    .describe('Short kebab-case bucket, e.g. naming, error-handling, async, imports, typing, structure, testing'),
  rule: z.string().describe('One imperative sentence stating the house rule'),
  evidence: z.object({
    path: z.string().describe('Repo-relative path exactly as shown in the FILE header'),
    line_start: z.number().int().describe('First 1-based line of the evidence'),
    line_end: z.number().int().describe('Last 1-based line of the evidence (inclusive)'),
    snippet: z.string().describe('The code at those lines, copied verbatim WITHOUT the line-number prefixes'),
  }),
  confidence: z.number().describe('0..1 — how consistently the codebase follows this rule'),
});
export type ExtractionCandidate = z.infer<typeof ExtractionCandidate>;

export const ExtractionResult = z.object({
  candidates: z.array(ExtractionCandidate).max(MAX_CANDIDATES),
});
export type ExtractionResult = z.infer<typeof ExtractionResult>;

export const SYSTEM_PROMPT = `You are a senior engineer onboarding onto a codebase. Infer its HOUSE CONVENTIONS — the rules a reviewer of this specific repo would enforce on a new pull request.

Focus on repo-specific patterns: naming, error handling, async style, module boundaries / layering, import style, typing discipline, data access, logging, testing layout, configuration.
Skip generic advice any linter already enforces (semicolons, indentation, trailing commas) unless a config file makes it an explicit rule.

Rules:
- Every candidate MUST cite real evidence from the files below: the exact path from the FILE header, the 1-based line range, and the snippet copied verbatim (no line-number prefixes).
- Prefer short, focused evidence (1–15 lines) that shows the convention clearly.
- confidence = how consistently the sample follows the rule (one occurrence ≈ 0.4, everywhere ≈ 0.9).
- Return at most ${MAX_CANDIDATES} candidates, strongest first. Do not invent files or code.`;

export interface PromptFile {
  path: string;
  /** Already line-numbered (see helpers.numberLines). */
  numbered: string;
  truncated: boolean;
}

export function buildExtractionMessages(repoName: string, files: PromptFile[]): ChatMessage[] {
  const blocks = files.map(
    (f) =>
      `=== FILE: ${f.path}${f.truncated ? ' (truncated)' : ''} ===\n${f.numbered}\n=== END FILE ===`,
  );
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Repository: ${repoName}\nSampled files (${files.length}):\n\n${blocks.join('\n\n')}`,
    },
  ];
}
