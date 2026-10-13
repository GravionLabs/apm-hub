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

  it('runs the pull request step inline in its own context', () => {
    const step6 = lines.find((l) => /^6\.\s/.test(l));
    expect(step6).toBeDefined();
    expect(step6).toContain('github-pull-request');
    expect(step6).toMatch(/own context|inline/i);
    expect(step6).toMatch(/no subagent/i);
  });

  it('does not claim every phase runs in a subagent', () => {
    expect(body).not.toMatch(/every phase runs in a subagent/i);
  });
});
