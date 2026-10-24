import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Fixture, git, json, makeRepo, run } from './worktree-test-helpers';

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

it('pwsh is installed in CI (the worktree cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

describe.skipIf(!hasPwsh)('New-Worktree.ps1', () => {
  let f: Fixture;
  afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const nw = (args: string[], cwd = f.repo) => run('New-Worktree.ps1', args, cwd);
  const branches = () => git(f.repo, 'branch', '--format=%(refname:short)').split('\n');

  it('creates .worktrees dir 7 on feat/7 from origin/main and prints the JSON', () => {
    f = makeRepo();
    const r = nw(['-Issue', '7', '-Base', 'main']);
    expect(r.status).toBe(0);
    expect(json(r)).toEqual({
      path: path.join(f.repo, '.worktrees', '7'),
      branch: 'feat/7',
      base: 'main',
    });
    expect(git(path.join(f.repo, '.worktrees', '7'), 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(
      'feat/7'
    );
    expect(fs.existsSync(path.join(f.repo, '.worktrees', '7', 'a.txt'))).toBe(true);
  });

  it('honours -Branch and starts from the fetched origin tip', () => {
    f = makeRepo();
    const other = path.join(f.root, 'other');
    git(f.root, 'clone', '-q', f.origin, other);
    fs.writeFileSync(path.join(other, 'new.txt'), 'n\n');
    git(other, 'add', '.');
    git(other, 'commit', '-q', '-m', 'more');
    git(other, 'push', '-q', 'origin', 'main');
    const r = nw(['-Issue', '7', '-Branch', 'feat/7-custom', '-Base', 'main']);
    expect(r.status).toBe(0);
    expect(json(r).branch).toBe('feat/7-custom');
    expect(fs.existsSync(path.join(f.repo, '.worktrees', '7', 'new.txt'))).toBe(true);
  });

  it('run from inside .worktrees dir 7 it creates .worktrees dir 8 beside it, not nested', () => {
    f = makeRepo();
    expect(nw(['-Issue', '7', '-Base', 'main']).status).toBe(0);
    const r = nw(['-Issue', '8', '-Base', 'main'], path.join(f.repo, '.worktrees', '7'));
    expect(r.status).toBe(0);
    expect(json(r).path).toBe(path.join(f.repo, '.worktrees', '8'));
    expect(fs.existsSync(path.join(f.repo, '.worktrees', '7', '.worktrees'))).toBe(false);
  });

  it.each(['loop-12', '12-t13'])('accepts the issue form %s', (issue) => {
    f = makeRepo();
    const r = nw(['-Issue', issue, '-Base', 'main', '-Branch', `feat/${issue}`]);
    expect(r.status).toBe(0);
    expect(json(r).path).toBe(path.join(f.repo, '.worktrees', issue));
  });

  it('refuses when .worktrees dir is not ignored, naming Enable-Worktrees.ps1, and creates nothing', () => {
    f = makeRepo({ ignore: false });
    const r = nw(['-Issue', '7', '-Base', 'main']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Enable-Worktrees.ps1');
    expect(fs.existsSync(path.join(f.repo, '.worktrees'))).toBe(false);
    expect(branches()).toEqual(['main']);
  });

  it('refuses an existing path without touching it', () => {
    f = makeRepo();
    fs.mkdirSync(path.join(f.repo, '.worktrees', '7'), { recursive: true });
    fs.writeFileSync(path.join(f.repo, '.worktrees', '7', 'keep.txt'), 'k');
    const r = nw(['-Issue', '7', '-Base', 'main']);
    expect(r.status).not.toBe(0);
    expect(fs.readFileSync(path.join(f.repo, '.worktrees', '7', 'keep.txt'), 'utf8')).toBe('k');
    expect(branches()).toEqual(['main']);
  });

  it('refuses an existing branch', () => {
    f = makeRepo();
    git(f.repo, 'branch', 'feat/7');
    const r = nw(['-Issue', '7', '-Base', 'main']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Branch already exists');
    expect(fs.existsSync(path.join(f.repo, '.worktrees', '7'))).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked .worktrees', () => {
    f = makeRepo();
    const elsewhere = path.join(f.root, 'elsewhere');
    fs.mkdirSync(elsewhere);
    fs.symlinkSync(elsewhere, path.join(f.repo, '.worktrees'));
    const r = nw(['-Issue', '7', '-Base', 'main']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlink');
    expect(fs.readdirSync(elsewhere)).toEqual([]);
    expect(branches()).toEqual(['main']);
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked target', () => {
    f = makeRepo();
    fs.mkdirSync(path.join(f.repo, '.worktrees'));
    fs.symlinkSync(path.join(f.root, 'nowhere'), path.join(f.repo, '.worktrees', '7'));
    expect(nw(['-Issue', '7', '-Base', 'main']).status).not.toBe(0);
    expect(branches()).toEqual(['main']);
  });

  it.each(['../x', '7/../8', 'a b', '', '7;x', 'loop-', '7-t', '..', '-7'])(
    'rejects the issue value %j',
    (issue) => {
      f = makeRepo();
      const r = nw(['-Issue', issue, '-Base', 'main']);
      expect(r.status).not.toBe(0);
      expect(fs.existsSync(path.join(f.repo, '.worktrees'))).toBe(false);
    }
  );

  it('requires -Base and rejects odd base or branch names', () => {
    f = makeRepo();
    expect(nw(['-Issue', '7']).status).not.toBe(0);
    expect(nw(['-Issue', '7', '-Base', '--upload-pack=x']).status).not.toBe(0);
    expect(nw(['-Issue', '7', '-Base', 'main', '-Branch', '-b']).status).not.toBe(0);
    expect(nw(['-Issue', '7', '-Base', 'main', '-Branch', 'a..b']).status).not.toBe(0);
    expect(fs.existsSync(path.join(f.repo, '.worktrees'))).toBe(false);
  });

  it('fails when the base does not exist on origin and creates nothing', () => {
    f = makeRepo();
    const r = nw(['-Issue', '7', '-Base', 'release/none']);
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(f.repo, '.worktrees', '7'))).toBe(false);
    expect(branches()).toEqual(['main']);
  });

  it('fails outside a git repository', () => {
    f = makeRepo();
    const r = nw(['-Issue', '7', '-Base', 'main'], f.root);
    expect(r.status).not.toBe(0);
  });
});
