import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const reviewer = read('agents/.apm/agents/reviewer.agent.md');
const fanout = read('delivery/.apm/skills/review-fanout/SKILL.md');
const orchestratorAgent = read('agents/.apm/agents/orchestrator.agent.md');
// steps 0-6 and per-PBI rules live in the pipeline reference
const orchestrator = orchestratorAgent + '\n' + read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
const verify = read('delivery/.apm/skills/verify-project/SKILL.md');
const specDim = read('delivery/.apm/skills/review-fanout/references/spec-dimension.md');

describe('reviewer without a review package (#233)', () => {
  it('reviewer returns [] plus a NO_PACKAGE line and has no git diff fallback', () => {
    expect(reviewer).toContain('`[]` followed by one line `NO_PACKAGE: <reason>`');
    expect(reviewer).toMatch(/Never a finding with an empty `file`/);
    expect(reviewer).not.toContain('fallback: `git diff');
    expect(reviewer).toContain('run no git command');
    expect(reviewer).toContain('Path missing, file missing or empty');
    expect(reviewer).not.toMatch(/git diff <base>\.\.\.HEAD/);
  });

  it('review-fanout checks the package before dispatching', () => {
    expect(fanout).toMatch(/Before any dispatch .*exists and is non-empty/);
    expect(fanout).toContain('dispatch nothing');
    expect(fanout).toContain('step 2 and step 4');
    expect(fanout).toContain('report `incomplete: true`');
  });

  it('location-less advisories use a placeholder location in fanout and spec brief', () => {
    expect(fanout).toMatch(/\(`spec` "no spec available", `conventions` "install `<stack>@apm-hub`"\) use the placeholder `file` = the package path, `line` = 1/);
    expect(specDim).toMatch(/"no spec available" with severity LOW, placeholder location `file` = the package path, `line` = 1/);
  });

  it('review-fanout rejects empty-file findings and fails closed', () => {
    expect(fanout).toMatch(/empty or missing `file`.*invalid, never advisory/);
    expect(fanout).toMatch(/`NO_PACKAGE:` line also marks the dimension failed/);
    expect(fanout).toMatch(/Fail closed: a failed dimension[^\n]*`incomplete: true`/);
  });

  it('orchestrator dispatches reviewer only via review-fanout, never after the PR', () => {
    expect(orchestrator).toMatch(/only from `review-fanout`, only after that package file exists/);
    expect(orchestrator).toContain('never after the PR phase');
  });

  it('verify-project does not fork into the reviewer agent', () => {
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(verify)?.[1] ?? '';
    expect(front).not.toBe('');
    expect(front).toContain('context: fork');
    expect(front).not.toMatch(/agent:\s*reviewer/);
  });
});
