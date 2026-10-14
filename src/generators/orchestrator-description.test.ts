import * as fs from 'fs';
import * as path from 'path';
import { countBodyLines, AGENT_BODY_LINE_LIMIT } from './agent-size-validator';

const pk = path.resolve(__dirname, '../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const orchestrator = read('agents/.apm/agents/orchestrator.agent.md');
const body = orchestrator.split(/^---$/m).slice(2).join('---');
const gates = read('github/.apm/skills/github-issue/references/orchestrator-gates.md');
const section = (md: string, heading: string) => {
  const part = md.split(/^## /m).find((s) => s.startsWith(heading));
  if (!part) throw new Error('section not found: ' + heading);
  return part;
};

describe('orchestrator description input', () => {
  it('agent accepts a description instead of an issue number', () => {
    expect(body).toContain('`<mode> <description>`');
    expect(body).toContain('not a number is a `<description>`');
    expect(body).toContain('`.agents/adhoc/`');
  });

  it('agent creates the PBI with github-issue at the plan gate, then moves the state and continues as full', () => {
    const p = body.indexOf('Description input');
    expect(p).toBeGreaterThanOrEqual(0);
    const para = body.slice(p, body.indexOf('\n', p));
    expect(para).toContain('create the PBI with the `github-issue` skill');
    expect(para.indexOf('after grilling and before publish')).toBeLessThan(para.indexOf('create the PBI'));
    expect(para).toContain('move `.agents/adhoc/` to `.agents/<issue>/`');
    expect(para).toContain('continue as **full**');
    expect(para).toContain('`plan` stops after the PBI and its plan');
  });

  it.each([
    ['agent', orchestrator],
    ['gates reference', gates],
  ])('%s has no legacy .orch/ state or tasks.json', (_n, md) => {
    expect(md).not.toContain('.orch/');
    expect(md).not.toContain('tasks.json');
    expect(md).not.toContain('/orch ');
  });

  it('gates reference documents the description path with orchestrator flags', () => {
    expect(gates.split('\n')[2]).toContain('orchestrator --no-review-summary plan "');
    expect(gates).toContain('a description takes the "Description input" path below');
    const desc = section(gates, 'Description input');
    expect(desc).toContain('.agents/adhoc/plan.json');
    expect(desc).toContain('`input_type: description`');
    expect(desc).toContain('mv .agents/adhoc .agents/<issue>');
    expect(desc).toContain('label `pbi`');
    expect(desc).toContain('no PBI is created without approval');
    expect(desc.indexOf('Plan gate')).toBeLessThan(desc.indexOf('mv .agents/adhoc'));
  });

  it('github-issue links the description input to the gates reference', () => {
    expect(read('github/.apm/skills/github-issue/SKILL.md')).toMatch(/description input[^\n]*`references\/orchestrator-gates\.md`/);
  });

  it('agent body stays within the line limit', () => {
    expect(countBodyLines(orchestrator)).toBeLessThanOrEqual(AGENT_BODY_LINE_LIMIT);
  });
});
