import { describe, it, expect } from 'vitest';
import { budgetSkills, skillsBudgetSummary, taskLine } from '../src/modules/reviews/helpers.js';

/**
 * Unit coverage for the review task-line. The key invariant: our trusted
 * instruction always tells the model to review the whole diff and never
 * withhold a security/correctness finding — no matter what the PR text claims.
 */

describe('taskLine', () => {
  const pull = { number: 3, title: 'test: vulnerable fixture', author: 'burnjohn' } as never;

  it('names the PR being reviewed', () => {
    const line = taskLine(pull);
    expect(line).toContain('#3');
    expect(line).toContain('test: vulnerable fixture');
  });

  it('keeps the non-negotiable "never withhold security" rule', () => {
    const line = taskLine(pull);
    expect(line).toMatch(/never .*withhold .*(or downgrade )?.*security/i);
    expect(line).toMatch(/review the entire diff/i);
  });
});

describe('budgetSkills', () => {
  it('keeps every body, in order, when they fit', () => {
    expect(budgetSkills(['aa', 'bb'], 10)).toEqual(['aa', 'bb']);
    expect(budgetSkills([], 10)).toEqual([]);
  });

  it('truncates the body that crosses the budget and notes the dropped rest', () => {
    const out = budgetSkills(['aaaa', 'bbbbbb', 'cc', 'dd'], 7);
    expect(out[0]).toBe('aaaa');
    expect(out[1]).toMatch(/^bbb\n\[… skill truncated/);
    expect(out[2]).toMatch(/^\[2 more linked skill\(s\) omitted/);
    expect(out).toHaveLength(3);
  });

  it('drops (with a notice) when the budget is already exactly used', () => {
    expect(budgetSkills(['aaaa', 'bb'], 4)).toEqual([
      'aaaa',
      '[1 more linked skill(s) omitted: prompt skills budget reached]',
    ]);
  });

  it('earlier skills win — the first body is never displaced by later ones', () => {
    const out = budgetSkills(['x'.repeat(50), 'y'.repeat(5)], 20);
    expect(out[0]!.startsWith('x'.repeat(20))).toBe(true);
    expect(out.join('')).not.toContain('y');
  });
});

describe('skillsBudgetSummary', () => {
  it('counts every body when all fit', () => {
    expect(skillsBudgetSummary(['aa', 'bb'], 10)).toEqual({ attached: 2, truncated: false });
    expect(skillsBudgetSummary([], 10)).toEqual({ attached: 0, truncated: false });
  });

  it('counts the truncated body but not the dropped ones', () => {
    // budgetSkills keeps aaaa + a truncated bbb…, drops cc and dd.
    expect(skillsBudgetSummary(['aaaa', 'bbbbbb', 'cc', 'dd'], 7)).toEqual({ attached: 2, truncated: true });
  });

  it('does not count a body dropped when the budget is exactly used', () => {
    expect(skillsBudgetSummary(['aaaa', 'bb'], 4)).toEqual({ attached: 1, truncated: true });
  });

  it('agrees with budgetSkills on how many bodies are emitted', () => {
    const bodies = ['x'.repeat(20), 'y'.repeat(20), 'z'.repeat(20)];
    const { attached } = skillsBudgetSummary(bodies, 40);
    const real = budgetSkills(bodies, 40).filter((b) => !b.startsWith('['));
    expect(attached).toBe(real.length);
  });
});
