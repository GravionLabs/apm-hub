import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf-8');
const prSkill = read('packages/github/.apm/skills/github-pull-request/SKILL.md');
const prWriter = read('packages/agents/.apm/agents/pr-writer.agent.md');
const pipeline = read('packages/github/.apm/skills/github-issue/references/pbi-pipeline.md');
const step = (n: number) => pipeline.split('\n').find((l) => new RegExp(`^${n}\\.\\s`).test(l))!;

// #481: declined and deferred findings reach the PR body without closing or keeping the PBI open
describe('finding rulings', () => {
  it('step 5 records rulings.json and the Ruling line', () => {
    expect(step(5)).toMatch(/`<state>\/<pbi>\/rulings\.json`/);
    expect(step(5)).toMatch(/`fixed\|declined\|deferred`/);
    expect(step(5)).toMatch(/`Ruling: <n> declined, <k> deferred findings`/);
  });

  it('step 6 passes declined and deferred findings to pr-writer and keeps Closes', () => {
    expect(step(6)).toMatch(
      /declined findings \(with reason\) and the deferred findings \(with need\)/
    );
    expect(step(6)).toMatch(/deferred findings are not acceptance criteria and keep `Closes`/);
  });

  it('pr-writer and github-pull-request name both sections', () => {
    expect(prSkill).toContain('## Advisories not fixed');
    expect(prSkill).toContain('## Follow-up candidates');
    // pr-writer passes the inputs; the sections are defined once, in the skill
    expect(prWriter).toContain('`advisories_not_fixed`');
    expect(prWriter).toContain('`follow_up_candidates`');
    expect(prWriter).not.toContain('## Follow-up candidates');
    expect(prSkill).toContain('--body-file');
    expect(prWriter).toMatch(/deferred findings alone keep `Closes`/);
    expect(prSkill).toMatch(/never turn `Closes` into `Refs`/);
    expect(prSkill).toContain('`advisories_not_fixed`');
    expect(prSkill).toContain('`follow_up_candidates`');
  });
});
