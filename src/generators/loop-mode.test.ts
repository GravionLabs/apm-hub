import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const reference = read('packages/github/.apm/skills/github-issue/references/loop-mode.md');
const gates = read('packages/github/.apm/skills/github-issue/references/orchestrator-gates.md');
const selection = read('packages/github/.apm/skills/github-issue/references/next-selection.md');
const skill = read('packages/github/.apm/skills/github-issue/SKILL.md');

const body = orchestrator.split(/^---$/m)[2];
const description = /^description: (.*)$/m.exec(orchestrator)![1];

describe('orchestrator loop mode', () => {
  it('lists loop as the fifth mode in the description', () => {
    expect(description).toContain('plan|implement|full|next|loop');
    expect(description).toMatch(/loop runs the PBIs of a Feature or Epic/);
  });

  it('keeps the mode rule and exempts loop from one PBI per run', () => {
    expect(body).toContain('`loop <feature|epic>`');
    expect(body).toMatch(/one PBI per run \(except `loop`\)/i);
    expect(body).toMatch(/`next` takes none, nor does `loop`/);
  });

  it('writes the loop ledger with Add-LedgerLine and the loop header', () => {
    expect(body).toContain('.agents/loop-<nr>/progress.md');
    expect(body).toContain('Add-LedgerLine.ps1 -Issue loop-<nr>');
    expect(body).toContain('# orchestrator ledger — loop #<nr> — branch <branch>');
    expect(body).toContain('Loop: PBI #<nr> done');
    expect(body).toMatch(/`Ruling:` lines stay in `\.agents\/<pbi>\/progress\.md`/);
  });

  it('cites the loop-mode reference with its owning skill', () => {
    expect(body).toContain('`github-issue` `references/loop-mode.md`');
  });

  it('names the three stop conditions and the gate pause', () => {
    expect(body).toMatch(/nothing is selectable/);
    expect(body).toMatch(/headless gate/);
    expect(body).toMatch(/context warning/);
    expect(body).toMatch(/Interactive gates pause the loop/);
  });

  it('applies the Next end line after a loop run as well', () => {
    const report = body.slice(body.indexOf('Report at the end'));
    expect(report).toMatch(/full, implement, next or loop run/);
    expect(report).toMatch(/last PBI handled/);
    expect(report.indexOf('Next: #<nr>')).toBeLessThan(report.indexOf('Ledger complete.'));
  });

  it('adds no top-level model, mode, permission or color key to the frontmatter', () => {
    const frontmatter = orchestrator.split(/^---$/m)[1];
    for (const key of ['model', 'mode', 'permission', 'color']) {
      expect(frontmatter).not.toMatch(new RegExp(`^${key}:`, 'm'));
    }
  });
});

describe('loop-mode reference', () => {
  it('stays within 60 lines', () => {
    expect(reference.trimEnd().split('\n').length).toBeLessThanOrEqual(60);
  });

  it('defines the loop ledger lines', () => {
    expect(reference).toContain('.agents/loop-<nr>/progress.md');
    expect(reference).toContain('-Issue loop-<nr>');
    expect(reference).toContain('# orchestrator ledger — loop #<nr> — branch <branch>');
    expect(reference).toContain('Loop: PBI #<nr> done — <pr>');
    expect(reference).toContain('Loop: stopped — <reason>');
    expect(reference).toMatch(/never in the loop ledger/);
  });

  it('reselects with the next-selection rules and excludes finished PBIs as waiting for merge', () => {
    expect(reference).toContain('next-selection.md');
    expect(reference).toMatch(/waiting for merge/);
    expect(reference).toMatch(/Never merge a PR/);
  });

  it('lists the three stop conditions', () => {
    const stops = reference.split('## Stop conditions')[1].split(/^## /m)[0];
    expect(stops).toMatch(/Nothing selectable/);
    expect(stops).toMatch(/No candidate/);
    expect(stops).toMatch(/Headless gate/);
    expect(stops).toContain('Gate: <question>');
    expect(stops).toMatch(/Context warning/);
    expect(stops).toMatch(/`hooks` package/);
    expect(stops).toContain('orchestrator loop <nr>');
  });

  it('pauses on interactive gates and skips the clear-before-implement question', () => {
    const section = reference.split('## Interactive gates')[1].split(/^## /m)[0];
    expect(section).toMatch(/continue the loop after the answer/);
    expect(section).toMatch(/Clear before implement/);
  });

  it('covers resume, compaction and the next end report', () => {
    expect(reference).toMatch(/Resuming loop #<nr>/);
    expect(reference).toMatch(/trust the loop ledger/);
    expect(reference).toContain('Ledger complete. Start the next issue in a new session');
  });

  it('is linked from the github-issue skill and the sibling references', () => {
    expect(skill).toContain('references/loop-mode.md');
    expect(skill.trimEnd().split('\n').length).toBeLessThanOrEqual(100);
    expect(gates).toMatch(/pauses the loop/);
    expect(gates).toMatch(/not asked in `loop`/);
    expect(selection).toContain('Exactly one PBI per run; `loop` repeats the selection per `loop-mode.md`.');
    expect(selection).toMatch(/first remaining candidate in sub-issue order/);
  });
});
