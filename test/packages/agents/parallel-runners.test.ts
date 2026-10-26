import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const runnerAgent = read('packages/agents/.apm/agents/pbi-runner.agent.md');
const reference = read('packages/github/.apm/skills/github-issue/references/loop-mode.md');
const status = read('packages/github/.apm/skills/github-issue/references/status.md');
const docs = read('docs/orchestrator.md');

const body = orchestrator.split(/^---$/m)[2];
const section = (text: string, heading: string) => text.split(heading)[1].split(/^#{2,3} /m)[0];
const parallel = section(reference, '### Parallel runners (`--pbi-parallel <m>`)');
/** One bullet of the section, found by its bold lead-in. */
const bullet = (name: string) =>
  parallel.split('\n').find((l) => l.startsWith(`- **${name}**`)) ?? '';

describe('orchestrator agent: --pbi-parallel', () => {
  it('names the flag only, the rules live in loop-mode.md', () => {
    expect(body).toMatch(/`--pbi-parallel <1-4>` \(loop, default 2; `loop-mode.md` Runner mode\)/);
    expect(body.trim().split('\n').length).toBeLessThanOrEqual(40);
    expect(body).not.toMatch(/gate queue|slot/i);
  });

  it('lets the runner bind its own checkout in a parallel loop', () => {
    expect(runnerAgent).toMatch(/optional `bind: true`[^)]*-Bind loop-<loop>[^)]*-Unbind/);
  });
});

describe('loop-mode reference: parallel runners', () => {
  it('has 1-4, default 2, and 1 as the sequential mode', () => {
    const flag = bullet('Flag');
    expect(flag).toContain('`1`-`4`, default `2`');
    expect(flag).toMatch(/`1` is the sequential procedure/);
    expect(flag).toContain('-PbiParallel <m>');
  });

  it('dispatches the first <m> candidates in sub-issue order in one message, each in its own checkout with its own marker', () => {
    const start = bullet('Start');
    expect(start).toMatch(/first `<m>` candidates in sub-issue order/);
    expect(start).toMatch(/ONE message/);
    expect(start).toContain('run_in_background: true');
    const own = bullet('Own checkout and marker');
    expect(own).toMatch(/step 1b/);
    expect(own).toContain('`.worktrees/<nr>`');
    expect(own).toContain('-Bind loop-<nr>');
    expect(own).toContain('bind: true');
  });

  it('gives each runner --parallel floor(4 / <m>), never above the user value', () => {
    const budget = bullet('Implementer budget');
    expect(budget).toContain('--parallel floor(4 / <m>)');
    expect(budget).toMatch(/at most 4 `implementer` subagents/);
    expect(budget).toMatch(/never more than the user's `--parallel`/);
    expect(budget).toContain('task-waves.md');
    // the formula for the default and the extremes
    const k = (m: number) => Math.floor(4 / m);
    expect([1, 2, 3, 4].map(k)).toEqual([4, 2, 1, 1]);
    expect(budget).toMatch(/2 runners: 2, 3 or 4 runners: 1/);
  });

  it('queues gates oldest first, prefixes the question and resumes one runner at a time', () => {
    const q = bullet('Gate queue');
    expect(q).toMatch(/arrival order \(oldest first\)/);
    expect(q).toContain('prefixed `PBI #<nr>: `');
    expect(q.indexOf('`AskUserQuestion`')).toBeLessThan(q.indexOf('`SendMessage`s the answer'));
    expect(q).toMatch(/agent id, then takes the next one/);
    expect(q).toMatch(/Runners not at a gate keep working/);
    expect(q).toMatch(/waits at the end of the queue/);
  });

  it('parks only the gated runner headless: no stop, no SendMessage to the others, slot refilled, cap counts done only', () => {
    const h = bullet('Headless');
    expect(h).toMatch(/parks only that runner's PBI/);
    expect(h).toMatch(
      /`Set-ParkedGate\.ps1` with the reply's `question`, `options` and `checkout`/
    );
    expect(h).toMatch(/the other runners are not stopped and get no `SendMessage`/);
    expect(h).toMatch(/free slot is filled like after `DONE`/);
    expect(h).toMatch(/The cap counts only `done` PBIs/);
    expect(h).not.toMatch(/Every other live runner gets/);
    expect(h).not.toContain('Loop: stopped — headless gate');
  });

  it('keeps the finish-and-stop message for BLOCKED, FAILED and user stop', () => {
    const b = bullet('`BLOCKED`, `FAILED`, user stop');
    expect(b).toMatch(/every other live runner gets `SendMessage`/);
    expect(b).toMatch(/nothing resumed/);
  });

  it('fills a free slot after a DONE: done line, release, reselect without live runners, until cap or warning', () => {
    const f = bullet('Slot filling');
    expect(f).toContain('`Loop: PBI #<nr> done — <pr>`');
    expect(f).toContain('`Exit-Checkout.ps1`');
    expect(f).toMatch(/leaves out the PBIs of live runners, read from the leases/);
    expect(f).toContain('Write-StatusTable.ps1 -Live');
    expect(f).toMatch(/until nothing is selectable, the cap or the context warning is reached/);
    expect(f.indexOf('stop checks')).toBeLessThan(f.indexOf('reselects'));
  });

  it('caps at 10 finished PBIs and never dispatches beyond it', () => {
    const c = bullet('Cap');
    expect(c).toMatch(/10 finished PBIs/);
    expect(c).toMatch(/finished plus live runners stay below the cap/);
    expect(c).toMatch(/wait for the live ones to finish \(they are not asked to stop\)/);
  });

  it('writes Loop: stopped once, after the last runner returned, then -Unbind', () => {
    const s = bullet('Stop line');
    expect(s).toMatch(/exactly once, after the last runner returned/);
    expect(s).toContain('-Unbind');
    expect(s).toMatch(/never interleave inside a line/);
    expect(bullet('`BLOCKED`, `FAILED`, user stop')).toMatch(/reasons `runner blocked`/);
  });

  it('documents the other-clients line', () => {
    expect(bullet('Other clients')).toContain(
      '`--pbi-parallel ignored: this client runs the loop inline, one PBI at a time.`'
    );
    expect(bullet('Other clients')).toMatch(/keep the inline loop/);
  });
});

describe('docs and status', () => {
  it('documents the parallel runners and the other clients in docs/orchestrator.md', () => {
    const loopDocs = section(docs, '## Looping with `loop`');
    expect(loopDocs).toContain('--pbi-parallel <m>');
    expect(loopDocs).toContain('--parallel floor(4 / <m>)');
    expect(loopDocs).toContain('`in progress (runner)`');
    const clients = docs.split('\n## Clients')[1].split(/^## /m)[0];
    expect(clients).toMatch(
      /parallel PBI runners \(`loop --pbi-parallel <m>`\)[^.]*keep the inline loop[^.]*ignore the flag with one line/
    );
  });

  it('adds the runner state from the leases to status.md before the ledger-based in progress', () => {
    expect(status).toMatch(
      /6\. `in progress \(runner\)`: the PBI holds a live checkout lease \(`<state>\/leases\/\*\.json`, `heartbeat` within 120 minutes/
    );
    expect(status.indexOf('`in progress (runner)`')).toBeLessThan(
      status.indexOf('7. `in progress (<detail>)`')
    );
    expect(status).toContain('Write-StatusTable.ps1 -Live');
  });
});
