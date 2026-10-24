import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const REFS = 'packages/github/.apm/skills/github-issue/references';
const pipeline = read(`${REFS}/pbi-pipeline.md`);
const loop = read(`${REFS}/loop-mode.md`);
const gates = read(`${REFS}/orchestrator-gates.md`);
const runner = read('packages/agents/.apm/agents/pbi-runner.agent.md');
const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const line = (text: string, label: string) =>
  text.split('\n').find((l) => l.startsWith(label)) ?? '';

describe('step 1b Checkout (#466)', () => {
  const s1b = line(pipeline, '1b. **Checkout**');

  it('sits between the issue-reader step and the explore step', () => {
    const i1 = pipeline.indexOf('\n1. **Read the issue**');
    const i1b = pipeline.indexOf('\n1b. **Checkout**');
    const i2 = pipeline.indexOf('\n2. **Explore**');
    expect(i1).toBeGreaterThan(0);
    expect(i1b).toBeGreaterThan(i1);
    expect(i2).toBeGreaterThan(i1b);
  });

  it('calls Enter-Checkout.ps1 with issue, branch and integration branch', () => {
    expect(s1b).toContain(
      'Enter-Checkout.ps1 -Issue <pbi> -Branch <type>/<pbi>-<slug> -Base <integration branch>'
    );
  });

  it('puts path and worktree into context.md', () => {
    expect(s1b).toMatch(/`path` and `worktree` into `context.md`/);
  });

  it('tells every subagent where to work: cd for Bash, absolute paths for file tools', () => {
    expect(s1b).toContain('every subagent prompt says "work in `<path>`"');
    expect(s1b).toContain('Bash: `cd <path>` first');
    expect(s1b).toMatch(/absolute paths under `<path>`/);
  });

  it('resumes with the same path and runs after the PBI exists in description runs', () => {
    expect(s1b).toMatch(/Resume: the lease of the same issue returns the same `path`/);
    expect(s1b).toMatch(/Description runs call it right after the PBI is created/);
    expect(gates).toMatch(/8\. Continue as `full` on `<issue>`: step 1b Checkout/);
  });

  it('is skipped by plan mode, taken by full, implement, next and loop PBIs', () => {
    expect(s1b).toMatch(
      /modes full and implement and every PBI of `next` and `loop`; `plan` edits no code/
    );
  });

  it('is listed in the orchestrator pipeline sentence', () => {
    expect(orchestrator).toContain('1b checkout');
  });
});

describe('releasing the checkout (#466)', () => {
  const rule = line(pipeline, '- Checkout (step 1b');

  it('Exit-Checkout.ps1 follows Ledger complete. in the pipeline rule for every run type', () => {
    expect(rule).toMatch(
      /`Ledger complete\.` \(full, implement, `next`, each PBI of `loop`, `pbi-runner` DONE\) releases it right after that line/
    );
    expect(rule).toContain('Exit-Checkout.ps1 -Issue <pbi>');
  });

  it('a gate stop, BLOCKED and FAILED keep the lease and print the path', () => {
    expect(rule).toMatch(
      /A gate stop \(also the headless `Gate:` stop\), BLOCKED and FAILED keep the lease: the report prints `Checkout kept: <path>`/
    );
  });

  it('the orchestrator releases right after Ledger complete. and keeps the lease on a gate or failure', () => {
    const i = orchestrator.indexOf('append `Ledger complete.`');
    expect(i).toBeGreaterThan(0);
    expect(orchestrator.slice(i)).toMatch(
      /then release the checkout with `Exit-Checkout\.ps1 -Issue <pbi>`; a gate or failure keeps the lease and prints `Checkout kept: <path>`/
    );
  });

  it('pbi-runner releases on DONE only', () => {
    expect(runner).toMatch(
      /append `Ledger complete\.` as the last ledger line, then `Exit-Checkout\.ps1 -Issue <pbi>`, before replying/
    );
    expect(runner).toMatch(
      /No `Ledger complete\.` on GATE, BLOCKED or FAILED, and no `Exit-Checkout\.ps1`: the lease stays/
    );
  });

  it('the loop releases each PBI after its done line and keeps the lease on stops', () => {
    expect(loop).toMatch(
      /`Loop: PBI #<nr> done — <pr>`, `Ledger complete\.` in the PBI's ledger, then `Exit-Checkout\.ps1 -Issue <pbi>`/
    );
    expect(loop).toMatch(
      /A gate stop, `runner blocked` and `runner failed` keep the lease and print `Checkout kept: <path>`/
    );
  });
});
