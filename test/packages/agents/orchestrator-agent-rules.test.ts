import * as fs from 'fs';
import * as path from 'path';

const agentPath = path.resolve(__dirname, '../../../packages/agents/.apm/agents/orchestrator.agent.md');
const body = fs.readFileSync(agentPath, 'utf-8').replace(/^---\n[\s\S]*?\n---\n/, '');
const pipelinePath = path.resolve(__dirname, '../../../packages/github/.apm/skills/github-issue/references/pbi-pipeline.md');
const pipelineRef = fs.readFileSync(pipelinePath, 'utf-8');
// steps 0-6 and the per-PBI rules moved to the reference; the body points to it
const lines = (body + '\n' + pipelineRef).split('\n');
const all = body + '\n' + pipelineRef;

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
    expect(pipelineRef).toMatch(/`pr-writer` sonnet/);
  });

  it('dispatches step 1 to issue-reader and keeps only its JSON', () => {
    const step1 = lines.find((l) => /^1\.\s/.test(l));
    expect(step1).toBeDefined();
    expect(step1).toContain('`issue-reader`');
    expect(step1).toMatch(/\{issue, type, title, digest, file, branch, bug, parent, tasks:\[\{n, state, merged, sha\}\], ledger\}/);
    expect(step1).toContain('`.agents/<issue>/issue.md`');
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
    expect(pipelineRef).toMatch(/`issue-reader` haiku/);
  });

  it('body points to the pipeline reference and the reference keeps every step and gate list', () => {
    expect(body).toContain('`github-issue` `references/pbi-pipeline.md`');
    for (const n of [0, 1, 2, 3, 4, 5, 6]) expect(pipelineRef).toMatch(new RegExp(`^${n}\\.\\s`, 'm'));
    for (const phrase of ['Model per dispatch', 'Same-issue ledger exists', '## Gate points', 'Red suite twice', 'CHANGES_REQUESTED', 'NEEDS_CONTEXT', 'Plan gate', 'Review summary'])
      expect(pipelineRef).toContain(phrase);
    expect(body).not.toMatch(/^\d\.\s/m);
  });

  it('lists review-lead among the dispatchable subagents on sonnet', () => {
    expect(body).toMatch(/subagent_type: [^)]*review-lead/);
    expect(body).toMatch(/`review-lead` in step 5/);
    expect(pipelineRef).toMatch(/`review-lead` sonnet/);
  });

  it('does not claim every phase runs in a subagent', () => {
    expect(body).not.toMatch(/every phase runs in a subagent/i);
  });

  it('lists exactly the six gate points in the reference and routes runner gates through Gate: lines', () => {
    const section = pipelineRef.split('## Gate points')[1].split(/\n## /)[0];
    const items = section.split('\n').filter((l) => /^\d+\.\s/.test(l));
    expect(items).toHaveLength(6);
    expect(items[0]).toMatch(/^1\. Plan gate \(step 3\)/);
    expect(items[1]).toMatch(/^2\. Review summary \(step 5\).*--fix-advisories/);
    expect(items[2]).toMatch(/^3\. `CHANGES_REQUESTED` still blocked after fix round 3/);
    expect(items[3]).toMatch(/^4\. Red suite twice/);
    expect(items[4]).toMatch(/^5\. `NEEDS_CONTEXT` from a bug implementer/);
    expect(items[5]).toMatch(/^6\. .*append `Gate: <question>`/);
    expect(section).toMatch(/runner appends `Gate: <question>` for every item above/);
  });

  it('allows pbi-runner as the one nested-subagent exception', () => {
    expect(body).toMatch(/subagent_type: [^)]*pbi-runner/);
    expect(body).toMatch(/except `pbi-runner` in loop runner mode/);
    expect(body).toMatch(/`pr-writer` or `pbi-runner` instead/);
  });
});
