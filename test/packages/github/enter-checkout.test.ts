import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  Fixture,
  git,
  json,
  leaseKey,
  makeRepo,
  plantLease,
  readLeases,
  run,
} from './worktree-test-helpers';

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

  it('free checkout: main checkout, branch from origin/main, worktree false, exactly one lease', () => {
    const r = enter('7');
    expect(r.status).toBe(0);
    const out = json(r);
    expect(out).toMatchObject({ path: f.repo, worktree: false, branch: 'feat/7', base: 'main' });
    expect(git(f.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feat/7');
    expect(git(f.repo, 'rev-parse', 'HEAD')).toBe(git(f.repo, 'rev-parse', 'origin/main'));
    const leases = readLeases(f.state);
    expect(leases).toHaveLength(1);
    expect(out.lease).toBe(path.join(f.state, 'leases', `${leaseKey(f.repo)}.json`));
    expect(leases[0]).toMatchObject({ path: f.repo, issue: 7, branch: 'feat/7' });
    expect(Object.keys(leases[0]).sort()).toEqual([
      'branch',
      'heartbeat',
      'host',
      'issue',
      'path',
      'started',
    ]);
    expect(leases[0].started).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(leases[0].heartbeat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(fs.existsSync(path.join(f.repo, '.worktrees'))).toBe(false);
  });

  it('checks out an existing local branch', () => {
    git(f.repo, 'branch', 'feat/7');
    const r = enter('7');
    expect(r.status).toBe(0);
    expect(git(f.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feat/7');
  });

  it('untracked files do not make the checkout busy', () => {
    fs.writeFileSync(path.join(f.repo, 'untracked.txt'), 'x');
    expect(json(enter('7')).worktree).toBe(false);
  });

  it('live lease of another issue on the main checkout: .worktrees/<nr>, worktree true', () => {
    plantLease(f.state, { path: f.repo, issue: 3, branch: 'feat/3' });
    const r = enter('7');
    expect(r.status).toBe(0);
    const out = json(r);
    expect(out).toMatchObject({ path: wt('7'), worktree: true, branch: 'feat/7', base: 'main' });
    expect(git(f.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    const mine = readLeases(f.state).find((l) => l.issue === 7);
    expect(mine).toMatchObject({ path: wt('7'), branch: 'feat/7' });
    expect(out.lease).toBe(path.join(f.state, 'leases', `${leaseKey(wt('7'))}.json`));
  });

  it('dirty tracked file: .worktrees/<nr>', () => {
    fs.appendFileSync(path.join(f.repo, 'a.txt'), 'changed\n');
    const out = json(enter('7'));
    expect(out).toMatchObject({ path: wt('7'), worktree: true });
    expect(fs.readFileSync(path.join(f.repo, 'a.txt'), 'utf8')).toBe('a\nchanged\n');
  });

  it('own live lease: same checkout again (resume), heartbeat renewed, started kept', () => {
    const old = new Date(Date.now() - 30 * 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
    plantLease(f.state, { path: f.repo, issue: 7, branch: 'feat/7', started: old, heartbeat: old });
    const r = enter('7');
    expect(r.status).toBe(0);
    expect(json(r)).toMatchObject({ path: f.repo, worktree: false, branch: 'feat/7' });
    const [l] = readLeases(f.state);
    expect(l.started).toBe(old);
    expect(Date.parse(l.heartbeat)).toBeGreaterThan(Date.parse(old) + 20 * 60_000);
    expect(readLeases(f.state)).toHaveLength(1);
  });

  it('own lease on a worktree is reused: second call returns the same worktree', () => {
    plantLease(f.state, { path: f.repo, issue: 3, branch: 'feat/3' });
    const first = json(enter('7'));
    const second = json(enter('7'));
    expect(second.path).toBe(first.path);
    expect(second.worktree).toBe(true);
    expect(readLeases(f.state)).toHaveLength(2);
  });

  it('stale lease (older than the TTL) of another issue is taken over with a warning', () => {
    const old = new Date(Date.now() - 3 * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z');
    plantLease(f.state, { path: f.repo, issue: 3, branch: 'feat/3', heartbeat: old });
    const r = enter('7');
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('stale lease of #3 taken over');
    expect(json(r)).toMatchObject({ path: f.repo, worktree: false });
    const leases = readLeases(f.state);
    expect(leases).toHaveLength(1);
    expect(leases[0].issue).toBe(7);
  });

  it('-LeaseTtlMinutes shortens the lifetime of a lease', () => {
    const tenMinutes = new Date(Date.now() - 10 * 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
    plantLease(f.state, { path: f.repo, issue: 3, branch: 'feat/3', heartbeat: tenMinutes });
    expect(json(enter('7')).worktree).toBe(true);
    fs.rmSync(path.join(f.state, 'leases', `${leaseKey(wt('7'))}.json`));
    git(f.repo, 'worktree', 'remove', wt('7'));
    git(f.repo, 'branch', '-D', 'feat/7');
    const r = enter('7', f.repo, ['-LeaseTtlMinutes', '5']);
    expect(json(r).worktree).toBe(false);
    expect(r.stderr).toContain('stale lease of #3');
  });

  it('a lease on another checkout path does not make the main checkout busy', () => {
    plantLease(f.state, { path: path.join(f.root, 'elsewhere'), issue: 3, branch: 'feat/3' });
    expect(json(enter('7')).worktree).toBe(false);
  });

  it('run from inside a worktree it still decides for the main checkout and uses the shared state', () => {
    plantLease(f.state, { path: f.repo, issue: 3, branch: 'feat/3' });
    expect(json(enter('7')).path).toBe(wt('7'));
    const r = enter('8', wt('7'));
    expect(r.status).toBe(0);
    expect(json(r).path).toBe(wt('8'));
    expect(readLeases(f.state)).toHaveLength(3);
  });

  it('reuses an already registered worktree of that name without a lease', () => {
    expect(run('New-Worktree.ps1', ['-Issue', '7', '-Base', 'main'], f.repo).status).toBe(0);
    plantLease(f.state, { path: f.repo, issue: 3, branch: 'feat/3' });
    const r = enter('7');
    expect(r.status).toBe(0);
    expect(json(r)).toMatchObject({ path: wt('7'), worktree: true, branch: 'feat/7' });
  });

  it('honours DROMOS_STATE_DIR', () => {
    const state = path.join(f.root, 'state');
    expect(enter('7', f.repo, [], { DROMOS_STATE_DIR: state }).status).toBe(0);
    expect(fs.readdirSync(path.join(state, 'leases'))).toHaveLength(1);
    expect(fs.existsSync(path.join(f.state, 'leases'))).toBe(false);
  });

  it('busy and .worktrees/ not ignored: refuses naming Enable-Worktrees.ps1', () => {
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
