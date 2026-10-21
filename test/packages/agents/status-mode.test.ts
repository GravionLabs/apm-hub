import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const dir = 'packages/github/.apm/skills/github-issue';
const status = read(`${dir}/references/status.md`);
const gates = read(`${dir}/references/orchestrator-gates.md`);
const skill = read(`${dir}/SKILL.md`);
const section = (text: string, heading: string) => text.split(`## ${heading}`)[1].split(/^## /m)[0];

describe('status.md: status table rules', () => {
  it('lists the six states in precedence order', () => {
    const states = section(status, 'States');
    const order = ['`merged`', '`pr-open #<n>`', '`needs-decision`', '`blocked by #<a>, #<b>`', '`in progress (<detail>)`', '`open`'];
    const idx = order.map(s => states.indexOf(s));
    expect(idx.every(i => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('references the merged rule instead of restating it', () => {
    expect(status).toContain('`## Merged (closes at release)`');
    expect(status).not.toContain('git log --grep');
    expect(status).not.toContain('--grep');
  });

  it('defines in progress by the ledger not ending in Ledger complete and the remote branch', () => {
    const states = section(status, 'States');
    expect(states).toMatch(/last non-empty line is not `Ledger complete\.`/);
    expect(states).toContain('/<nr>-');
  });

  it('names the headless output file and the Status line', () => {
    const out = section(status, 'Output');
    expect(out).toContain('<state>/status-<nr>.md');
    expect(out).toContain('Status: <state>/status-<nr>.md');
  });

  it('creates no state file and writes no ledger', () => {
    expect(section(status, 'Sources')).toMatch(/No new state file/);
    expect(section(status, 'Sources')).toMatch(/never creates `<state>\/<nr>\/progress\.md`/);
  });

  it('is linked from SKILL.md and the overview defers to it', () => {
    expect(skill).toContain('references/status.md');
    expect(gates).toContain('`status.md` `## States`');
  });
});

const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const agentBody = orchestrator.split(/^---$/m).slice(2).join('---');
const agentDescription = /^description: (.*)$/m.exec(orchestrator)![1];
const statusRule = agentBody.split('\n').find(l => l.startsWith('`status <feature|epic>`')) ?? '';
const launcher = read('packages/agents/.apm/skills/orchestrator/SKILL.md');

describe('status mode word: orchestrator agent', () => {
  it('lists status as the sixth mode in the description', () => {
    expect(agentDescription).toContain('plan|implement|full|next|loop|status');
    expect(agentDescription).toMatch(/status prints the PBI state table/);
  });

  it('accepts status as a first-word mode', () => {
    expect(agentBody).toMatch(/`next`, `loop` or `status`; otherwise \*\*full\*\*/);
  });

  it('has its own status rule line pointing to references/status.md', () => {
    expect(statusRule).not.toBe('');
    expect(statusRule).toContain('`github-issue` `references/status.md`');
    expect(statusRule).not.toContain('`loop <feature|epic>`');
  });

  it('names the headless file, the writer script and the Status line', () => {
    expect(statusRule).toContain('<state>/status-<nr>.md');
    expect(statusRule).toContain('Write-StatusTable.ps1');
    expect(statusRule).toContain('Status: <state>/status-<nr>.md');
    expect(statusRule).toMatch(/interactive: show the table and ask which mode to start/);
  });

  it('is read-only and writes no ledger, Next or Ledger complete line', () => {
    expect(statusRule).toMatch(/read-only: no ledger, no `Next:` or `Ledger complete\.` lines/);
    expect(agentBody).toMatch(/Report at the end \(not for `status`/);
  });

  it('rejects a PBI or a description', () => {
    expect(statusRule).toMatch(/A PBI or a description: say `status` needs a Feature or Epic number and stop/);
    expect(agentBody).toMatch(/`next` takes none, nor does `loop` or `status`: say so and stop/);
  });
});

describe('status mode word: gates parser and launcher skill', () => {
  it('gates parser accepts status and rejects a status description', () => {
    const parse = section(gates, 'Description input');
    expect(parse).toMatch(/`next`, `loop` or `status`/);
    expect(parse).toMatch(/`status <description>`[^\n]*needs a Feature or Epic number and stop/);
  });

  it('launcher skill lists status and takes no description for it', () => {
    const description = /^description: (.*)$/m.exec(launcher)![1];
    expect(description).toContain('plan|implement|full|next|loop|status');
    expect(launcher).toMatch(/`next`, `loop` and `status` take no description/);
  });

  it('does not accept a status mode in the description-capable list', () => {
    expect(launcher).toContain('a description for `plan|implement|full`;');
  });
});

describe('status mode docs', () => {
  const working = read('docs/working-mode.md');
  const orch = read('docs/orchestrator.md');

  it('working-mode.md names status as the first command after /clear', () => {
    expect(working).toMatch(/After `\/clear`, start with `orchestrator status <feature\|epic>`/);
    expect(working).toContain('| `status <nr>` |');
    expect(working).toContain('`status 81`');
  });

  it('orchestrator.md lists the mode and has a status section before next', () => {
    expect(orch).toContain('| `status <feature or epic>` |');
    const a = orch.indexOf('## Checking state with `status`');
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(orch.indexOf('## Picking work with `next`'));
  });

  it('AGENTS.md agents row lists status', () => {
    const agents = read('AGENTS.md');
    expect(agents.match(/modes `plan\|implement\|full\|next\|loop\|status`/g)).toHaveLength(2);
  });
});
