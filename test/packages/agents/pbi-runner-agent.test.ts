import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { MODEL_BY_TIER, type Tier } from '../../../src/generators/agent-model-validator';

const agentPath = path.resolve(
  __dirname,
  '../../../packages/agents/.apm/agents/pbi-runner.agent.md'
);
const source = fs.readFileSync(agentPath, 'utf-8');
const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)![1];
const fm: any = parse(frontmatter);
const pipelineRef = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../packages/github/.apm/skills/github-issue/references/pbi-pipeline.md'
  ),
  'utf-8'
);
const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');

describe('pbi-runner agent contract', () => {
  it('runs on sonnet with a subagent-safe tool set and no question tool', () => {
    expect(fm.name).toBe('pbi-runner');
    expect(fm['user-invocable']).toBe(false);
    expect(fm.metadata.claude.model).toBe('sonnet');
    expect(fm.metadata.claude.tools).toEqual([
      'Agent',
      'Read',
      'Grep',
      'Glob',
      'Bash',
      'Skill',
      'SendMessage',
    ]);
    expect(fm.metadata.opencode.model).toBe('anthropic/claude-sonnet-5-5');
    expect(fm.metadata.opencode.mode).toBe('subagent');
    expect(fm.metadata.opencode.permission.edit).toBe('deny');
    expect(fm.metadata.opencode.permission.question).toBeUndefined();
    expect(fm.metadata.claude.tools).not.toContain('AskUserQuestion');
    expect(fm.tools).not.toContain('edit');
  });

  it('returns the four statuses with their keys', () => {
    expect(body).toContain('"status": "GATE"');
    for (const key of ['"pbi"', '"phase"', '"question"', '"options"', '"pr"', '"summary"']) {
      expect(body).toContain(key);
    }
    expect(body).toContain('"DONE"|"BLOCKED"|"FAILED"');
    expect(body).toMatch(/<=15 lines/);
  });

  it('records the gate and ruling ledger lines and Ledger complete only on DONE', () => {
    expect(body).toContain('`Gate: <question>`');
    expect(body).toContain('<state>/<pbi>/progress.md');
    expect(body).toContain('`Ruling: <question> - user - <answer>`');
    expect(body).toMatch(/DONE: .*append `Ledger complete\.`/);
    expect(body).toMatch(/No `Ledger complete\.` on GATE, BLOCKED or FAILED/);
  });

  it('names a model on every dispatch and follows the pipeline reference', () => {
    expect(body).toContain('references/pbi-pipeline.md');
    for (const m of [
      'issue-reader` haiku',
      'explorer` haiku',
      'planner` opus',
      'final verify haiku',
      'implementer` sonnet',
      'fix round 2 opus',
      'review-lead` sonnet',
      'reviewer` sonnet',
      'pr-writer` sonnet',
    ]) {
      expect(body).toContain(m);
    }
    expect(body).toMatch(/never omitted and never inherited/);
    expect(body).toContain('model-policy.md');
    expect(body).not.toMatch(/inherit`|`inherit/);
  });

  it('escalates at fix round 2 only, round 3 resumes the escalated implementer', () => {
    const rule2 = body.split('\n').find((l) => l.startsWith('2. '))!;
    expect(rule2).toMatch(
      /fix round 2 opus \(a fresh implementer one tier up after the second blocking `CHANGES_REQUESTED` on the same task\)/
    );
    expect(rule2).toMatch(/round 3 resumes the escalated one once/);
    expect(rule2).toMatch(/advisory-only rounds and `DONE_WITH_CONCERNS` resume, never escalate/);
    expect(rule2).not.toMatch(/fix round 3 opus|Fix rounds 1-2/);
  });

  // `name model` pairs of rule 2 (runner) and of the pin sentence in the reference
  const pins = (text: string) => {
    const out: Record<string, string> = {};
    for (const m of text.matchAll(
      /(?:`(issue-reader|explorer|planner|implementer|review-lead|reviewer|pr-writer)`|(final verify|fix round 2)) (haiku|sonnet|opus)/g
    )) {
      out[m[1] ?? m[2]] = m[3];
    }
    return out;
  };

  it('names a model for every subagent it dispatches', () => {
    const rule2 = body.split('\n').find((l) => l.startsWith('2. '))!;
    const dispatched = [
      'issue-reader',
      'explorer',
      'planner',
      'implementer',
      'review-lead',
      'reviewer',
      'pr-writer',
      'final verify',
      'fix round 2',
    ];
    expect(Object.keys(pins(rule2)).sort()).toEqual([...dispatched].sort());
  });

  it('agrees with the pins stated in pbi-pipeline.md', () => {
    const rule2 = body.split('\n').find((l) => l.startsWith('2. '))!;
    const sentence = pipelineRef.match(/pins `planner`[^.]*\./)![0];
    const refPins: Record<string, string> = {};
    // each name takes the tier of the next "to <tier>" after it; the runner states that tier's Claude model
    for (const m of sentence.matchAll(
      /`(issue-reader|explorer|planner|implementer|review-lead|reviewer|pr-writer)`|final verify|fix round 2/g
    )) {
      const tier = sentence.slice(m.index).match(/ to (fast|standard|strong)\b/)![1] as Tier;
      refPins[m[1] ?? m[0]] = MODEL_BY_TIER.claude[tier];
    }
    const runner = pins(rule2);
    for (const [k, v] of Object.entries(refPins)) expect(runner[k]).toBe(v);
    expect(Object.keys(refPins)).toHaveLength(9);
  });

  it('asks nothing for deferred findings and only records the Ruling', () => {
    expect(body).toContain(
      'follow-up PBI question for deferred findings is not a runner gate: ask nothing'
    );
    expect(body).toContain('`Ruling: <k> deferred findings — follow-up candidates in PR body`');
  });

  it('maps reader and pr-writer errors to FAILED and leaves a headless gate unresumed', () => {
    expect(body).toMatch(/`issue-reader` returned `\{error\}`/);
    expect(body).toMatch(/`pr-writer` failed again after its one retry/);
    expect(body).toMatch(/without exception: append `Gate: <question>`/);
    expect(body).toMatch(/never resumes you/);
  });

  it('refuses to run as a primary agent and points to the orchestrator', () => {
    expect(body).toMatch(/Started at top level[^\n]*stop and point to `orchestrator`/);
  });
});

describe('pbi-runner flags input', () => {
  it('lists --advisory-rounds among the forwarded flags', () => {
    expect(source).toContain('`--advisory-rounds <n>`');
  });
});
