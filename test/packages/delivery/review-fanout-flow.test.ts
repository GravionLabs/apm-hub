import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const fanout = fs.readFileSync(path.join(root, 'packages/delivery/.apm/skills/review-fanout/SKILL.md'), 'utf-8');
const lead = fs.readFileSync(path.join(root, 'packages/agents/.apm/agents/review-lead.agent.md'), 'utf-8');

describe('review-fanout: no active waiting (#451)', () => {
  it('SKILL.md dispatches in one message and forbids sleep and polling', () => {
    expect(fanout).toMatch(/No active waiting/);
    expect(fanout).toMatch(/ONE message, then wait for their replies/);
    expect(fanout).toMatch(/Never run `sleep` or `Start-Sleep`, never poll/);
    for (const c of ['`Agent` returns', '`task()` awaits', '`runSubagent` returns']) expect(fanout).toContain(c);
  });

  it('review-lead carries the same rule', () => {
    expect(lead).toMatch(/No active waiting/);
    expect(lead).toMatch(/ONE message, then wait for their replies/);
    expect(lead).toMatch(/Never run `sleep` or `Start-Sleep`, never poll/);
  });
});

describe('review-fanout: early verify (#452)', () => {
  it('SKILL.md starts verify per arriving dimension and keeps the verdict behind all results', () => {
    expect(fanout).toMatch(/Early verify/);
    expect(fanout).toMatch(/as soon as its result contains a CRITICAL or HIGH finding, while other dimensions still run/);
    expect(fanout).toMatch(/one verify batch \(a single message\) per arriving dimension/);
    expect(fanout).toMatch(/verdict waits for all dimensions and all verify results/);
  });

  it('dedupe stays after all dimensions and keeps early refutations', () => {
    expect(fanout).toMatch(/runs after all dimensions reported/);
    expect(fanout).toMatch(/refuted in early verify stays refuted/);
  });

  it('keeps the fail-closed rules', () => {
    expect(fanout).toMatch(/`unverifiable` \(stays blocking\)/);
    expect(fanout).toMatch(/Fail closed: a failed dimension/);
  });

  it('review-lead follows the same flow', () => {
    expect(lead).toMatch(/Early verify/);
    expect(lead).toMatch(/CRITICAL or HIGH finding, dispatch its verify batch at once while other dimensions still run/);
    expect(lead).toMatch(/wait for all dimensions and all verify results, a finding refuted early stays refuted/);
  });
});
