import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Fixture, git, json, makeRepo, plantLease, readLeases, run } from './worktree-test-helpers';

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe.skipIf(!hasPwsh)('Enter-Checkout.ps1', () => {
  let f: Fixture;
  beforeEach(() => {
    f = makeRepo();
  });
  afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const enter = (
    issue: string,
    cwd = f.repo,
    extra: string[] = [],
    env: Record<string, string> = {}
  ) =>
    run(
      'Enter-Checkout.ps1',
      ['-Issue', issue, '-Branch', `feat/${issue}`, '-Base', 'main', ...extra],
      cwd,
      env
    );
  const wt = (n: string) => path.join(f.repo, '.worktrees', n);

  it('busy and .worktrees dir not ignored: refuses naming Enable-Worktrees.ps1', () => {
    fs.rmSync(f.root, { recursive: true, force: true });
    f = makeRepo({ ignore: false });
    plantLease(f.state, { path: f.repo, issue: 3, branch: 'feat/3' });
    const r = enter('7');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Enable-Worktrees.ps1');
    expect(readLeases(f.state)).toHaveLength(1);
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked leases directory', () => {
    const elsewhere = path.join(f.root, 'elsewhere');
    fs.mkdirSync(elsewhere);
    fs.mkdirSync(f.state, { recursive: true });
    fs.symlinkSync(elsewhere, path.join(f.state, 'leases'));
    const r = enter('7');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlink');
    expect(fs.readdirSync(elsewhere)).toEqual([]);
    expect(git(f.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked lease file', () => {
    fs.mkdirSync(path.join(f.state, 'leases'), { recursive: true });
    const target = path.join(f.root, 'real.json');
    fs.writeFileSync(target, '{}');
    fs.symlinkSync(target, path.join(f.state, 'leases', 'aaaaaaaaaaaaaaaa.json'));
    const r = enter('7');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlink');
    expect(fs.readFileSync(target, 'utf8')).toBe('{}');
  });

  it.each([['x'], ['7; echo'], ['loop-7'], ['']])('rejects the issue value %j', (issue) => {
    expect(enter(issue).status).not.toBe(0);
    expect(fs.existsSync(path.join(f.state, 'leases'))).toBe(false);
  });

  it('requires -Branch and -Base', () => {
    expect(run('Enter-Checkout.ps1', ['-Issue', '7', '-Base', 'main'], f.repo).status).not.toBe(0);
    expect(run('Enter-Checkout.ps1', ['-Issue', '7', '-Branch', 'feat/7'], f.repo).status).not.toBe(
      0
    );
  });
});
