import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const root = path.resolve(__dirname, '../..');
const files = {
  workflow: '.github/workflows/release-pr.yml',
  template: 'packages/github/.apm/skills/github-release/templates/release-branch.yml',
};

describe.each(Object.entries(files))('merged-label %s (#358)', (_name, rel) => {
  const text = fs.readFileSync(path.join(root, rel), 'utf-8');
  const wf = parse(text);
  const steps = wf.jobs['release-pr'].steps as { uses: string; with: { token: string } }[];

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

describe('github-release skill (#358)', () => {
  it('cut checks for mark-merged-issues and never adds the template silently', () => {
    const skill = fs.readFileSync(path.join(root, 'packages/github/.apm/skills/github-release/SKILL.md'), 'utf-8');
    expect(skill).toContain('mark-merged-issues');
    expect(skill).toContain('never silently');
    expect(fs.existsSync(path.join(root, 'packages/github/.apm/skills/github-release/references/merged-label.md'))).toBe(true);
  });
});
