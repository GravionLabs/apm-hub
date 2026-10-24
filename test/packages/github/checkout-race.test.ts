import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  SCRIPTS,
  Fixture,
  git,
  leaseKey,
  makeRepo,
  plantLease,
  readLeases,
} from './worktree-test-helpers';

type Out = { code: number | null; stdout: string; stderr: string };

/** Starts Enter-Checkout.ps1 as a separate process; all are spawned in the same tick, a "go" file would only delay the pwsh start-up. */
const enter = (f: Fixture, issue: number, extra: string[] = []): Promise<Out> =>
  new Promise((resolve) => {
    const p = spawn(
      'pwsh',
      [
        '-NoProfile',
        '-File',
        path.join(SCRIPTS, 'Enter-Checkout.ps1'),
        '-Issue',
        String(issue),
        '-Branch',
        `feat/${issue}-x`,
        '-Base',
        'main',
        ...extra,
      ],
      {
        cwd: f.repo,
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
          DROMOS_STATE_DIR: '',
        },
      }
    );
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('exit', (code) => resolve({ code, stdout, stderr }));
  });

describe('Enter-Checkout.ps1 lease creation is race-safe (#466)', () => {
  let f: Fixture;
  beforeEach(() => {
    f = makeRepo();
  });
  afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));

  it.each([2, 4])(
    '%i runs starting at the same instant: exactly one takes the free main checkout',
    async (n) => {
      const issues = Array.from({ length: n }, (_, i) => 100 + i);
      const outs = await Promise.all(issues.map((i) => enter(f, i)));
      for (const o of outs) expect(o.code, o.stderr).toBe(0);
      const results = outs.map(
        (o) => JSON.parse(o.stdout.trim()) as { path: string; worktree: boolean }
      );
      expect(
        results.filter((r) => !r.worktree),
        JSON.stringify(outs)
      ).toHaveLength(1);
      expect(results.filter((r) => r.worktree)).toHaveLength(n - 1);
      const leases = readLeases(f.state);
      expect(leases).toHaveLength(n);
      expect(leases.filter((l) => l.path === f.repo)).toHaveLength(1);
      expect(new Set(results.map((r) => r.path)).size).toBe(n); // every run has its own checkout
      // no temporary or stale leftovers in the leases directory
      expect(
        fs.readdirSync(path.join(f.state, 'leases')).filter((x) => !x.endsWith('.json'))
      ).toEqual([]);
    },
    120_000
  );

  it('two runs racing for a stale main-checkout lease: exactly one takes it over', async () => {
    const old = new Date(Date.now() - 6 * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z');
    plantLease(f.state, { path: f.repo, issue: 55, heartbeat: old, started: old });
    const outs = await Promise.all([enter(f, 201), enter(f, 202)]);
    for (const o of outs) expect(o.code, o.stderr).toBe(0);
    const results = outs.map((o) => JSON.parse(o.stdout.trim()) as { worktree: boolean });
    expect(
      results.filter((r) => !r.worktree),
      JSON.stringify(outs)
    ).toHaveLength(1);
    const onMain = readLeases(f.state).filter((l) => l.path === f.repo);
    expect(onMain).toHaveLength(1);
    expect([201, 202]).toContain(onMain[0].issue);
  }, 120_000);

  it('a dirty main checkout releases the claimed lease again and gets a worktree', async () => {
    fs.writeFileSync(path.join(f.repo, 'a.txt'), 'changed\n');
    const o = await enter(f, 301);
    expect(o.code, o.stderr).toBe(0);
    const r = JSON.parse(o.stdout.trim());
    expect(r.worktree).toBe(true);
    expect(readLeases(f.state).map((l) => l.path)).toEqual([r.path]);
    expect(fs.existsSync(path.join(f.state, 'leases', `${leaseKey(f.repo)}.json`))).toBe(false);
  });

  it('a failing checkout leaves no lease on the main checkout', async () => {
    const o = await enterBadBase(f);
    expect(o.code).not.toBe(0);
    expect(fs.existsSync(path.join(f.state, 'leases', `${leaseKey(f.repo)}.json`))).toBe(false);
    expect(git(f.repo, 'status', '--porcelain')).toBe('');
  });
});

const enterBadBase = (f: Fixture): Promise<Out> =>
  new Promise((resolve) => {
    const p = spawn(
      'pwsh',
      [
        '-NoProfile',
        '-File',
        path.join(SCRIPTS, 'Enter-Checkout.ps1'),
        '-Issue',
        '303',
        '-Branch',
        'feat/303-x',
        '-Base',
        'does-not-exist',
      ],
      {
        cwd: f.repo,
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
          DROMOS_STATE_DIR: '',
        },
      }
    );
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d));
    p.on('exit', (code) => resolve({ code, stdout: '', stderr }));
  });
