import * as fs from 'fs';
import * as path from 'path';

const doc = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../packages/github/.apm/skills/github-issue/references/task-issues.md'
  ),
  'utf-8'
);
const rule = doc.split('\n').find((l) => l.includes('source of truth'))!;

describe('task-issues.md local caches (#619)', () => {
  it('names plan.json and task-<nr>.md as local caches', () => {
    expect(rule).toContain('`<state>/<pbi>/plan.json`');
    expect(rule).toContain('`<state>/<pbi>/task-<nr>.md`');
    expect(rule).toContain('local caches');
  });

  it('a plan change edits the issue first, then both caches', () => {
    expect(rule.indexOf('gh issue edit')).toBeLessThan(rule.indexOf('then both caches'));
    expect(rule).toContain('rewrite `task-<nr>.md` from `gh issue view`');
  });
});
