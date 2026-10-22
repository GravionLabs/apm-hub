import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const root = path.resolve(__dirname, '../../..');
const files = {
  workflow: '.github/workflows/release-pr.yml',
  template: 'packages/github/.apm/skills/github-release/templates/release-branch.yml',
};

describe.each(Object.entries(files))('merged-label %s (#358)', (_name, rel) => {
  const text = fs.readFileSync(path.join(root, rel), 'utf-8');
  const wf = parse(text);
  const allSteps = wf.jobs['release-pr'].steps as { uses?: string; with: { token: string } }[];
  const steps = allSteps.filter((s) => s.uses);

  it('is valid YAML triggered by release branches', () => {
    expect(wf.on.push.branches).toEqual(['release/**']);
  });

  it('grants issues: write and keeps the existing permissions', () => {
    expect(wf.permissions).toEqual({ contents: 'read', issues: 'write', 'pull-requests': 'write' });
  });

  it('runs release-pr then mark-merged-issues with the PAT fallback', () => {
    expect(steps.map((s) => s.uses)).toEqual([
      'GravionLabs/ci/versioning/release-pr@main',
      'GravionLabs/ci/versioning/mark-merged-issues@main',
    ]);
    for (const s of steps) expect(s.with.token).toBe('${{ secrets.GH_PAT || github.token }}');
  });
});

describe.each(Object.entries(files))('In release status step %s (#489)', (_name, rel) => {
  const wf = parse(fs.readFileSync(path.join(root, rel), 'utf-8'));
  const all = wf.jobs['release-pr'].steps as { uses?: string; id?: string; name?: string; run?: string; env?: Record<string, string>; if?: string; 'continue-on-error'?: boolean }[];
  const idx = all.findIndex((s) => s.id === 'in-release');
  const step = all[idx];

  it('is a run step after mark-merged-issues', () => {
    expect(idx).toBeGreaterThan(-1);
    expect(all[idx - 1].uses).toBe('GravionLabs/ci/versioning/mark-merged-issues@main');
    expect(step.uses).toBeUndefined();
    expect(step.name).toBe('Set project status In release');
  });

  it('never fails the job and reads PROJECT_TOKEN || GH_PAT', () => {
    expect(step['continue-on-error']).toBe(true);
    expect(step.env?.GH_TOKEN).toBe('${{ secrets.PROJECT_TOKEN || secrets.GH_PAT }}');
  });

  it('runs after earlier failures, with pipefail', () => {
    expect(step.if).toBe('${{ !cancelled() }}');
    expect(step.run).toMatch(/^set -o pipefail$/m);
  });
});

describe('release workflow and template stay identical (#489)', () => {
  it('are byte-identical', () => {
    const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf-8').replace(/\r\n/g, '\n');
    expect(read(files.workflow)).toBe(read(files.template));
  });
});

describe('In release status docs (#489)', () => {
  const read = (p: string) => fs.readFileSync(path.join(root, 'packages/github/.apm/skills', p), 'utf-8');

  it('merged-label.md documents PROJECT_TOKEN, scope project and the release/next limit', () => {
    const doc = read('github-release/references/merged-label.md');
    expect(doc).toMatch(/PROJECT_TOKEN/);
    expect(doc).toMatch(/scope `project`/);
    expect(doc).toMatch(/GH_PAT[\s\S]*read access to the repository/);
    expect(doc).not.toMatch(/only needs the project scope/);
    expect(doc).toMatch(/release\/next[\s\S]*GravionLabs\/ci#55/);
    expect(doc).toMatch(/Checked \d{4}-\d{2}-\d{2}: GravionLabs\/ci#55 is \w+/);
    expect(doc).toMatch(/gh issue view 55 -R GravionLabs\/ci/);
  });

  it('views.md no longer says CI never writes the project', () => {
    const doc = read('github-project/references/views.md');
    expect(doc).not.toMatch(/CI never writes/i);
    expect(doc).toMatch(/Set project status In release/);
  });
});

describe('github-release skill (#358)', () => {
  it('cut checks for mark-merged-issues and never adds the template silently', () => {
    const skill = fs.readFileSync(path.join(root, 'packages/github/.apm/skills/github-release/SKILL.md'), 'utf-8');
    expect(skill).toContain('mark-merged-issues');
    expect(skill).toContain('never silently');
    expect(fs.existsSync(path.join(root, 'packages/github/.apm/skills/github-release/references/merged-label.md'))).toBe(true);
  });
});

describe('github-release skill refuses a released branch (#252)', () => {
  const skill = fs.readFileSync(path.join(root, 'packages/github/.apm/skills/github-release/SKILL.md'), 'utf-8');
  const reference = fs.readFileSync(
    path.join(root, 'packages/github/.apm/skills/github-issue/references/release-branches.md'),
    'utf-8',
  );
  const section = (text: string, from: string, to: string) => {
    const start = text.indexOf(from);
    const end = text.indexOf(to, start + 1);
    if (start < 0 || end < 0) throw new Error(`marker missing: ${from} … ${to}`);
    return text.slice(start, end);
  };
  const cut = section(skill, '### 1. cut', '### 2. finish');
  const finish = section(skill, '### 2. finish', '## Gotchas');

  it('finish stops on the v<x.y>.0 tag and reports "already released; cut a new release branch"', () => {
    expect(finish).toContain('git ls-remote --tags origin "refs/tags/v<x.y>.0"');
    expect(finish).toContain('already released; cut a new release branch');
    expect(finish).toContain('git fetch origin --tags');
  });

  it('finish guards run merged → released → behind (a merged or continued branch is always behind <default>)', () => {
    const merged = finish.indexOf('git merge-base --is-ancestor HEAD origin/<default>');
    const released = finish.indexOf('git ls-remote --tags origin "refs/tags/v<x.y>.0"');
    const behind = finish.indexOf('git merge-base --is-ancestor origin/<default> HEAD');
    expect(merged).toBeGreaterThan(-1);
    expect(released).toBeGreaterThan(merged);
    expect(behind).toBeGreaterThan(released);
  });

  it('finish names the branch delete and deletes release/next once the merge is confirmed', () => {
    expect(finish).toContain('git push origin --delete <branch>');
    expect(finish).toContain('gh pr view <nr> --json merged');
    expect(finish).toContain('delete `release/next` yourself');
  });

  it('a later finish on the merged branch deletes release/next only for a merge-commit tip without open PRs', () => {
    expect(finish).toContain('git log --merges --first-parent origin/<default> --format=%P');
    expect(finish).toContain('`gh pr list --base <branch> --state open` is empty; deleting would close them');
    expect(finish).toContain('git push origin --delete release/next');
  });

  it('cut reports a stale release/<x.y> with the delete command before cutting', () => {
    expect(cut).toContain('git ls-remote --tags origin "refs/tags/v<x.y>.0"');
    expect(cut).toContain('stale');
    expect(cut).toContain('git push origin --delete release/<x.y>');
    expect(cut).toContain('guardrail');
    expect(skill).not.toContain('GIT_GUARDRAILS_OFF');
  });

  it('resolver step 4 ignores release branches whose .0 tag exists', () => {
    const step4 = section(reference, '4. `release/next` on origin', '5. None exists');
    expect(step4).toContain('whose tag `v<x.y>.0` is not on origin');
    expect(step4).toContain('git ls-remote --tags origin');
    expect(reference).toContain('already released');
  });
});
