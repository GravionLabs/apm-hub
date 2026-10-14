import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const file = path.resolve(__dirname, '../../.github/workflows/pages.yml');
const text = fs.readFileSync(file, 'utf-8');
const wf = parse(text);

describe('pages.yml workflow guard (#272)', () => {
  it('pins every action to a 40-hex SHA followed by a comment', () => {
    const uses = text.split('\n').filter((l) => /^\s*-?\s*uses:/.test(l));
    expect(uses.length).toBe(4);
    for (const line of uses) {
      expect(line).toMatch(/uses: [\w./-]+@[0-9a-f]{40} # \S+/);
    }
  });

  it('triggers on main, site-related pull requests and manual runs', () => {
    expect(wf.on.push.branches).toEqual(['main']);
    expect(wf.on.pull_request.paths).toEqual([
      'site/**',
      'docs/**',
      'README.md',
      '.github/workflows/pages.yml',
    ]);
    expect(wf.on).toHaveProperty('workflow_dispatch');
  });

  it('has read-only contents at top level', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
  });

  it('cancels only pull request runs and queues deployments', () => {
    expect(wf.concurrency.group).toBe(
      "pages-${{ github.event_name == 'pull_request' && github.ref || 'deploy' }}",
    );
    expect(wf.concurrency['cancel-in-progress']).toBe(
      "${{ github.event_name == 'pull_request' }}",
    );
  });

  it('builds on pull requests without upload, and deploys only off pull requests with DEPLOY_PAGES', () => {
    const { build, deploy } = wf.jobs;
    expect(build.name).toBe('Build the site');
    expect(build.if).toContain("vars.DEPLOY_PAGES == 'true'");
    const upload = build.steps.find((s: { uses?: string }) => s.uses?.includes('upload-pages-artifact'));
    expect(upload.if).toBe("github.event_name != 'pull_request'");
    expect(upload.with.path).toBe('site/.vitepress/dist');
    expect(deploy.needs).toBe('build');
    expect(deploy.if).toContain("!= 'pull_request'");
    expect(deploy.if).toContain('DEPLOY_PAGES');
    expect(deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  });

  it('regenerates the lists and sets the site base in the build job', () => {
    const runs = wf.jobs.build.steps.map((s: { run?: string }) => s.run ?? '');
    expect(runs).toContain('pnpm run generate:all');
    expect(runs.some((r: string) => r.includes('SITE_BASE=/${{ github.event.repository.name }}/'))).toBe(true);
  });

  it('never commits or pushes', () => {
    expect(text).not.toMatch(/git commit|git push/);
  });
});
