import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Fixture, git, json, makeRepo, plantLease, readLeases, run } from './worktree-test-helpers';

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe.skipIf(!hasPwsh)('Exit-Checkout.ps1', () => {
  let f: Fixture;
  beforeEach(() => {
    f = makeRepo();
  });
  afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const enter = (issue: string) =>
    run(
      'Enter-Checkout.ps1',
      ['-Issue', issue, '-Branch', `feat/${issue}`, '-Base', 'main'],
      f.repo
    );
  const exit = (issue: string, cwd = f.repo) => run('Exit-Checkout.ps1', ['-Issue', issue], cwd);
  const wt = (n: string) => path.join(f.repo, '.worktrees', n);
  /** issue 3 holds the main checkout, so issue 7 gets a worktree */
  const busy = () => {
    plantLease(f.state, { path: f.repo, issue: 3 });
    expect(enter('7').status).toBe(0);
  };

  it('removes the lease and a clean worktree', () => {
    busy();
    const r = exit('7');
    expect(r.status).toBe(0);
    expect(json(r)).toMatchObject({
      released: true,
      path: wt('7'),
      worktree: true,
      removed: true,
      kept: null,
    });
    expect(fs.existsSync(wt('7'))).toBe(false);
    expect(readLeases(f.state).map((l) => l.issue)).toEqual([3]);
  });

  it('keeps a dirty worktree, removes the lease and reports {kept}', () => {
    busy();
    fs.appendFileSync(path.join(wt('7'), 'a.txt'), 'x\n');
    const r = exit('7');
    expect(r.status).toBe(0);
    expect(json(r)).toMatchObject({ released: true, removed: false, kept: wt('7') });
    expect(fs.existsSync(path.join(wt('7'), 'a.txt'))).toBe(true);
    expect(readLeases(f.state).map((l) => l.issue)).toEqual([3]);
  });

  it('keeps a worktree with an untracked file', () => {
    busy();
    fs.writeFileSync(path.join(wt('7'), 'new.txt'), 'x');
    expect(json(exit('7')).kept).toBe(wt('7'));
    expect(fs.existsSync(wt('7'))).toBe(true);
  });

  it('main checkout: removes only the lease, leaves branch and files alone', () => {
    expect(enter('7').status).toBe(0);
    fs.appendFileSync(path.join(f.repo, 'a.txt'), 'work\n');
    const r = exit('7');
    expect(r.status).toBe(0);
    expect(json(r)).toMatchObject({
      released: true,
      path: f.repo,
      worktree: false,
      removed: false,
      kept: null,
    });
    expect(readLeases(f.state)).toEqual([]);
    expect(git(f.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feat/7');
    expect(fs.readFileSync(path.join(f.repo, 'a.txt'), 'utf8')).toBe('a\nwork\n');
  });

  it('works from inside the worktree it removes', () => {
    busy();
    expect(exit('7', wt('7')).status).toBe(0);
    expect(fs.existsSync(wt('7'))).toBe(false);
  });

  it('no lease: no-op without error', () => {
    const r = exit('7');
    expect(r.status).toBe(0);
    expect(json(r)).toMatchObject({ released: false });
  });

  it('leaves leases of other issues alone', () => {
    plantLease(f.state, { path: f.repo, issue: 3 });
    expect(exit('7').status).toBe(0);
    expect(readLeases(f.state).map((l) => l.issue)).toEqual([3]);
  });

  it('forgets a worktree whose directory vanished', () => {
    busy();
    fs.rmSync(wt('7'), { recursive: true });
    expect(exit('7').status).toBe(0);
    expect(git(f.repo, 'worktree', 'list', '--porcelain')).not.toContain('.worktrees');
  });

  it('does not remove a worktree outside .worktrees dir <nr> named in a lease', () => {
    const other = path.join(f.root, 'other-wt');
    git(f.repo, 'worktree', 'add', '-q', '-b', 'side', other);
    plantLease(f.state, { path: other, issue: 7 });
    const r = exit('7');
    expect(json(r)).toMatchObject({ removed: false, kept: other });
    expect(fs.existsSync(other)).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked leases directory', () => {
    const elsewhere = path.join(f.root, 'elsewhere');
    fs.mkdirSync(elsewhere);
    fs.writeFileSync(path.join(elsewhere, 'x.json'), JSON.stringify({ issue: 7, path: f.repo }));
    fs.mkdirSync(f.state, { recursive: true });
    fs.symlinkSync(elsewhere, path.join(f.state, 'leases'));
    const r = exit('7');
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(elsewhere, 'x.json'))).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked lease file', () => {
    fs.mkdirSync(path.join(f.state, 'leases'), { recursive: true });
    const target = path.join(f.root, 'real.json');
    fs.writeFileSync(target, JSON.stringify({ issue: 7, path: f.repo }));
    fs.symlinkSync(target, path.join(f.state, 'leases', 'aaaaaaaaaaaaaaaa.json'));
    expect(exit('7').status).not.toBe(0);
    expect(fs.existsSync(target)).toBe(true);
  });

  it.each([['x'], ['loop-7'], ['']])('rejects the issue value %j', (issue) => {
    expect(exit(issue).status).not.toBe(0);
  });
});
