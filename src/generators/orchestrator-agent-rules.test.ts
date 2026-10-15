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

  it('dispatches step 1 to issue-reader and keeps only its JSON', () => {
    const step1 = lines.find((l) => /^1\.\s/.test(l));
    expect(step1).toBeDefined();
    expect(step1).toContain('`issue-reader`');
    expect(step1).toMatch(/\{issue, type, title, digest, branch, bug, parent, tasks:\[\{n, state, merged, sha\}\], ledger\}/);
    expect(step1).toMatch(/\{error\}/);
    expect(step1).toMatch(/`merged: true` and `state: open` close it/);
    expect(step1).toMatch(/`null` or `stale: true` → cut one with `github-release`/);
    expect(step1).toContain('`ledger: resume`');
    expect(step1).not.toContain('gh issue view');
    expect(step1).not.toContain('sub_issues');
    expect(step1).not.toContain('release-branches.md');
  });

  it('runs no inline issue query anywhere in the pipeline', () => {
    const pipeline = lines.filter((l) => /^\d\.\s/.test(l)).join('\n');
    expect(pipeline).not.toMatch(/gh issue view/);
    expect(pipeline).not.toMatch(/gh api/);
  });

  it('uses the reader in branch-only mode for description input', () => {
    const para = lines.find((l) => l.startsWith('Description input'));
    expect(para).toBeDefined();
    expect(para).toContain('`issue-reader`');
    expect(para).toMatch(/branch-only/);
  });

  it('lists issue-reader among the dispatchable subagents on haiku', () => {
    expect(body).toMatch(/subagent_type: [^)]*issue-reader/);
    expect(body).toMatch(/`issue-reader` haiku/);
  });

  it('does not claim every phase runs in a subagent', () => {
    expect(body).not.toMatch(/every phase runs in a subagent/i);
  });
});
