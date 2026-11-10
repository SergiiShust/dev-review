/**
 * Review module constants.
 */

/**
 * Studio review strategy. 'single-pass' = send the WHOLE diff in ONE LLM call.
 * We deliberately do NOT use 'auto'/map-reduce by default: map-reduce makes one
 * call PER FILE, which is slow and fragile (any single file's transient 5xx
 * fails the entire run) and unnecessary — the whole diff already fits the
 * model's context.
 */
export const REVIEW_STRATEGY = 'single-pass' as const;

/**
 * Budget (chars, ~10k tokens) for the combined linked-skills block in one review
 * prompt. Each body is already capped at SKILL_BODY_MAX_CHARS on write, but an
 * agent can link many skills, and map-reduce repeats the block per file — so the
 * total is bounded like the PR description / callers / repo map sections.
 */
export const SKILLS_PROMPT_MAX_CHARS = 40_000;
