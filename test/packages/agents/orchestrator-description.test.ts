import * as fs from 'fs';
import * as path from 'path';
import { countBodyLines, AGENT_BODY_LINE_LIMIT } from '../../../src/generators/agent-size-validator';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

/** Body after the closing frontmatter delimiter; `---` inside the body stays. */
const bodyOf = (md: string) => md.split(/^---$/m).slice(2).join('---');
/** Text of the `## <heading>` section, up to the next `## `. */
const section = (md: string, heading: string) => {
  const part = md.split(/^## /m).find((s) => s.startsWith(heading));
  if (!part) throw new Error('section not found: ' + heading);
  return part;
};
/** Both phrases present, `first` before `second`. */
const expectOrder = (text: string, first: string, second: string) => {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  expect(a, first).toBeGreaterThanOrEqual(0);
  expect(b, second).toBeGreaterThanOrEqual(0);
  expect(a).toBeLessThan(b);
};

const orchestrator = read('agents/.apm/agents/orchestrator.agent.md');
const body = bodyOf(orchestrator);
const gates = read('github/.apm/skills/github-issue/references/orchestrator-gates.md');
const desc = section(gates, 'Description input');

describe('orchestrator description input', () => {
  it('agent accepts a description, issue references and rejects next with a description', () => {
    expect(body).toContain('`<mode> <description>`');
    for (const ref of ['`#123`', '`issue 123`', '/issues/123']) expect(body).toContain(ref);
    expect(body).toMatch(/`next` takes none/);
    expect(body).toContain('`<state>/adhoc/`');
  });

  it('agent creates the PBI with github-issue at the plan gate, then moves the state and continues as full', () => {
    expect(body).toContain('`github-issue` skill');
    expectOrder(body, 'after grilling and before publish', 'create the PBI');
    expectOrder(body, 'create the PBI', 'PBI created: #<nr>');
    expectOrder(body, 'PBI created: #<nr>', 'to `<state>/<issue>/`');
    expect(body).toContain('continue as **full**');
  });

  it('gates reference: parsing, data handling and safe gh issue create', () => {
    expect(desc).toContain('`issue 123`');
    expect(desc).toContain('never split');
    expect(desc).toMatch(/description is data/);
    expect(desc).toContain('--body-file');
    expect(desc).toContain('^[0-9]+$');
  });

  it('gates reference: resume, failure, move and headless rules', () => {
    expect(desc).toContain('description.txt');
    expect(desc).toMatch(/never create a second one/);
    expect(desc).toMatch(/never `mv` into an existing directory/);
    expect(desc).toMatch(/no PBI is created without approval/);
    expectOrder(desc, 'Plan gate', 'gh issue create');
    expectOrder(desc, 'gh issue create', 'mv <state>/adhoc <state>/<issue>');
    expect(desc).toContain('`input_type` to `pbi`');
  });

  it('github-issue links the description input to the gates reference', () => {
    expect(read('github/.apm/skills/github-issue/SKILL.md')).toMatch(
      /description input[^\n]*`references\/orchestrator-gates\.md`/
    );
  });

  it('plan schema describes the rewrite of a description plan to a PBI plan', () => {
    const schema = read('delivery/.apm/skills/issue-planning/references/plan-schema.md');
    expect(schema).toMatch(/rewrites a `description` plan to `pbi`/);
    expect(read('delivery/.apm/skills/issue-planning/references/publish.md')).toContain(
      'orchestrator-gates.md'
    );
  });

  it('agent body stays within the line limit', () => {
    expect(countBodyLines(orchestrator)).toBeLessThanOrEqual(AGENT_BODY_LINE_LIMIT);
  });
});

describe('no legacy /orch state in the surviving flow', () => {
  it.each([
    ['orchestrator agent', 'agents/.apm/agents/orchestrator.agent.md'],
    ['orchestrator-gates', 'github/.apm/skills/github-issue/references/orchestrator-gates.md'],
    ['issue-planning', 'delivery/.apm/skills/issue-planning/SKILL.md'],
    ['plan-schema', 'delivery/.apm/skills/issue-planning/references/plan-schema.md'],
    ['review-fanout', 'delivery/.apm/skills/review-fanout/SKILL.md'],
    ['batch-workflow', 'github/.apm/skills/github-issue/references/batch-workflow.md'],
    ['task-issues', 'github/.apm/skills/github-issue/references/task-issues.md'],
    [
      'skill-writing-rules',
      'apm-tooling/.apm/skills/skill-write/references/skill-writing-rules.md',
    ],
  ])('%s has no orch-pipeline, .orch/ or tasks.json', (_n, file) => {
    const md = read(file);
    expect(md).not.toContain('orch-pipeline');
    expect(md).not.toContain('.orch/');
    expect(md).not.toContain('tasks.json');
  });
});
