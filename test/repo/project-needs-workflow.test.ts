import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const file = path.resolve(__dirname, '../../.github/workflows/project-needs.yml');
const text = fs.readFileSync(file, 'utf-8');
const wf = parse(text);
type Step = { uses?: string; run?: string; env?: Record<string, string> };
describe('project-needs.yml (#639)', () => {
  const job = wf.jobs.needs;

  it('has only the hourly schedule and workflow_dispatch triggers', () => {
    expect(Object.keys(wf.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
    expect(wf.on.schedule).toEqual([{ cron: '0 * * * *' }]);
  });

  it('grants nothing at top level and issues: write to the job', () => {
    expect(wf.permissions).toEqual({});
    expect(job.permissions).toEqual({ issues: 'write' });
    expect(text).not.toContain('continue-on-error');
  });

  it('calls issues.yml of GravionLabs/ci with a full needs sync and has no steps', () => {
    expect(job.uses).toBe('GravionLabs/ci/.github/workflows/issues.yml@main');
    expect(job.with['project-url']).toBe('https://github.com/users/GravionLabs/projects/17');
    expect(job.with.needs).toBe(true);
    expect(job.with.mode).toBe('full');
    expect(job.steps).toBeUndefined();
  });

  it('passes the two secrets explicitly instead of inheriting', () => {
    expect(job.secrets).toEqual({
      GH_PAT: '${{ secrets.GH_PAT }}',
      PROJECT_TOKEN: '${{ secrets.PROJECT_TOKEN }}',
    });
  });
});

const tplDir = path.resolve(
  __dirname,
  '../../packages/github/.apm/skills/github-project/templates'
);
type SyncStep = Step & { name?: string; if?: string; 'continue-on-error'?: boolean };

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
