import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const reference = read('packages/github/.apm/skills/github-issue/references/next-selection.md');
const skill = read('packages/github/.apm/skills/github-issue/SKILL.md');
const workingMode = read('docs/working-mode.md');

const body = orchestrator.split(/^---$/m)[2];
const description = /^description: (.*)$/m.exec(orchestrator)![1];

describe('orchestrator plan and next modes', () => {
  it('lists all four modes in the description', () => {
    expect(description).toContain('plan|implement|full|next');
  });

  it('detects the mode by first word and keeps one PBI per run', () => {
    expect(body).toMatch(/first word/);
    for (const type of ['Epic', 'Feature', 'PBI']) expect(body).toContain(`[${type}]`);
    expect(body).toMatch(/one PBI per run/i);
  });

  it('cites the reference with its owning skill and orders Next before Ledger', () => {
    expect(body).toContain('`github-issue` `references/next-selection.md`');
    const next = body.indexOf('Next: #<nr>');
    const ledger = body.indexOf('Ledger complete.');
    expect(next).not.toBe(-1);
    expect(ledger).not.toBe(-1);
    expect(next).toBeLessThan(ledger);
  });

  it('limits the end line to PBIs whose parent is a Feature', () => {
    expect(body).toMatch(/parent is a Feature/);
  });
});

describe('next-selection reference', () => {
  it('expands sub-issues recursively for an Epic, paginated, in order', () => {
    expect(reference).toContain('sub_issues');
    expect(reference).toMatch(/Epic/);
    expect(reference).toMatch(/recursive/);
    expect(reference).toMatch(/Features too/);
    expect(reference).toContain('--paginate');
    expect(reference).toMatch(/first remaining candidate in sub-issue order/);
  });

  it('filters open blockers by state, needs-decision and in-flight PRs', () => {
    expect(reference).toContain('dependencies/blocked_by');
    expect(reference).toContain('select(.state=="open")');
    expect(reference).toContain('needs-decision');
    expect(reference).toContain('gh pr list --state open');
    expect(reference).toMatch(/waiting for merge/);
  });

  it('covers announcement, empty result and end-line variants', () => {
    expect(reference).toContain('Next PBI: #<nr> <title>');
    expect(reference).toMatch(/No candidate/);
    expect(reference).toContain('orchestrator next <feature> after /clear');
    expect(reference).toMatch(/is done/);
  });

  it('is linked from the github-issue skill', () => {
    expect(skill).toContain('references/next-selection.md');
  });
});

describe('working-mode natural requests', () => {
  it.each([
    ['implementiere das nächste Feature', 'next <feature>'],
    ['plan all open features under #81', 'plan 81'],
  ])('maps "%s" to %s', (phrase, mode) => {
    const line = workingMode.split('\n').find((l) => l.includes(phrase));
    expect(line).toBeDefined();
    expect(line).toContain(mode);
  });
});
