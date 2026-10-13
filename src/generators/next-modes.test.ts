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

  it('keeps the body within 40 lines', () => {
    expect(body.trim().split('\n').length).toBeLessThanOrEqual(40);
  });

  it('detects the mode by first word and the type by label or prefix', () => {
    expect(body).toMatch(/first word/);
    expect(body).toMatch(/`\[Epic\]`, `\[Feature\]`, `\[PBI\]`, also `Epic: `/);
    expect(body).toMatch(/`plan <epic>` creates the Features first/);
    expect(body).toMatch(/Exactly one PBI per run/);
  });

  it('delegates selection to the github-issue reference and keeps the end lines', () => {
    expect(body).toContain('references/next-selection.md');
    expect(body).toContain('`Next: #<nr> <title> — orchestrator next <feature> after /clear`');
    expect(body).toContain('Ledger complete. Start the next issue in a new session (/clear or a new orchestrator run).');
    expect(body.indexOf('Next: #<nr>')).toBeLessThan(body.indexOf('Ledger complete.'));
  });
});

describe('next-selection reference', () => {
  it('has the sub_issues, blocked_by and needs-decision steps', () => {
    expect(reference).toContain('issues/<nr>/sub_issues');
    expect(reference).toContain('issues/<candidate>/dependencies/blocked_by');
    expect(reference).toContain('select(.state=="open")');
    expect(reference).toContain('needs-decision');
  });

  it('covers announcement, empty result and end-line variants', () => {
    expect(reference).toContain('Next PBI: #<nr> <title>');
    expect(reference).toMatch(/No candidate: report/);
    expect(reference).toContain('Next: #<nr> <title> — orchestrator next <feature> after /clear');
    expect(reference).toMatch(/unmerged PRs/);
    expect(reference).toMatch(/is done/);
  });

  it('is linked from the github-issue skill, which stays within 100 lines', () => {
    expect(skill).toContain('references/next-selection.md');
    expect(skill.split('\n').length).toBeLessThanOrEqual(100);
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
