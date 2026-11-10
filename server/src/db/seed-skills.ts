/**
 * Demo skills used by the seed — reusable, text-only prompt snippets linked to
 * agents. Each entry lists its body history oldest → newest: the last body is
 * the current one, earlier bodies become prior `skill_versions` rows (so the
 * Versions tab has something to diff/restore on a fresh workspace).
 *
 * The DB rows are the source of truth at run time; editing a body here only
 * affects freshly seeded workspaces.
 */

export interface SeedSkill {
  name: string;
  description: string;
  type: 'rubric' | 'convention' | 'security' | 'custom';
  /** Body history, oldest first; the last entry is the current body. */
  bodies: string[];
  /** Seeded agent (by name) this skill is linked to, in list order. */
  linkTo?: string;
}

const PR_QUALITY_RUBRIC_V1 = `# PR Quality Rubric

Evaluate the pull request against the following dimensions.

## Correctness
- Does the change do what the PR description claims?

## Security
- Any secrets, tokens, or credentials in the diff?`;

const PR_QUALITY_RUBRIC_V2 = `# PR Quality Rubric

Evaluate the pull request against the following dimensions. For each, return a
finding only when the issue is **worth the author's time** — aim for 5
high-signal findings, not 50.

## Correctness
- Does the change do what the PR description claims?
- Are edge cases (empty input, nulls, concurrency) handled?

## Security
- Any secrets, tokens, or credentials in the diff?
- Untrusted input reaching a sink (SQL, shell, fetch)?

## Tests
- New branches covered by assertions?`;

const SECRET_LEAKAGE_GATE = `# Secret Leakage Gate

Flag as CRITICAL any committed credential:
- Stripe live keys (\`sk_live_\`), Supabase \`service_role\` keys
- Server-only secrets exposed through a \`NEXT_PUBLIC_\` env var
- Private keys, bearer tokens, or passwords in config or fixtures`;

const NO_THEN_CHAINS = `# No .then() chains

House rule: use \`async\`/\`await\` instead of promise \`.then()\` chains.
Flag new \`.then()\` / \`.catch()\` chains as SUGGESTION and show the
\`await\` rewrite.`;

export const SEED_SKILLS: SeedSkill[] = [
  {
    name: 'pr-quality-rubric',
    description: 'Rubric for evaluating overall PR quality across correctness, security, and tests.',
    type: 'rubric',
    bodies: [PR_QUALITY_RUBRIC_V1, PR_QUALITY_RUBRIC_V2],
    linkTo: 'Security Reviewer',
  },
  {
    name: 'secret-leakage-gate',
    description: 'Detects sk_live, service_role, and NEXT_PUBLIC_ secret leaks.',
    type: 'security',
    bodies: [SECRET_LEAKAGE_GATE],
    linkTo: 'Security Reviewer',
  },
  {
    name: 'no-then-chains',
    description: 'House rule: always use async/await instead of .then() chains.',
    type: 'convention',
    bodies: [NO_THEN_CHAINS],
  },
];
