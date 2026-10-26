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

const wfDir = path.resolve(__dirname, '../../.github/workflows');
const tplDir = path.resolve(
  __dirname,
  '../../packages/github/.apm/skills/github-project/templates'
);
type SyncStep = Step & { name?: string; if?: string; 'continue-on-error'?: boolean };

describe.each([
  ['project-needs.yml', path.join(wfDir, 'project-needs.yml'), 'sync-needs', 'Sync Needs'],
  ['add-to-project.yml', path.join(wfDir, 'add-to-project.yml'), 'add-to-project', 'Sync Needs'],
  [
    'release-pr.yml',
    path.join(wfDir, 'release-pr.yml'),
    'release-pr',
    'Sync Needs of In release issues',
  ],
])('Needs sync wiring in %s (#626)', (_name, file, job, stepName) => {
  const w = parse(fs.readFileSync(file, 'utf-8'));
  const all: SyncStep[] = w.jobs[job].steps;
  const step = all.find((s) => s.name === stepName)!;

  it('runs Sync-ProjectNeeds.ps1 with PROJECT_TOKEN falling back to GH_PAT', () => {
    expect(step.run).toContain(
      'packages/github/.apm/skills/github-project/scripts/Sync-ProjectNeeds.ps1'
    );
    expect(step.env?.GH_TOKEN).toBe('${{ secrets.PROJECT_TOKEN || secrets.GH_PAT }}');
  });

  it('warns and exits 0 on an empty token', () => {
    expect(step.run).toMatch(
      /if \(-not \$env:GH_TOKEN\) \{\s*Write-Host '::warning::[^']*'\s*exit 0\s*\}/
    );
  });

  it('passes a hashtable splat with the parents and no expression in run', () => {
    expect(step.run).toContain('$syncArgs = @{ Repo = $env:GH_REPO');
    expect(step.run).toContain('IncludeParents = $true');
    expect(step.run).toContain('& $script @syncArgs');
    expect(step.run).not.toContain('${{');
  });

  it('pins every action to a commit SHA except GravionLabs/ci@main', () => {
    for (const s of all.filter((x) => x.uses)) {
      if (s.uses!.startsWith('GravionLabs/ci/')) expect(s.uses).toMatch(/@main$/);
      else expect(s.uses).toMatch(/@[0-9a-f]{40}( |$)/);
    }
  });
});

describe('add-to-project.yml Needs sync (#626)', () => {
  const w = parse(fs.readFileSync(path.join(wfDir, 'add-to-project.yml'), 'utf-8'));
  const all: SyncStep[] = w.jobs['add-to-project'].steps;
  const idx = all.findIndex((s) => s.name === 'Sync Needs');

  it('syncs after actions/add-to-project, on issue events only, without failing the job', () => {
    expect(all.findIndex((s) => s.uses?.startsWith('actions/add-to-project@'))).toBeLessThan(idx);
    expect(all[idx].if).toBe("github.event_name == 'issues'");
    // the checkout (default branch, never PR code) carries the same gate as the step that needs it
    const co = all.find((s) => s.uses?.startsWith('actions/checkout@'))!;
    expect(all.indexOf(co)).toBeLessThan(idx);
    expect(co.if).toBe("github.event_name == 'issues'");
    expect(all[idx]['continue-on-error']).toBe(true);
    expect(all[idx].env?.ISSUE_NUMBER).toBe('${{ github.event.issue.number }}');
  });

  it('reads contents only', () => {
    expect(w.permissions).toEqual({ contents: 'read' });
  });
});

describe('release-pr.yml Needs sync (#626)', () => {
  const w = parse(fs.readFileSync(path.join(wfDir, 'release-pr.yml'), 'utf-8'));
  const all: SyncStep[] = w.jobs['release-pr'].steps;
  const step = all.find((s) => s.name === 'Sync Needs of In release issues')!;

  it('skips without the script so the copied template is a no-op', () => {
    expect(step.run).toMatch(/if \(-not \(Test-Path \$script\)\) \{\s*Write-Host '::notice::/);
    const co = all.find((s) => s.uses?.startsWith('actions/checkout@'))!;
    expect(all.indexOf(co)).toBeLessThan(all.indexOf(step));
    expect(co.if).toBe("${{ !cancelled() && steps.in-release.outputs.issues != '' }}");
    expect(step.if).toBe(co.if);
    expect(step.run).toContain("Issue = ($env:ISSUES -split '\\s+' | Where-Object { $_ })");
  });

  it('receives the issues set by the In release step', () => {
    expect(step.env?.ISSUES).toBe('${{ steps.in-release.outputs.issues }}');
  });
});

describe('templates/project-needs.yml wiring (#626)', () => {
  const text = fs.readFileSync(path.join(tplDir, 'project-needs.yml'), 'utf-8');
  const w = parse(text);
  const all: SyncStep[] = w.jobs['sync-needs'].steps;
  const step = all.find((s) => s.run)!;

  it('uses the token placeholder, sparse-checks out apm-hub and passes Owner and Number', () => {
    expect(step.env?.GH_TOKEN).toBe('${{ secrets.__TOKEN__ }}');
    expect(step.run).toContain(
      '.apm-hub/packages/github/.apm/skills/github-project/scripts/Sync-ProjectNeeds.ps1'
    );
    expect(step.run).toMatch(
      /\$syncArgs = @\{ Owner = '__OWNER__'; Number = __PROJECT_NUMBER__; Repo = /
    );
    expect(step.run).toMatch(
      /if \(-not \$env:GH_TOKEN\) \{\s*Write-Host '::warning::[^']*'\s*exit 0\s*\}/
    );
    expect(step.run).not.toContain('${{');
    const co = all.find((s) => s.uses?.startsWith('actions/checkout@')) as SyncStep & {
      with?: Record<string, string>;
    };
    expect(co.uses).toMatch(/@[0-9a-f]{40}( |$)/);
    expect(co.with).toMatchObject({
      repository: 'GravionLabs/apm-hub',
      ref: 'main',
      path: '.apm-hub',
    });
  });
});
