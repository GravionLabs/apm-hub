import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../../packages');
const skillDir = path.join(root, 'delivery/.apm/skills/issue-planning');
const read = (p: string) => fs.readFileSync(p, 'utf-8');

describe('grilling reference', () => {
  const grilling = read(path.join(skillDir, 'references/grilling.md'));
  const schema = read(path.join(skillDir, 'references/plan-schema.md'));
  const publish = read(path.join(skillDir, 'references/publish.md'));
  const json = read(path.join(skillDir, 'references/plan.schema.json'));
  const skill = read(path.join(skillDir, 'SKILL.md'));
  const orchestrator = read(path.join(root, 'agents/.apm/agents/orchestrator.agent.md')) + read(path.join(root, 'github/.apm/skills/github-issue/references/pbi-pipeline.md'));

  it('attributes mattpocock/skills under MIT', () => {
    expect(grilling).toContain('mattpocock/skills');
    expect(grilling).toMatch(/MIT License, Copyright \(c\) Matt Pocock/);
  });

  it.each(['AskUserQuestion', 'Gate:', 'Ruling:', 'publish.md', '.agents/<issue>/progress.md'])(
    'covers %s',
    (term) => expect(grilling).toContain(term),
  );

  it('asks one round of all unanswered questions, at most 4 per AskUserQuestion call', () => {
    expect(grilling).toMatch(/round is all unanswered questions/);
    expect(grilling).toMatch(/at most 4 questions per call/);
  });

  it('never asks facts of the user', () => {
    expect(grilling).toMatch(/Facts are never asked/);
    expect(grilling).toMatch(/repo can answer goes to `explorer` or `planner`/);
  });

  it('runs a final approval round before publish, also with zero questions', () => {
    expect(grilling).toMatch(/final round[^\n]*approves `plan\.md`/);
    expect(grilling).toMatch(/zero questions[^\n]*still runs/);
    expect(grilling).toMatch(/final round[\s\S]*Only then run `publish\.md`/);
  });

  it('defines who edits plan.json and when planner is re-dispatched', () => {
    expect(grilling).toMatch(/orchestrator then edits `plan\.json`/);
    expect(grilling).toMatch(/Re-dispatch `planner` only when an answer changes item structure/);
    expect(skill).toMatch(/Answers given in the prompt are final/);
  });

  it('wires the deferred state through grilling, plan-schema, json schema and publish', () => {
    expect(grilling).toContain('deferred: true');
    expect(schema).toContain('deferred: true');
    expect(schema).toMatch(/answered, dropped or deferred/);
    expect(json).toContain('"deferred"');
    expect(publish).toMatch(/answered, dropped or deferred/);
    expect(publish).toContain('needs-decision');
    expect(publish).toContain('Owner decision required');
  });

  it('hardens deferral: non-empty blocks, label creation, independent questions', () => {
    expect(schema).toMatch(/`blocks` must be non-empty/);
    expect(grilling).toMatch(/Offer "defer" only for a question with non-empty `blocks`/);
    expect(grilling).toMatch(/no question-to-question dependency/);
    expect(grilling).toMatch(/deferred questions back in the prompt[^\n]*keep `deferred: true`/);
    expect(publish).toMatch(/gh label create needs-decision --force/);
    expect(publish.indexOf('gh label create')).toBeLessThan(publish.indexOf('gh issue create'));
  });

  it('is referenced by issue-planning and the orchestrator', () => {
    expect(skill).toContain('references/grilling.md');
    expect(orchestrator).toMatch(/\*\*Plan\*\*[^\n]*references\/grilling\.md[^\n]*references\/publish\.md/);
  });
});
