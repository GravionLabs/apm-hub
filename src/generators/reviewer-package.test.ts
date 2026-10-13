import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const reviewer = read('agents/.apm/agents/reviewer.agent.md');
const fanout = read('delivery/.apm/skills/review-fanout/SKILL.md');
const orchestrator = read('agents/.apm/agents/orchestrator.agent.md');
const verify = read('delivery/.apm/skills/verify-project/SKILL.md');

describe('reviewer without a review package (#233)', () => {
  it('reviewer returns [] plus a NO_PACKAGE line and has no git diff fallback', () => {
    expect(reviewer).toContain('`[]` followed by one line `NO_PACKAGE: <reason>`');
    expect(reviewer).toMatch(/Never a finding with an empty `file`/);
    expect(reviewer).not.toContain('fallback: `git diff');
  });

  it('review-fanout checks the package before dispatching', () => {
    expect(fanout).toMatch(/Before any dispatch .*exists and is non-empty/);
    expect(fanout).toContain('dispatch nothing');
  });

  it('review-fanout rejects empty-file findings and fails closed', () => {
    expect(fanout).toMatch(/empty or missing `file`.*invalid, never advisory/);
    expect(fanout).toContain('`NO_PACKAGE:`');
    expect(fanout).toMatch(/Fail closed: a failed dimension[^\n]*`incomplete: true`/);
  });

  it('orchestrator dispatches reviewer only via review-fanout, never after the PR', () => {
    expect(orchestrator).toMatch(/only from `review-fanout`, only after that package file exists/);
    expect(orchestrator).toContain('never after the PR phase');
  });

  it('verify-project does not fork into the reviewer agent', () => {
    const front = verify.split('---')[1];
    expect(front).toContain('context: fork');
    expect(front).not.toMatch(/agent:\s*reviewer/);
  });
});
