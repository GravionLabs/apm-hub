import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const file = path.resolve(__dirname, '../../.github/workflows/project-needs.yml');
const text = fs.readFileSync(file, 'utf-8');
const wf = parse(text);
type Step = { uses?: string; run?: string; env?: Record<string, string> };
const steps: Step[] = wf.jobs['sync-needs'].steps;
const sync = steps.find((s) => s.run)!;

describe('project-needs.yml (#639)', () => {
  it('has the four trigger sets with their types', () => {
    expect(wf.on.issues.types).toEqual(['labeled', 'unlabeled', 'closed', 'reopened']);
    expect(wf.on.pull_request_target.types).toEqual(['opened', 'closed', 'ready_for_review']);
    expect(wf.on.schedule).toEqual([{ cron: '0 * * * *' }]);
    expect(Object.keys(wf.on)).toContain('workflow_dispatch');
  });

  it('grants read-only contents and does not use continue-on-error', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
    expect(text).not.toContain('continue-on-error');
  });

  it('cancels superseded runs per issue or PR only', () => {
    expect(wf.concurrency['cancel-in-progress']).toBe(true);
    expect(wf.concurrency.group).toContain('github.event.issue.number');
    expect(wf.concurrency.group).toContain('github.event.pull_request.number');
    expect(wf.concurrency.group).toContain('github.event_name');
  });

  it('pins every action to a commit SHA', () => {
    const uses = steps.filter((s) => s.uses).map((s) => s.uses as string);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}( |$)/);
  });

  it('runs Sync-ProjectNeeds.ps1 with PROJECT_TOKEN falling back to GH_PAT', () => {
    expect(sync.run).toContain(
      'packages/github/.apm/skills/github-project/scripts/Sync-ProjectNeeds.ps1'
    );
    expect(sync.env?.GH_TOKEN).toBe('${{ secrets.PROJECT_TOKEN || secrets.GH_PAT }}');
    expect(
      fs.existsSync(
        path.resolve(
          __dirname,
          '../../packages/github/.apm/skills/github-project/scripts/Sync-ProjectNeeds.ps1'
        )
      )
    ).toBe(true);
  });

  it('warns and exits 0 on an empty token', () => {
    expect(sync.run).toMatch(
      /if \(-not \$env:GH_TOKEN\) \{\s*Write-Host '::warning::[^']*'\s*exit 0\s*\}/
    );
  });

  it('syncs the issue with parents on issue events and the head-ref issue on PR events', () => {
    expect(sync.run).toContain('$syncArgs.Issue = $env:ISSUE_NUMBER');
    expect(sync.run).toContain('$syncArgs.IncludeParents = $true');
    // dependents only on issue events (until #519), never on the pull_request_target branch
    const [issuesBranch, prBranch] = sync.run!.split('} elseif');
    expect(issuesBranch).toContain('$syncArgs.IncludeDependents = $true');
    expect(prBranch).not.toContain('IncludeDependents');
    expect(sync.run).toContain('#519');
    // a named hashtable splat; an array would bind '-Repo' positionally to -Owner
    expect(sync.run).toContain('$syncArgs = @{ Repo = $env:GH_REPO }');
    expect(sync.run).not.toMatch(/\$syncArgs\s*\+?=\s*@\('-/);
    expect(sync.run).toContain('(^|/)(\\d+)-');
    expect(sync.run).toContain('::notice::');
    expect(sync.env?.HEAD_REF).toBe('${{ github.event.pull_request.head.ref }}');
    // head ref is only read through env, never interpolated into the script
    expect(sync.run).not.toContain('${{');
  });
});
