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
