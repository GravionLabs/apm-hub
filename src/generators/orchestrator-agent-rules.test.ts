import * as fs from 'fs';
import * as path from 'path';

const agentPath = path.resolve(__dirname, '../../packages/agents/.apm/agents/orchestrator.agent.md');
const body = fs.readFileSync(agentPath, 'utf-8').replace(/^---\n[\s\S]*?\n---\n/, '');
const lines = body.split('\n');

describe('orchestrator agent rules', () => {
  it('never allows general-purpose for a phase', () => {
    const offenders: string[] = [];
    for (const line of lines) {
      for (const match of line.matchAll(/general-purpose/g)) {
        const before = line.slice(Math.max(0, match.index - 40), match.index);
        if (!/\b(never|not|no)\b/i.test(before)) offenders.push(line.trim().slice(0, 120));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('states the general-purpose prohibition explicitly', () => {
    expect(body).toMatch(/(never|not)[^.\n]{0,40}`general-purpose`/i);
  });

  it('dispatches the pull request step to pr-writer and keeps only its JSON', () => {
    const step6 = lines.find((l) => /^6\.\s/.test(l));
    expect(step6).toBeDefined();
    expect(step6).toContain('`pr-writer`');
    expect(step6).toContain('github-pull-request');
    expect(step6).toMatch(/\{number, url\}/);
    expect(step6).not.toMatch(/inline|no subagent/i);
  });

  it('lists pr-writer among the dispatchable subagents with a model', () => {
    expect(body).toMatch(/subagent_type: [^)]*pr-writer/);
    expect(body).toMatch(/`pr-writer` sonnet/);
  });

  it('does not claim every phase runs in a subagent', () => {
    expect(body).not.toMatch(/every phase runs in a subagent/i);
  });
});
