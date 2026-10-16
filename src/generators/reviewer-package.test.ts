import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const reviewer = read('agents/.apm/agents/reviewer.agent.md');
const fanout = read('delivery/.apm/skills/review-fanout/SKILL.md');
const orchestratorAgent = read('agents/.apm/agents/orchestrator.agent.md');
// steps 0-6 and per-PBI rules live in the pipeline reference
const orchestrator = orchestratorAgent + '\n' + read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
const pipeline = read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
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

  const step5 = (): string => {
    const line = pipeline.split('\n').find((l) => /^5\.\s/.test(l));
    if (!line) throw new Error('pbi-pipeline.md has no line starting with "5. "');
    return line;
  };

  it('step 5 dispatches review-lead on Claude Code and keeps the inline review-fanout elsewhere', () => {
    expect(step5()).toMatch(/dispatch `review-lead` \(sonnet\)/);
    expect(step5()).toMatch(/Claude Code/);
    expect(step5()).toMatch(/build the review summary from `findings`/);
    expect(step5()).toMatch(/Copilot CLI, OpenCode, VS Code Copilot[^)]*\) run one `review-fanout` inline/);
    expect(step5()).toContain('{verdict, mode, incomplete, failedDimensions, findings:');
    expect(pipeline).toMatch(/`review-lead` sonnet/);
  });

  it('step 5 treats a non-JSON review-lead reply as an error, records rulings and reuses an existing package', () => {
    expect(step5()).toMatch(/not that JSON counts as `\{error\}`/);
    expect(step5()).toContain('Ruling: review-lead retry');
    expect(step5()).toContain('Ruling: review-lead fallback inline');
    expect(step5()).toMatch(/reuse that package path/);
  });

  it('fix rounds pass the findings list and the review.json path, never the package', () => {
    expect(step5()).toMatch(/findings as a list plus the `review\.json` path, never the package/);
  });

  it('advisory policy is unchanged with review-lead', () => {
    for (const t of ['`--fix-advisories` apply that policy without asking', 'the rest go to the PR body', 'hidden by `--no-review-summary`']) expect(step5()).toContain(t);
  });

  it('verify-project does not fork into the reviewer agent', () => {
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(verify)?.[1] ?? '';
    expect(front).not.toBe('');
    expect(front).toContain('context: fork');
    expect(front).not.toMatch(/agent:\s*reviewer/);
  });
});
