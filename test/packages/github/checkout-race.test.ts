import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  SCRIPTS,
  Fixture,
  Lease,
  git,
  leaseKey,
  makeRepo,
  plantLease,
  readLeases,
} from './worktree-test-helpers';

type Out = { code: number | null; stdout: string; stderr: string };

/** Starts Enter-Checkout.ps1 as a separate process; all are spawned in the same tick, a "go" file would only delay the pwsh start-up. */
const enter = (
  f: Fixture,
  issue: number,
  extra: string[] = [],
  env: Record<string, string> = {}
): Promise<Out> =>
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
          ENTER_CHECKOUT_TEST_PAUSE: '',
          ...env,
        },
      }
    );
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('exit', (code) => resolve({ code, stdout, stderr }));
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolves true once `file` exists, false once `done()` is true first (the paused run finished without reaching the point). */
const reached = async (file: string, done: () => boolean = () => false): Promise<boolean> => {
  for (let i = 0; i < 1200; i++) {
    if (fs.existsSync(file)) return true;
    if (done()) return false;
    await sleep(50);
  }
  throw new Error(`pause point not reached: ${file}`);
};

/** Parsed JSON results; asserts exit 0 for every run. */
const parse = (outs: Out[]) => {
  for (const o of outs) expect(o.code, o.stderr).toBe(0);
  return outs.map((o) => JSON.parse(o.stdout.trim()) as { path: string; worktree: boolean });
};

const noLeftovers = (f: Fixture) =>
  expect(fs.readdirSync(path.join(f.state, 'leases')).filter((x) => !x.endsWith('.json'))).toEqual(
    []
  );

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

  it.each([2, 3])(
    '%i runs racing for a stale main-checkout lease: exactly one takes it over',
    async (n) => {
      const old = new Date(Date.now() - 6 * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z');
      plantLease(f.state, { path: f.repo, issue: 55, heartbeat: old, started: old });
      const issues = Array.from({ length: n }, (_, i) => 201 + i);
      const outs = await Promise.all(issues.map((i) => enter(f, i)));
      const results = parse(outs);
      expect(
        results.filter((r) => !r.worktree),
        JSON.stringify(outs)
      ).toHaveLength(1);
      const leases = readLeases(f.state);
      expect(leases).toHaveLength(n);
      const onMain = leases.filter((l) => l.path === f.repo);
      expect(onMain).toHaveLength(1);
      expect(issues).toContain(onMain[0].issue);
      expect(new Set(results.map((r) => r.path)).size).toBe(n);
      noLeftovers(f);
    },
    120_000
  );

  it('a lease created after a run looked is never taken over by that run (race A)', async () => {
    const pause = fs.mkdtempSync(path.join(f.root, 'pause-'));
    // B looks at a free main checkout and stops right after the look
    const b = enter(f, 402, [], { ENTER_CHECKOUT_TEST_PAUSE: pause });
    await reached(path.join(pause, 'after-snapshot.reached'));
    // A claims the main checkout in that window
    const [a] = parse([await enter(f, 401)]);
    expect(a.worktree).toBe(false);
    fs.writeFileSync(path.join(pause, 'after-snapshot.go'), '');
    const [rb] = parse([await b]);
    expect(rb.worktree, JSON.stringify(rb)).toBe(true);
    const onMain = readLeases(f.state).filter((l) => l.path === f.repo);
    expect(onMain.map((l) => l.issue)).toEqual([401]);
    expect(readLeases(f.state)).toHaveLength(2);
    noLeftovers(f);
  }, 120_000);

  it('a third run claiming during a stale takeover never costs a live lease (race B)', async () => {
    const old = new Date(Date.now() - 6 * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z');
    plantLease(f.state, { path: f.repo, issue: 55, heartbeat: old, started: old });
    const pause = fs.mkdtempSync(path.join(f.root, 'pause-'));
    // B sees the stale lease and stops before it acts on it
    let bDone = false;
    const b = enter(f, 502, [], { ENTER_CHECKOUT_TEST_PAUSE: pause }).then((o) => {
      bDone = true;
      return o;
    });
    await reached(path.join(pause, 'after-snapshot.reached'));
    // A takes the stale lease over in that window
    const [a] = parse([await enter(f, 501)]);
    expect(a.worktree).toBe(false);
    fs.writeFileSync(path.join(pause, 'after-snapshot.go'), '');
    // should B move A's fresh lease aside, C claims the then free path before B puts it back
    const inRestore = await reached(path.join(pause, 'before-restore.reached'), () => bDone);
    const c = inRestore ? await enter(f, 503) : undefined;
    fs.writeFileSync(path.join(pause, 'before-restore.go'), '');
    const outs = [await b, c ?? (await enter(f, 503))];
    const results = parse(outs);
    expect(
      results.filter((r) => !r.worktree),
      JSON.stringify(outs)
    ).toHaveLength(0);
    const leases = readLeases(f.state);
    expect(leases.filter((l) => l.path === f.repo).map((l) => l.issue)).toEqual([501]);
    expect(leases).toHaveLength(3);
    noLeftovers(f);
  }, 120_000);

  /** B takes a stale #55 lease over; its owner renews it after B's check, C claims the emptied path before B can put it back. */
  const displace = async (onRestore: (pid: string) => void = () => {}) => {
    const old = new Date(Date.now() - 6 * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z');
    const file = plantLease(f.state, { path: f.repo, issue: 55, heartbeat: old, started: old });
    const pause = fs.mkdtempSync(path.join(f.root, 'pause-'));
    fs.writeFileSync(path.join(pause, 'after-snapshot.go'), '');
    const b = enter(f, 602, [], { ENTER_CHECKOUT_TEST_PAUSE: pause });
    await reached(path.join(pause, 'before-move.reached'));
    // the owner of #55 renews its heartbeat after B checked the lease under the takeover lock
    const renewed = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    fs.writeFileSync(
      file,
      JSON.stringify({
        path: f.repo,
        issue: 55,
        branch: 'feat/55',
        host: 'h',
        started: old,
        heartbeat: renewed,
      })
    );
    fs.writeFileSync(path.join(pause, 'before-move.go'), '');
    await reached(path.join(pause, 'before-restore.reached'));
    // C claims the path B has just emptied, so B cannot put the renewed lease back
    const [c] = parse([await enter(f, 603)]);
    expect(c.worktree).toBe(false);
    onRestore(fs.readFileSync(path.join(pause, 'before-restore.reached'), 'utf8').trim());
    fs.writeFileSync(path.join(pause, 'before-restore.go'), '');
    const ob = await b;
    const [rb] = parse([ob]);
    expect(rb.worktree).toBe(true);
    expect(ob.stderr).toContain('lease of #55 renewed during a takeover and displaced');
    expect(
      readLeases(f.state)
        .filter((l) => l.path === f.repo)
        .map((l) => l.issue)
    ).toEqual([603]);
    return { renewed, names: fs.readdirSync(path.join(f.state, 'leases')) };
  };
  const leaseFile = (name: string) =>
    JSON.parse(fs.readFileSync(path.join(f.state, 'leases', name), 'utf8')) as Lease;

  it('a lease renewed during a takeover and then displaced by a newer claim is kept, not deleted', async () => {
    const { renewed, names } = await displace();
    const displaced = names.filter((x) => x.startsWith(`${leaseKey(f.repo)}.json.displaced-`));
    expect(displaced).toHaveLength(1);
    expect(leaseFile(displaced[0])).toMatchObject({ issue: 55, heartbeat: renewed });
  }, 120_000);

  it('a displaced lease whose .displaced-<pid> name is taken stays in its .stale file', async () => {
    let blocker = '';
    const { renewed, names } = await displace((pid) => {
      blocker = `${leaseKey(f.repo)}.json.displaced-${pid}`;
      fs.writeFileSync(path.join(f.state, 'leases', blocker), 'other\n');
    });
    expect(fs.readFileSync(path.join(f.state, 'leases', blocker), 'utf8')).toBe('other\n');
    const stale = names.filter((x) => /\.json\.\d+\.stale$/.test(x));
    expect(stale).toHaveLength(1);
    expect(leaseFile(stale[0])).toMatchObject({ issue: 55, heartbeat: renewed });
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

describe('Enter-Checkout.ps1 handles takeover leftovers', () => {
  let f: Fixture;
  beforeEach(() => {
    f = makeRepo();
  });
  afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));

  const stamp = (msAgo: number) =>
    new Date(Date.now() - msAgo).toISOString().replace(/\.\d+Z$/, 'Z');
  /** Writes a leftover lease file in the leases directory, mtime `ageS` seconds ago. */
  const leftover = (
    name: string,
    issue: number,
    heartbeatMsAgo: number,
    ageS = 0,
    body?: string
  ) => {
    const dir = path.join(f.state, 'leases');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    const hb = stamp(heartbeatMsAgo);
    fs.writeFileSync(
      file,
      body ??
        JSON.stringify({
          path: '/elsewhere',
          issue,
          branch: 'b',
          host: 'h',
          started: hb,
          heartbeat: hb,
        })
    );
    const t = new Date(Date.now() - ageS * 1000);
    fs.utimesSync(file, t, t);
    return file;
  };
  const key = () => leaseKey(f.repo);

  it('a live displaced lease is named on stderr and kept; stale and unreadable leftovers are removed', async () => {
    const live = leftover(`${key()}.json.displaced-11`, 71, 60_000);
    const gone = leftover(`${key()}.json.displaced-12`, 72, 6 * 3600_000);
    const junk = leftover(`${key()}.json.displaced-13`, 0, 0, 0, '{not json');
    const orphan = leftover(`${key()}.json.14.stale`, 74, 6 * 3600_000, 120);
    const o = await enter(f, 701);
    const [r] = parse([o]);
    expect(r.worktree).toBe(false);
    expect(o.stderr).toContain(
      `displaced lease of #71 on /elsewhere is still live: kept as ${live}`
    );
    expect(fs.existsSync(live)).toBe(true);
    expect([gone, junk, orphan].filter((x) => fs.existsSync(x))).toEqual([]);
  }, 120_000);

  it('a .stale file younger than 60 s belongs to a takeover in flight and is left alone', async () => {
    const young = leftover(`${key()}.json.15.stale`, 75, 6 * 3600_000, 5);
    const o = await enter(f, 702);
    parse([o]);
    expect(fs.existsSync(young)).toBe(true);
    expect(o.stderr).not.toContain('#75');
  }, 120_000);

  it('a live orphaned .stale lease is kept and named, files outside the leftover pattern are untouched', async () => {
    const orphan = leftover(`${key()}.json.16.stale`, 76, 60_000, 120);
    const other = leftover('notes.txt', 77, 6 * 3600_000);
    const o = await enter(f, 703);
    parse([o]);
    expect(o.stderr).toContain('displaced lease of #76');
    expect([orphan, other].every((x) => fs.existsSync(x))).toBe(true);
  }, 120_000);
});
