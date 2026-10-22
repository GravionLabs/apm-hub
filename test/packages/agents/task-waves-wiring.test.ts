import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const REFS = 'packages/github/.apm/skills/github-issue/references';
const pipeline = read(`${REFS}/pbi-pipeline.md`);
const loop = read(`${REFS}/loop-mode.md`);
const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const runner = read('packages/agents/.apm/agents/pbi-runner.agent.md');
const inline = read('packages/agents/.apm/skills/orchestrator/SKILL.md');
const docs = read('docs/orchestrator.md');
const step4 = pipeline.split('\n').find((l) => l.startsWith('4. **Implement**')) ?? '';
const body = (agent: string) => agent.replace(/^---\n[\s\S]*?\n---\n/, '');

describe('Task waves wiring (#467)', () => {
  it('orchestrator names --parallel in its flag line and forwards it; the body stays within 40 lines', () => {
    expect(orchestrator).toMatch(/`--parallel <1-4>`/);
    expect(orchestrator).toMatch(/forwarded to `pbi-runner`/);
    expect(orchestrator).toMatch(/references\/task-waves\.md/);
    expect(body(orchestrator).split('\n').filter((l) => l.trim()).length).toBeLessThanOrEqual(40);
  });

  it('orchestrator body does not carry the wave rules or the defaults', () => {
    expect(body(orchestrator)).not.toMatch(/cherry-pick|floor\(4/);
  });

  it('pbi-runner names the flag and gets the Get-TaskWaves permission like the other scripts', () => {
    expect(runner).toMatch(/`--parallel <n>`/);
    expect(runner).toContain('Get-TaskWaves.ps1 *');
    expect(orchestrator).toContain('Get-TaskWaves.ps1 *');
  });

  it('the inline /orchestrator skill accepts --parallel', () => {
    expect(inline).toMatch(/--parallel <1-4>/);
  });

  it('loop runner mode forwards --parallel verbatim and says the implementer budget is shared', () => {
    expect(loop).toMatch(/forwards `--fix-advisories` and `--no-review-summary` verbatim \(also `--parallel`\)/);
    expect(loop).toMatch(/budget of 4 `implementer` subagents per repository is shared/);
  });

  it('pipeline step 4 points to task-waves.md and keeps BASE and task commit rules', () => {
    expect(step4).toContain('`references/task-waves.md`');
    expect(step4).toMatch(/waves/);
    expect(step4).toMatch(/`--parallel 1`/);
    expect(step4).toMatch(/record `BASE=\$\(git rev-parse HEAD\)` once, before the first wave/);
    expect(step4).toMatch(/footer `Refs #<task>`/);
    expect(step4).toMatch(/never get their own branch or PR; local task branches of a wave are never pushed/);
  });

  it('defaults live in task-waves.md only', () => {
    expect(fs.existsSync(path.join(ROOT, REFS, 'task-waves.md'))).toBe(true);
    expect(pipeline).not.toMatch(/default 3/);
    expect(docs).toMatch(/task-waves\.md/);
  });

  it('ledger: Wave line format, DONE only after integration, Worktree install line', () => {
    expect(pipeline).toContain('`Wave <w>: <task list> — integrated <sha>|conflict #<task>`');
    expect(pipeline).toContain('`Worktree #<task>: install <s>s`');
    expect(pipeline).toMatch(/written only after the commits are on the PBI branch/);
  });

  it('resume integrates an unintegrated task branch instead of re-implementing', () => {
    expect(pipeline).toMatch(/an unintegrated local task branch is integrated, not re-implemented/);
  });

  it('review, PR task list and review range stay as before', () => {
    expect(pipeline).toContain('`<first BASE>..HEAD`');
    expect(pipeline).toContain('`#<task> — <sha>`');
  });

  it('docs/orchestrator.md Clients lists the parallel dispatch per client and the fallback', () => {
    const clients = docs.slice(docs.indexOf('## Clients'));
    expect(clients).toMatch(/parallel `Agent` calls/);
    expect(clients).toMatch(/parallel `task` calls/);
    expect(clients).toMatch(/`runSubagent`/);
    expect(clients).toMatch(/falls back to `--parallel 1` and says so in one line/);
  });
});
