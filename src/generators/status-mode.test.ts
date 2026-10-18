import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
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

  it('defines in progress by the missing Ledger complete line and the remote branch', () => {
    const states = section(status, 'States');
    expect(states).toMatch(/no line `Ledger complete\.`/);
    expect(states).toContain('/<nr>-');
  });

  it('names the headless output file and the Status line', () => {
    const out = section(status, 'Output');
    expect(out).toContain('.agents/status-<nr>.md');
    expect(out).toContain('Status: .agents/status-<nr>.md');
  });

  it('creates no state file and writes no ledger', () => {
    expect(section(status, 'Sources')).toMatch(/No new state file/);
    expect(section(status, 'Sources')).toMatch(/never creates `\.agents\/<nr>\/progress\.md`/);
  });

  it('is linked from SKILL.md and the overview defers to it', () => {
    expect(skill).toContain('references/status.md');
    expect(gates).toContain('`status.md` `## States`');
  });
});
