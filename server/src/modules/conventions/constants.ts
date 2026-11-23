/**
 * Conventions module constants — sampling budget, prompt limits, grounding tolerances.
 */

/** Source files sampled from repo-intel's rank (`getConventionSamples`). */
export const SAMPLE_SOURCE_FILES = 12;

/**
 * Root-level config files that encode explicit style rules. Read verbatim when
 * present (missing / empty files are skipped). Order = prompt order.
 */
export const CONFIG_FILE_CANDIDATES = [
  'tsconfig.json',
  '.editorconfig',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  '.prettierrc.cjs',
  'prettier.config.js',
  'prettier.config.mjs',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  'biome.json',
] as const;

/** Per-file budget in the prompt — keeps a 12-file sample well inside a cheap model's context. */
export const MAX_LINES_PER_FILE = 300;
export const MAX_CHARS_PER_FILE = 12_000;

/** Hard cap on candidates the model may return (schema-enforced). */
export const MAX_CANDIDATES = 20;

/** Longest evidence range we keep (lines). Longer citations are dropped as unfocused. */
export const MAX_EVIDENCE_LINES = 30;

/** How far (in lines) a mis-cited snippet may be re-anchored. */
export const REANCHOR_WINDOW = 3;

/** Minimum normalized snippet length — shorter snippets can't prove anything. */
export const MIN_SNIPPET_CHARS = 6;

export const EXTRACTION_SCHEMA_NAME = 'ConventionExtraction';
export const EXTRACTION_TEMPERATURE = 0.2;
export const EXTRACTION_MAX_RETRIES = 2;
export const EXTRACTION_TIMEOUT_MS = 120_000;

export const DEFAULT_CATEGORY = 'general';
