import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');
const skillDir = 'delivery/.apm/skills/issue-planning';

describe('issue-planning invariants section (#484)', () => {
  const ref = read(`${skillDir}/references/invariants.md`);
  const skill = read(`${skillDir}/SKILL.md`);

  it('invariants.md holds the five checklist items', () => {
    expect(ref).toMatch(/atomic or compensated/);
    expect(ref).toMatch(/error or fallback handler leaves nothing in an intermediate state/);
    expect(ref).toMatch(/external process or network call has a timeout/);
    expect(ref).toMatch(/Background work can be awaited in tests/);
    expect(ref).toMatch(/background error is logged and mapped to a defined state/);
  });

  it('states the wording rule', () => {
    expect(ref).toMatch(/only the items that apply, each worded for that item/);
    expect(ref).toMatch(/never the generic list/);
  });

  it('SKILL.md step 5 names the trigger and loads the reference only then', () => {
    const step = skill.split('\n').find((l) => l.startsWith('5. '))!;
    expect(step).toMatch(/background\/async work, persistence or a state machine/);
    expect(step).toContain('references/invariants.md');
    expect(step).toMatch(/load it only then/);
  });

  it('SKILL.md stays within 100 lines', () => {
    expect(skill.trimEnd().split('\n').length).toBeLessThanOrEqual(100);
  });

  it('places the section before the Definition of Done for pbi and before the agent-ready block for task', () => {
    expect(ref).toMatch(/Level `pbi`:.*directly before `## Definition of Done`/);
    expect(ref).toMatch(/Level `task`:.*before `<!-- agent-ready:start -->`/);
    expect(ref).toMatch(/Single-task plan \(no Task issue\): the same position inside the single `plan.json` item `body`/);
  });

  it('plan-schema.md body row mentions the optional section on both levels', () => {
    const row = read(`${skillDir}/references/plan-schema.md`)
      .split('\n')
      .find((l) => l.startsWith('| `items[].body`'))!;
    expect(row).toContain('## Invariants');
    expect(row).toMatch(/before `## Definition of Done` for `pbi`/);
    expect(row).toMatch(/before the agent-ready block for `task`/);
  });

  it('task-issues.md template orders Implementation Notes, Invariants, agent-ready block', () => {
    const t = read('github/.apm/skills/github-issue/references/task-issues.md');
    const notes = t.indexOf('## Implementation Notes');
    const inv = t.indexOf('## Invariants');
    const block = t.indexOf('<!-- agent-ready:start -->');
    expect(notes).toBeGreaterThan(-1);
    expect(inv).toBeGreaterThan(notes);
    expect(block).toBeGreaterThan(inv);
  });
});
