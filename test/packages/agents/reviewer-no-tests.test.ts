import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const reviewer = read('agents/.apm/agents/reviewer.agent.md');
const fanout = read('delivery/.apm/skills/review-fanout/SKILL.md');

describe('reviewers never run the test suite (#458)', () => {
  it('description no longer says the reviewer may run the test suite', () => {
    const description = reviewer.split('\n').find((l) => l.startsWith('description:'))!;
    expect(description).not.toContain('may run the test suite');
    expect(description).toContain('never runs the test suite');
  });

  it('OpenCode bash allow list holds only git diff/log/show', () => {
    const allowed = [...reviewer.matchAll(/^\s+"([^"]+)": allow$/gm)].map((m) => m[1]);
    expect(allowed).toEqual(['git diff*', 'git log*', 'git show*']);
    for (const cmd of ['pnpm test*', 'npm test*', 'dotnet test*', 'pytest*', 'uv run pytest*']) {
      expect(reviewer).not.toContain(`"${cmd}"`);
    }
    expect(reviewer).toMatch(/"\*": deny/);
  });

  it('body: the only commands are git diff/log/show', () => {
    expect(reviewer).toContain('the only commands you run are `git diff/log/show`');
    expect(reviewer).not.toMatch(/project's test command/);
  });

  it('review-fanout copies verify.json into the package head as a verify line, unknown when missing', () => {
    expect(fanout).toContain('<state>/<pbi>/verify.json');
    expect(fanout).toMatch(/`status`, `summary`, `tests`/);
    expect(fanout).toContain('verify: <status> — <summary> — tests <n>/<m>');
    expect(fanout).toMatch(/head of the package file/);
    expect(fanout).toContain('`verify: unknown`');
    expect(fanout).toMatch(/never run the suite/);
  });

  it('tests dimension brief judges from diff and verify line, never executes tests', () => {
    const brief = fanout.split('\n').find((l) => l.includes('- `tests`:'))!;
    expect(brief).toMatch(/from the diff and the package `verify:` line/);
    expect(brief).toMatch(/never execute tests/);
  });

  it('review-fanout stays within the size limit', () => {
    expect(fanout.split('\n').length).toBeLessThanOrEqual(100);
  });
});
