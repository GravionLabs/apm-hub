import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { createFakeGh } from '../../helpers/fake-gh';
import { Fixture, git, json, makeRepo, readLeases, run } from './worktree-test-helpers';

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
describe.skipIf(!hasPwsh || spawnSync('node', ['-v']).status !== 0)(
  'Enter-Checkout.ps1 project status',
  () => {
    let f: Fixture;
    beforeEach(() => {
      f = makeRepo();
      // origin keeps working through a rewrite, but names a GitHub repository
      git(f.repo, 'config', `url.${f.origin}.insteadOf`, 'https://github.com/o/r.git');
      git(f.repo, 'remote', 'set-url', 'origin', 'https://github.com/o/r.git');
    });
    afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));

    const handler = (failMutation: boolean) => `(call) => {
    const fs = require('fs');
    const q = call.query || '';
    if (q.includes('mutation')) {
      fs.writeFileSync(${JSON.stringify(path.join('__DIR__', 'lease-at-mutation'))}, String(fs.readdirSync(${JSON.stringify(path.join('__STATE__', 'leases'))}).length));
      ${failMutation ? "throw new Error('boom');" : 'return {};'}
    }
    if (q.includes('projectV2(number')) return { repositoryOwner: { projectV2: { id: 'P1', fields: { nodes: [
      { __typename: 'ProjectV2SingleSelectField', id: 'F-status', name: 'Status', options: [{ id: 'O-ip', name: 'In Progress' }] }] } } } };
    return { i0: { issue: { number: 7, title: '[PBI] t', state: 'OPEN', repository: { nameWithOwner: 'o/r' },
      labels: { nodes: [] }, subIssues: { nodes: [] }, closedByPullRequestsReferences: { nodes: [] },
      projectItems: { nodes: [{ id: 'ITEM7', project: { id: 'P1' } }] } } } };
  }`;
    const enter = (opts: {
      config?: boolean;
      workflow?: string;
      workflowBody?: string;
      fail?: boolean;
      env?: Record<string, string>;
    }) => {
      if (opts.workflow) {
        fs.mkdirSync(path.join(f.repo, '.github/workflows'), { recursive: true });
        fs.writeFileSync(
          path.join(f.repo, '.github/workflows', opts.workflow),
          opts.workflowBody ??
            'jobs:\n  a:\n    with:\n      project-url: https://github.com/orgs/o/projects/1\n'
        );
      }
      if (opts.config !== false && !opts.workflow) {
        fs.mkdirSync(path.join(f.repo, '.agents'), { recursive: true });
        fs.writeFileSync(path.join(f.repo, '.agents/project.json'), '{"owner":"o","number":1}');
      }
      const dir = path.join(f.root, 'fake');
      const gh = createFakeGh(
        dir,
        handler(opts.fail === true)
          .replaceAll('__DIR__', dir)
          .replaceAll('__STATE__', f.state)
      );
      const r = run(
        'Enter-Checkout.ps1',
        ['-Issue', '7', '-Branch', 'feat/7', '-Base', 'main'],
        f.repo,
        { ...gh.env(), ...opts.env } as Record<string, string>
      );
      return { r, gh, dir };
    };

    it('sets Status In Progress after the lease exists', () => {
      const { r, gh, dir } = enter({});
      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain('Project status:');
      expect(json(r).worktree).toBe(false);
      const mut = gh.calls().filter((c) => c.query?.includes('mutation'));
      expect(mut).toHaveLength(1);
      expect(mut[0].variables!.i).toEqual({
        projectId: 'P1',
        itemId: 'ITEM7',
        fieldId: 'F-status',
        value: { singleSelectOptionId: 'O-ip' },
      });
      expect(fs.readFileSync(path.join(dir, 'lease-at-mutation'), 'utf8')).toBe('1');
    });

    it('a project-url in issue-events.yml alone configures the status call', () => {
      const { r, gh } = enter({ workflow: 'issue-events.yml' });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).not.toContain('Project status:');
      expect(gh.calls().filter((c) => c.query?.includes('mutation'))).toHaveLength(1);
    });

    it.each([
      [
        'a placeholder project-url',
        'with:\n  project-url: https://github.com/orgs/<owner>/projects/<n>\n',
      ],
      ['no project-url', 'name: ci\non: push\n'],
    ])('%s in a workflow makes no sync call', (_n, body) => {
      const { r, gh } = enter({ workflow: 'issue-events.yml', workflowBody: body });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).not.toContain('Project status:');
      expect(gh.calls()).toHaveLength(0);
    });

    it('a failing status call still exits 0, keeps the lease and prints one stderr line', () => {
      const { r } = enter({ fail: true });
      expect(r.status).toBe(0);
      expect(r.stderr.match(/Project status:/g)).toHaveLength(1);
      expect(json(r).path).toBe(f.repo);
      expect(readLeases(f.state)).toHaveLength(1);
    });

    it('without project config: no Project status line and no gh call', () => {
      const { r, gh } = enter({ config: false });
      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain('Project status:');
      expect(gh.calls()).toHaveLength(0);
    });

    it('in a worktree (main checkout busy) reads the worktree config and sets the status', () => {
      fs.mkdirSync(path.join(f.repo, '.agents'), { recursive: true });
      fs.writeFileSync(path.join(f.repo, '.agents/project.json'), '{"owner":"o","number":1}');
      git(f.repo, 'add', '.agents/project.json');
      git(f.repo, 'commit', '-q', '-m', 'project config');
      git(f.repo, 'push', '-q', 'origin', 'main');
      // a live lease of another issue keeps the main checkout busy
      const other = run(
        'Enter-Checkout.ps1',
        ['-Issue', '3', '-Branch', 'feat/3', '-Base', 'main'],
        f.repo,
        { PROJECT_SYNC_OFF: '1' } as Record<string, string>
      );
      expect(other.status, other.stderr).toBe(0);
      // the main checkout (the caller cwd) no longer has the config; only the new worktree (from origin/main) does
      git(f.repo, 'rm', '-q', '.agents/project.json');
      git(f.repo, 'commit', '-q', '-m', 'drop config on feat/3');
      expect(fs.existsSync(path.join(f.repo, '.agents/project.json'))).toBe(false);
      const { r, gh } = enter({ config: false });
      expect(r.status, r.stderr).toBe(0);
      expect(json(r).worktree).toBe(true);
      expect(r.stderr).not.toContain('Project status:');
      expect(gh.calls().filter((c) => c.query?.includes('mutation'))).toHaveLength(1);
    });

    it('PROJECT_SYNC_OFF=1 makes no gh call', () => {
      const { r, gh } = enter({ env: { PROJECT_SYNC_OFF: '1' } });
      expect(r.status).toBe(0);
      expect(gh.calls()).toHaveLength(0);
    });
  }
);
