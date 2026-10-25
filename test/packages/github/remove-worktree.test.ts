import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Fixture, git, json, makeRepo, run } from './worktree-test-helpers';

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe.skipIf(!hasPwsh)('Remove-Worktree.ps1', () => {
  let f: Fixture;
  let wt: string;
  beforeEach(() => {
    f = makeRepo();
    expect(run('New-Worktree.ps1', ['-Issue', '7', '-Base', 'main'], f.repo).status).toBe(0);
    wt = path.join(f.repo, '.worktrees', '7');
  });
  afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const rw = (args: string[], cwd = f.repo) => run('Remove-Worktree.ps1', args, cwd);

  it('removes a clean worktree and prunes', () => {
    const r = rw(['-Issue', '7']);
    expect(r.status).toBe(0);
    expect(json(r)).toEqual({ path: wt, removed: true });
    expect(fs.existsSync(wt)).toBe(false);
    expect(git(f.repo, 'worktree', 'list', '--porcelain')).not.toContain('.worktrees');
    expect(git(f.repo, 'branch', '--format=%(refname:short)')).toContain('feat/7');
  });

  it('works from inside another worktree', () => {
    expect(run('New-Worktree.ps1', ['-Issue', '8', '-Base', 'main'], f.repo).status).toBe(0);
    const r = rw(['-Issue', '7'], path.join(f.repo, '.worktrees', '8'));
    expect(r.status).toBe(0);
    expect(fs.existsSync(wt)).toBe(false);
    expect(fs.existsSync(path.join(f.repo, '.worktrees', '8'))).toBe(true);
  });

  it('refuses a dirty worktree without -Force and keeps it', () => {
    fs.appendFileSync(path.join(wt, 'a.txt'), 'dirty\n');
    const r = rw(['-Issue', '7']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('-Force');
    expect(fs.existsSync(path.join(wt, 'a.txt'))).toBe(true);
  });

  it('refuses a worktree with an untracked file without -Force', () => {
    fs.writeFileSync(path.join(wt, 'new.txt'), 'x');
    expect(rw(['-Issue', '7']).status).not.toBe(0);
    expect(fs.existsSync(wt)).toBe(true);
  });

  it('removes a dirty worktree with -Force', () => {
    fs.appendFileSync(path.join(wt, 'a.txt'), 'dirty\n');
    const r = rw(['-Issue', '7', '-Force']);
    expect(r.status).toBe(0);
    expect(fs.existsSync(wt)).toBe(false);
  });

  it('is a no-op on a missing worktree', () => {
    const r = rw(['-Issue', '99']);
    expect(r.status).toBe(0);
    expect(json(r)).toEqual({ path: path.join(f.repo, '.worktrees', '99'), removed: false });
  });

  it('prunes a worktree whose directory vanished', () => {
    fs.rmSync(wt, { recursive: true });
    const r = rw(['-Issue', '7']);
    expect(r.status).toBe(0);
    expect(git(f.repo, 'worktree', 'list', '--porcelain')).not.toContain('.worktrees');
  });

  it('refuses an unregistered directory under .worktrees dir and does not delete it', () => {
    fs.mkdirSync(path.join(f.repo, '.worktrees', '9'));
    fs.writeFileSync(path.join(f.repo, '.worktrees', '9', 'keep.txt'), 'k');
    const r = rw(['-Issue', '9', '-Force']);
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(f.repo, '.worktrees', '9', 'keep.txt'))).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked target', () => {
    const real = path.join(f.root, 'real');
    fs.mkdirSync(real);
    fs.symlinkSync(real, path.join(f.repo, '.worktrees', '5'));
    expect(rw(['-Issue', '5']).status).not.toBe(0);
    expect(fs.existsSync(real)).toBe(true);
  });

  it.each(['../x', '7/..', 'a b', '', 'loop-'])('rejects the issue value %j', (issue) => {
    expect(rw(['-Issue', issue]).status).not.toBe(0);
    expect(fs.existsSync(wt)).toBe(true);
  });
});
