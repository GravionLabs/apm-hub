import * as fs from 'fs';
import * as path from 'path';

const agentPath = path.resolve(__dirname, '../../packages/agents/.apm/agents/pbi-runner.agent.md');
const source = fs.readFileSync(agentPath, 'utf-8');
const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)![1];
const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');

describe('pbi-runner agent contract', () => {
  it('runs on sonnet with a subagent-safe tool set and no question tool', () => {
    expect(frontmatter).toContain('name: pbi-runner');
    expect(frontmatter).toContain('model: sonnet');
    expect(frontmatter).toContain('model: anthropic/claude-sonnet-5-5');
    expect(frontmatter).toContain('tools: [Agent, Read, Grep, Glob, Bash, Skill, SendMessage]');
    expect(frontmatter).toContain('mode: subagent');
    expect(frontmatter).toContain('user-invocable: false');
    expect(frontmatter).not.toMatch(/AskUserQuestion|question: allow/);
    expect(frontmatter).toContain('edit: deny');
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
    expect(body).toContain('.agents/<pbi>/progress.md');
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
      'final verify opus',
      'implementer` sonnet',
      'fix round 3 opus',
      'reviewer` sonnet',
      'pr-writer` sonnet',
    ]) {
      expect(body).toContain(m);
    }
    expect(body).toMatch(/never omitted and never inherited/);
  });

  it('refuses to run as a primary agent and points to the orchestrator', () => {
    expect(body).toMatch(/Started at top level[^\n]*stop and point to `orchestrator`/);
  });
});
