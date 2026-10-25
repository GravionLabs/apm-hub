import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { OPENCODE_MODEL_BY_TIER } from '../../../src/generators/agent-model-validator';

const agentPath = path.resolve(
  __dirname,
  '../../../packages/agents/.apm/agents/orchestrator.agent.md'
);
const body = fs.readFileSync(agentPath, 'utf-8').replace(/^---\n[\s\S]*?\n---\n/, '');
const pipelinePath = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-issue/references/pbi-pipeline.md'
);
const pipelineRef = fs.readFileSync(pipelinePath, 'utf-8');
// steps 0-6 and the per-PBI rules moved to the reference; the body points to it
const lines = (body + '\n' + pipelineRef).split('\n');
const all = body + '\n' + pipelineRef;

describe('orchestrator agent rules', () => {
  it('lists --advisory-rounds in the description and the flag list', () => {
    expect(fs.readFileSync(agentPath, 'utf-8')).toMatch(/description:.*--advisory-rounds/);
    expect(body).toContain('`--advisory-rounds <0-5>` (default 1');
  });

  it('never allows general-purpose for a phase', () => {
    const offenders: string[] = [];
    for (const line of lines) {
      for (const match of line.matchAll(/general-purpose/g)) {
        const before = line.slice(Math.max(0, match.index - 40), match.index);
        // the only exception: the Final-Verify command runner (verify-project in a forked general-purpose context)
        const verifyContext = line.slice(Math.max(0, match.index - 120), match.index);
        if (/verify-project/.test(verifyContext)) continue;
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
    expect(pipelineRef).toMatch(/`pr-writer` standard/);
  });

  it('dispatches step 1 to issue-reader and keeps only its JSON', () => {
    const step1 = lines.find((l) => /^1\.\s/.test(l));
    expect(step1).toBeDefined();
    expect(step1).toContain('`issue-reader`');
    expect(step1).toMatch(
      /\{issue, type, title, digest, file, branch, bug, parent, tasks:\[\{n, state, merged, sha\}\], ledger\}/
    );
    expect(step1).toContain('`<state>/<issue>/issue.md`');
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

  it('lists issue-reader among the dispatchable subagents at tier fast', () => {
    expect(body).toMatch(/subagent_type: [^)]*issue-reader/);
    expect(pipelineRef).toMatch(/`issue-reader` fast/);
  });

  it('body points to the pipeline reference and the reference keeps every step and gate list', () => {
    expect(body).toContain('`github-issue` `references/pbi-pipeline.md`');
    for (const n of [0, 1, 2, 3, 4, 5, 6])
      expect(pipelineRef).toMatch(new RegExp(`^${n}\\.\\s`, 'm'));
    for (const phrase of [
      'Model per dispatch',
      'Same-issue ledger exists',
      '## Gate points',
      'Red suite twice',
      'CHANGES_REQUESTED',
      'NEEDS_CONTEXT',
      'Plan gate',
      'Review summary',
    ])
      expect(pipelineRef).toContain(phrase);
    expect(body).not.toMatch(/^\d\.\s/m);
  });

  it('lists review-lead among the dispatchable subagents at tier standard', () => {
    expect(body).toMatch(/subagent_type: [^)]*review-lead/);
    expect(body).toMatch(/`review-lead` in step 5/);
    expect(pipelineRef).toMatch(/`review-lead` standard/);
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
    expect(items[2]).toMatch(/round 2 escalated one tier, round 3 resumed it once/);
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

describe('orchestrator model pins', () => {
  const agentsDir = path.resolve(__dirname, '../../../packages/agents/.apm/agents');
  const fm: any = parse(fs.readFileSync(agentPath, 'utf-8').match(/^---\n([\s\S]*?)\n---\n/)![1]);
  const rule = pipelineRef.split('\n').find((l) => l.startsWith('- Model per dispatch'))!;

  it('runs on sonnet in Claude and OpenCode', () => {
    expect(fm.metadata.claude.model).toBe('sonnet');
    expect(fm.metadata.opencode.model).toBe('anthropic/claude-sonnet-5-5');
  });

  it('no agent of the package inherits the session model', () => {
    for (const f of fs.readdirSync(agentsDir).filter((n) => n.endsWith('.agent.md'))) {
      expect(fs.readFileSync(path.join(agentsDir, f), 'utf-8'), f).not.toMatch(
        /^\s*model:\s*inherit\s*$/m
      );
    }
  });

  it('pins planner to opus in both clients', () => {
    const planner: any = parse(
      fs
        .readFileSync(path.join(agentsDir, 'planner.agent.md'), 'utf-8')
        .match(/^---\n([\s\S]*?)\n---\n/)![1]
    );
    expect(planner.metadata.claude.model).toBe('opus');
    expect(planner.metadata.opencode.model).toBe('anthropic/claude-opus-5-5');
  });

  it('every agent file pins explicit claude and opencode models of one tier', () => {
    const tiers = Object.entries(OPENCODE_MODEL_BY_TIER);
    for (const f of fs.readdirSync(agentsDir).filter((n) => n.endsWith('.agent.md'))) {
      const a: any = parse(
        fs.readFileSync(path.join(agentsDir, f), 'utf-8').match(/^---\n([\s\S]*?)\n---\n/)![1]
      );
      expect(['haiku', 'sonnet', 'opus'], f).toContain(a.metadata.claude.model);
      expect(a.metadata.opencode.model, f).toBe(
        OPENCODE_MODEL_BY_TIER[a.metadata.claude.model as keyof typeof OPENCODE_MODEL_BY_TIER]
      );
    }
    expect(tiers).toHaveLength(3);
  });

  it('per-dispatch rule pins every dispatch to a tier of model-policy.md and none to inherit', () => {
    expect(rule).toBeDefined();
    for (const pin of [
      '`issue-reader` fast',
      '`explorer` fast',
      'Final-Verify fast',
      '`planner` strong',
      "`implementer` the plan item's `tier`",
      '`review-lead` standard',
      '`reviewer` standard',
      '`pr-writer` standard',
      'fix round 2 one tier up',
    ]) {
      expect(rule, pin).toContain(pin);
    }
    expect(rule).toContain('references/model-policy.md');
    expect(rule).not.toMatch(/inherit`|`inherit/);
    expect(rule).not.toMatch(/\b(haiku|sonnet|opus)\b/);
    expect(rule).not.toMatch(
      /`[\w-]+`( and `[\w-]+`)*,? (to |defaults to |pinned to )?`?inherit\b/
    );
    expect(rule).not.toMatch(/(round 3|Final-Verify|final verify) (to )?inherit\b/);
    expect(rule).not.toMatch(/pass `inherit`/);
  });
});

describe('fix-round escalation (#251)', () => {
  const step5 = pipelineRef.split('\n').find((l) => l.startsWith('5. '))!;

  it('round 1 resumes, round 2 escalates one tier after a second blocking CHANGES_REQUESTED, round 3 resumes once', () => {
    expect(step5).toMatch(/round 1 resumes the same implementer/);
    expect(step5).toMatch(
      /round 2, the second `CHANGES_REQUESTED` with a blocking finding on the same task, dispatches a fresh implementer one tier up/
    );
    expect(step5).toMatch(
      /round 3 resumes that escalated implementer once; still blocked after round 3 → gate to the user/
    );
    expect(step5).toContain('`model-policy.md` "Escalation in the fix loop"');
  });

  it('never escalates for advisory-only rounds or DONE_WITH_CONCERNS', () => {
    expect(step5).toMatch(
      /Advisory-only rounds[^.]*`DONE_WITH_CONCERNS` reply resume the same implementer at its tier, never escalate/
    );
  });

  it('no longer escalates at round 3 or resumes rounds 1-2', () => {
    expect(step5).not.toMatch(/rounds 1[–-]2 resume/);
    expect(step5).not.toMatch(/round 3 a fresh implementer/);
  });

  it('the implementer gets the plan item tier, not a model hint', () => {
    const step4 = pipelineRef.split('\n').find((l) => l.startsWith('4. '))!;
    expect(step4).toContain("the plan item's `tier`");
    expect(step4).not.toContain('`model` hint');
    expect(pipelineRef).not.toMatch(/inherit`|`inherit/);
  });

  it('the fix-round ledger line records the escalated model', () => {
    expect(pipelineRef).toMatch(/at fix round 2 the escalated one so `retro` sees the escalation/);
  });
});
