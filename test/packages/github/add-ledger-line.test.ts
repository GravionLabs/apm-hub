import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PwshWorker } from '../../helpers/pwsh-worker';
import { readLedger, gitCleanEnv } from '../../helpers/ledger-test-helpers';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-issue/scripts/Add-LedgerLine.ps1'
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

it('pwsh is installed in CI (the Add-LedgerLine cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

// One pwsh worker per describe runs the script in-process for every case (instead of one pwsh start per case).
describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 -Issue', () => {
  let dir: string;
  let worker: PwshWorker;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (issue: string, line?: string) =>
    worker.run(['-Issue', issue, ...(line === undefined ? [] : ['-Line', line])], {
      cwd: dir,
      env: { ...process.env, DROMOS_STATE_DIR: path.join(dir, '.agents') },
    });
  const ledger = (issue: string) => path.join(dir, '.agents', issue, 'progress.md');

  it.each(['loop-308', '42', 'adhoc'])('accepts %s and appends the line', async (issue) => {
    const r = await run(issue, 'hello');
    expect(r.status).toBe(0);
    expect(readLedger(ledger(issue)).trim()).toBe('hello');
  });

  it('prefixes every line with an ISO-8601 UTC timestamp', async () => {
    const before = Date.now();
    expect((await run('42', 'Phase read: complete — n/a')).status).toBe(0);
    expect((await run('42', 'Task #1: DONE — abc')).status).toBe(0);
    const lines = fs.readFileSync(ledger('42'), 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z Phase read: complete — n\/a$/);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z Task #1: DONE — abc$/);
    const at = Date.parse(lines[0].slice(0, 20));
    expect(at).toBeGreaterThan(before - 5000);
    expect(at).toBeLessThan(Date.now() + 5000);
  });

  it('does not prefix a line that already carries a timestamp', async () => {
    expect((await run('42', '2026-10-21T15:19:46Z Gate: x')).status).toBe(0);
    expect(fs.readFileSync(ledger('42'), 'utf8')).toBe('2026-10-21T15:19:46Z Gate: x\n');
  });

  it('appends: two calls give two lines in order', async () => {
    expect((await run('loop-308', '# header')).status).toBe(0);
    expect((await run('loop-308', 'Loop: PBI #1 done — url')).status).toBe(0);
    expect(readLedger(ledger('loop-308'))).toBe('# header\nLoop: PBI #1 done — url\n');
  });

  it('creates .agents/loop-308/ without a line', async () => {
    expect((await run('loop-308')).status).toBe(0);
    expect(fs.statSync(path.join(dir, '.agents', 'loop-308')).isDirectory()).toBe(true);
  });

  it.each(['loop-0', 'loop-x', 'loop-', 'loop-01', '../x', '0', '12345678901', 'loop-12345678901'])(
    'rejects %s',
    async (issue) => {
      const r = await run(issue, 'x');
      expect(r.status).toBe(1);
      expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
    }
  );

  it('refuses a symlinked progress.md', async () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.join(dir, '.agents', '42'), { recursive: true });
    fs.symlinkSync(target, ledger('42'));
    const r = await run('42', 'x');
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(readLedger(target)).toBe('secret\n');
  });

  describe('checkout lease heartbeat', () => {
    const leases = () => path.join(dir, '.agents', 'leases');
    const plant = (name: string, issue: number) => {
      fs.mkdirSync(leases(), { recursive: true });
      const old = '2026-01-01T00:00:00Z';
      const body = JSON.stringify({
        path: `/r/${name}`,
        issue,
        branch: `feat/${issue}`,
        host: 'h',
        started: old,
        heartbeat: old,
      });
      fs.writeFileSync(path.join(leases(), `${name}.json`), body);
      return body;
    };
    const read = (name: string) =>
      JSON.parse(fs.readFileSync(path.join(leases(), `${name}.json`), 'utf8'));

    it('renews the heartbeat of the lease held by -Issue and leaves the others and the other fields alone', async () => {
      plant('aaaaaaaaaaaaaaaa', 42);
      const other = plant('bbbbbbbbbbbbbbbb', 43);
      const before = Date.now();
      expect((await run('42', 'x')).status).toBe(0);
      const l = read('aaaaaaaaaaaaaaaa');
      expect(Date.parse(l.heartbeat)).toBeGreaterThan(before - 5000);
      expect(l).toMatchObject({
        path: '/r/aaaaaaaaaaaaaaaa',
        issue: 42,
        branch: 'feat/42',
        host: 'h',
        started: '2026-01-01T00:00:00Z',
      });
      expect(fs.readFileSync(path.join(leases(), 'bbbbbbbbbbbbbbbb.json'), 'utf8')).toBe(other);
      expect(fs.readdirSync(leases()).sort()).toEqual([
        'aaaaaaaaaaaaaaaa.json',
        'bbbbbbbbbbbbbbbb.json',
      ]);
    });

    it('does nothing without a lease and without a -Line', async () => {
      expect((await run('42', 'x')).status).toBe(0);
      expect(fs.existsSync(leases())).toBe(false);
      plant('aaaaaaaaaaaaaaaa', 42);
      expect((await run('42')).status).toBe(0);
      expect(read('aaaaaaaaaaaaaaaa').heartbeat).toBe('2026-01-01T00:00:00Z');
    });

    it('ignores a lease of another issue and non-numeric issues', async () => {
      plant('aaaaaaaaaaaaaaaa', 43);
      expect((await run('42', 'x')).status).toBe(0);
      expect((await run('loop-43', 'x')).status).toBe(0);
      expect(read('aaaaaaaaaaaaaaaa').heartbeat).toBe('2026-01-01T00:00:00Z');
    });

    it('survives an unreadable lease file', async () => {
      fs.mkdirSync(leases(), { recursive: true });
      fs.writeFileSync(path.join(leases(), 'broken.json'), '{not json');
      const r = await run('42', 'x');
      expect(r.status).toBe(0);
      expect(readLedger(ledger('42')).trim()).toBe('x');
    });
  });
});

describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 -Bind / -Unbind (loop marker, #375)', () => {
  let dir: string;
  let worker: PwshWorker;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-bind-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (...args: string[]) =>
    worker.run(args, {
      cwd: dir,
      env: gitCleanEnv(process.env, { DROMOS_STATE_DIR: path.join(dir, '.agents') }),
    });
  /** Marker of this checkout: <state>/current.d/<first 16 hex of the SHA-256 of the checkout path> (same key as the lease). */
  const keyOf = (checkout: string) =>
    createHash('sha256').update(checkout, 'utf8').digest('hex').slice(0, 16);
  const marker = () => path.join(dir, '.agents', 'current.d', keyOf(fs.realpathSync(dir)));
  const legacyMarker = () => path.join(dir, '.agents', 'current');
  const plant = (content: string) => {
    fs.mkdirSync(path.dirname(marker()), { recursive: true });
    fs.writeFileSync(marker(), content);
  };
  const repo = (branch: string) => {
    for (const a of [
      ['init', '-q'],
      ['symbolic-ref', 'HEAD', `refs/heads/${branch}`],
      ['commit', '-q', '--allow-empty', '-m', 'init'],
    ]) {
      const r = spawnSync(
        'git',
        [
          '-C',
          dir,
          '-c',
          'user.email=t@t',
          '-c',
          'user.name=t',
          '-c',
          'commit.gpgsign=false',
          ...a,
        ],
        { encoding: 'utf8', env: gitCleanEnv(process.env) }
      );
      if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
    }
  };
  const loopLedger = (nr = '5') => path.join(dir, '.agents', `loop-${nr}`, 'progress.md');
  const pbiLedger = (nr = '9') => path.join(dir, '.agents', nr, 'progress.md');
  const withPbi = (content = '# 9\n') => {
    fs.mkdirSync(path.dirname(pbiLedger()), { recursive: true });
    fs.writeFileSync(pbiLedger(), content);
  };
  /** Loop ledger plus the PBI 9 ledger header (the boundary writes the header before -Bind). */
  const withLoop = (content = '# loop\n', pbi = true) => {
    fs.mkdirSync(path.dirname(loopLedger()), { recursive: true });
    fs.writeFileSync(loopLedger(), content);
    if (pbi) withPbi();
  };

  it('writes the marker and records the start in the loop ledger', async () => {
    withLoop();
    const r = await run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
    expect(readLedger(loopLedger())).toBe('# loop\nLoop: PBI #9 started\n');
  });

  it('writes the PBI ledger line first when -Line is given too', async () => {
    withLoop('# loop\n', false);
    expect(
      (await run('-Issue', '9', '-Line', '# orchestrator ledger — issue #9', '-Bind', 'loop-5'))
        .status
    ).toBe(0);
    expect(readLedger(path.join(dir, '.agents', '9', 'progress.md'))).toBe(
      '# orchestrator ledger — issue #9\n'
    );
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });

  it('replaces the marker of the previous PBI at the next boundary (also after a resumed stop)', async () => {
    withLoop('# loop\nLoop: PBI #8 started\nLoop: stopped — pbi cap\n');
    plant('8 loop-5\n');
    expect((await run('-Issue', '9', '-Bind', 'loop-5')).status).toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
    expect(readLedger(loopLedger()).trimEnd().split('\n').pop()).toBe('Loop: PBI #9 started');
  });

  it.each(['adhoc', 'loop-5', '09', '0', 'x'])(
    'rejects -Issue %s with -Bind and writes no marker',
    async (issue) => {
      withLoop();
      const r = await run('-Issue', issue, '-Bind', 'loop-5');
      expect(r.status).toBe(1);
      expect(fs.existsSync(marker())).toBe(false);
      expect(readLedger(loopLedger())).toBe('# loop\n');
    }
  );

  it.each(['5', 'loop-0', 'loop-05', 'loop-x', '../loop-5', 'loop-5/x', ''])(
    'rejects -Bind %s',
    async (bind) => {
      withLoop();
      const r = await run('-Issue', '9', '-Bind', bind);
      expect(r.status).toBe(1);
      expect(fs.existsSync(marker())).toBe(false);
    }
  );

  it('refuses to bind without a loop ledger', async () => {
    const r = await run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/loop ledger/i);
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('refuses a symlinked marker and leaves its target untouched', async () => {
    withLoop();
    const target = path.join(dir, 'target');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.dirname(marker()), { recursive: true });
    fs.symlinkSync(target, marker());
    const r = await run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(readLedger(target)).toBe('secret\n');
    expect(readLedger(loopLedger())).toBe('# loop\n');
  });

  it('refuses a symlinked loop ledger', async () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, '# loop\n');
    fs.mkdirSync(path.join(dir, '.agents', 'loop-5'), { recursive: true });
    fs.symlinkSync(target, loopLedger());
    const r = await run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(1);
    expect(readLedger(target)).toBe('# loop\n');
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('refuses a symlinked .agents directory', async () => {
    const real = path.join(dir, 'real');
    fs.mkdirSync(path.join(real, 'loop-5'), { recursive: true });
    fs.writeFileSync(path.join(real, 'loop-5', 'progress.md'), '# loop\n');
    fs.symlinkSync(real, path.join(dir, '.agents'));
    const r = await run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(1);
    expect(fs.existsSync(path.join(real, 'current.d'))).toBe(false);
  });

  it('fails without a PBI ledger and writes nothing (no marker, no start line, no PBI directory)', async () => {
    withLoop('# loop\n', false);
    const r = await run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/PBI ledger/);
    expect(fs.existsSync(marker())).toBe(false);
    expect(readLedger(loopLedger())).toBe('# loop\n');
    expect(fs.existsSync(path.join(dir, '.agents', '9'))).toBe(false);
  });

  it('creates the PBI ledger with -Line in the same call, then binds', async () => {
    withLoop('# loop\n', false);
    expect((await run('-Issue', '9', '-Line', '# 9', '-Bind', 'loop-5')).status).toBe(0);
    expect(readLedger(pbiLedger())).toBe('# 9\n');
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });

  it('a failing -Bind with -Line does not create the PBI ledger when the loop ledger is missing', async () => {
    const r = await run('-Issue', '9', '-Line', '# 9', '-Bind', 'loop-5');
    expect(r.status).toBe(1);
    expect(fs.existsSync(path.join(dir, '.agents', '9'))).toBe(false);
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('a failing -Bind with -Line leaves the PBI ledger unchanged when the marker is a symlink', async () => {
    withLoop();
    const target = path.join(dir, 'target');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.dirname(marker()), { recursive: true });
    fs.symlinkSync(target, marker());
    expect((await run('-Issue', '9', '-Line', 'more', '-Bind', 'loop-5')).status).toBe(1);
    expect(readLedger(pbiLedger())).toBe('# 9\n');
    expect(readLedger(loopLedger())).toBe('# loop\n');
    expect(readLedger(target)).toBe('secret\n');
  });

  it('a failing -Bind with -Line leaves the PBI ledger unchanged when the marker is a directory', async () => {
    withLoop();
    fs.mkdirSync(marker(), { recursive: true });
    const r = await run('-Issue', '9', '-Line', 'more', '-Bind', 'loop-5');
    expect(r.status).toBe(1);
    expect(readLedger(pbiLedger())).toBe('# 9\n');
    expect(readLedger(loopLedger())).toBe('# loop\n');
    expect(fs.statSync(marker()).isDirectory()).toBe(true);
  });

  it('-Bind refuses a directory marker without -Line too', async () => {
    withLoop();
    fs.mkdirSync(marker(), { recursive: true });
    expect((await run('-Issue', '9', '-Bind', 'loop-5')).status).toBe(1);
    expect(readLedger(loopLedger())).toBe('# loop\n');
  });

  it('-Unbind refuses a symlinked .agents and keeps the marker behind it', async () => {
    const real = path.join(dir, 'real');
    fs.mkdirSync(real);
    fs.mkdirSync(path.join(real, 'current.d'));
    fs.writeFileSync(path.join(real, 'current.d', keyOf(fs.realpathSync(dir))), '9 loop-5\n');
    fs.symlinkSync(real, path.join(dir, '.agents'));
    const r = await run('-Unbind');
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(readLedger(path.join(real, 'current.d', keyOf(fs.realpathSync(dir))))).toBe(
      '9 loop-5\n'
    );
  });

  it('-Unbind leaves a directory named current alone and exits 0', async () => {
    fs.mkdirSync(marker(), { recursive: true });
    fs.writeFileSync(path.join(marker(), 'keep'), 'x');
    expect((await run('-Unbind')).status).toBe(0);
    expect(readLedger(path.join(marker(), 'keep'))).toBe('x');
  });

  it.each([
    ['fix/12-x', '9 loop-5 12\n'],
    ['Feat/scope/12-x', '9 loop-5 12\n'],
    ['feat/9-x', '9 loop-5\n'],
    ['release/next', '9 loop-5\n'],
    ['main', '9 loop-5\n'],
    ['fix/012-x', '9 loop-5\n'],
    ['fix/12x', '9 loop-5\n'],
  ])('records the issue number of the branch %s in the marker', async (branch, expected) => {
    repo(branch);
    withLoop();
    expect((await run('-Issue', '9', '-Bind', 'loop-5')).status).toBe(0);
    expect(readLedger(marker())).toBe(expected);
  });

  it('writes the two-field marker in a directory outside any repository', async () => {
    expect(
      spawnSync('git', ['-C', dir, 'rev-parse', '--git-dir'], { env: gitCleanEnv(process.env) })
        .status
    ).not.toBe(0);
    withLoop();
    const r = await run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });

  // Single spawn on purpose: git must be absent from PATH for the whole process, which the shared worker cannot give.
  it('writes the two-field marker when git is not on the PATH', () => {
    repo('fix/12-x');
    withLoop();
    const pwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '(Get-Process -Id $PID).Path'], {
      encoding: 'utf8',
    }).stdout.trim();
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-nogit-'));
    try {
      const env = {
        ...gitCleanEnv(process.env, { DROMOS_STATE_DIR: path.join(dir, '.agents') }),
        PATH: bin,
      };
      expect(
        spawnSync(
          pwsh,
          ['-NoProfile', '-Command', 'if (Get-Command git -ErrorAction Ignore) { exit 1 }'],
          { env }
        ).status
      ).toBe(0);
      const r = spawnSync(pwsh, ['-NoProfile', '-File', SCRIPT, '-Issue', '9', '-Bind', 'loop-5'], {
        cwd: dir,
        encoding: 'utf8',
        env,
      });
      expect(r.status).toBe(0);
      expect(readLedger(marker())).toBe('9 loop-5\n');
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });

  it('writes the two-field marker on a detached HEAD', async () => {
    repo('fix/12-x');
    spawnSync('git', ['-C', dir, 'checkout', '-q', '--detach'], { env: gitCleanEnv(process.env) });
    withLoop();
    expect((await run('-Issue', '9', '-Bind', 'loop-5')).status).toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });

  it('a failing -Bind with -Line leaves the PBI ledger unchanged when the loop ledger is a symlink', async () => {
    withPbi();
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, '# loop\n');
    fs.mkdirSync(path.join(dir, '.agents', 'loop-5'), { recursive: true });
    fs.symlinkSync(target, loopLedger());
    expect((await run('-Issue', '9', '-Line', 'more', '-Bind', 'loop-5')).status).toBe(1);
    expect(readLedger(pbiLedger())).toBe('# 9\n');
    expect(readLedger(target)).toBe('# loop\n');
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('-Unbind removes the marker', async () => {
    withLoop();
    plant('9 loop-5\n');
    fs.writeFileSync(legacyMarker(), '9 loop-5\n');
    expect((await run('-Unbind')).status).toBe(0);
    expect(fs.existsSync(marker())).toBe(false);
    expect(fs.existsSync(legacyMarker())).toBe(false);
    expect(readLedger(loopLedger())).toBe('# loop\n');
  });

  it('-Unbind is a no-op without a marker (and without .agents)', async () => {
    expect((await run('-Unbind')).status).toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
  });

  it('-Unbind refuses a symlinked marker and keeps its target', async () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    const target = path.join(dir, 'target');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.dirname(marker()), { recursive: true });
    fs.symlinkSync(target, marker());
    const r = await run('-Unbind');
    expect(r.status).toBe(1);
    expect(readLedger(target)).toBe('secret\n');
  });

  it('-Unbind cannot be combined with -Issue, -Line or -Bind', async () => {
    withLoop();
    plant('9 loop-5\n');
    expect((await run('-Unbind', '-Issue', '9')).status).toBe(1);
    expect((await run('-Unbind', '-Bind', 'loop-5')).status).toBe(1);
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });
});

describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 state directory (#402)', () => {
  let root: string;
  let main: string;
  let worker: PwshWorker;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  const cleanEnv = (extra: Record<string, string> = {}) => {
    const env = gitCleanEnv(process.env, extra);
    if (!('DROMOS_STATE_DIR' in extra)) delete env.DROMOS_STATE_DIR;
    return env;
  };
  const git = (cwd: string, ...a: string[]) => {
    const r = spawnSync(
      'git',
      ['-C', cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a],
      { encoding: 'utf8', env: cleanEnv() }
    );
    if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
  };
  const run = (cwd: string, extra: Record<string, string> = {}, ...args: string[]) =>
    worker.run(['-Issue', '7', '-Line', 'x', ...args], { cwd, env: cleanEnv(extra) });
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-state-')));
    main = path.join(root, 'main');
    fs.mkdirSync(main);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const initRepo = () => {
    git(main, 'init', '-q');
    git(main, 'commit', '-q', '--allow-empty', '-m', 'init');
  };

  it('writes into <git common dir>/agents and prints the ledger path', async () => {
    initRepo();
    const r = await run(main);
    const expected = path.join(main, '.git', 'agents', '7', 'progress.md');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(expected);
    expect(readLedger(expected)).toBe('x\n');
    expect(fs.existsSync(path.join(main, '.agents'))).toBe(false);
  });

  it('a linked worktree writes into the main checkout git dir', async () => {
    initRepo();
    const wt = path.join(root, 'wt');
    git(main, 'worktree', 'add', '-q', '-b', 'feat/7-x', wt);
    const r = await run(wt);
    const expected = path.join(main, '.git', 'agents', '7', 'progress.md');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(expected);
    expect(readLedger(expected)).toBe('x\n');
    expect(fs.existsSync(path.join(wt, '.agents'))).toBe(false);
  });

  it('DROMOS_STATE_DIR overrides the git location, relative paths resolve against the cwd', async () => {
    initRepo();
    const abs = path.join(root, 'state');
    expect((await run(main, { DROMOS_STATE_DIR: abs })).status).toBe(0);
    expect(readLedger(path.join(abs, '7', 'progress.md'))).toBe('x\n');
    expect((await run(main, { DROMOS_STATE_DIR: 'rel/state' })).status).toBe(0);
    expect(fs.existsSync(path.join(main, 'rel', 'state', '7', 'progress.md'))).toBe(true);
    expect(fs.existsSync(path.join(main, '.git', 'agents'))).toBe(false);
  });

  it('accepts DROMOS_STATE_DIR with a trailing slash', async () => {
    initRepo();
    const abs = path.join(root, 'state');
    const r = await run(main, { DROMOS_STATE_DIR: abs + '/' });
    expect(r.status, r.stderr).toBe(0);
    expect(readLedger(path.join(abs, '7', 'progress.md'))).toBe('x\n');
  });

  it('exits 1 with a message outside a repository without DROMOS_STATE_DIR', async () => {
    const r = await run(main);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(
      /No state directory: not inside a git repository \(set DROMOS_STATE_DIR\)/
    );
  });

  it('refuses a symlinked state directory', async () => {
    const real = path.join(root, 'real');
    fs.mkdirSync(real);
    const link = path.join(root, 'link');
    fs.symlinkSync(real, link);
    const r = await run(main, { DROMOS_STATE_DIR: link });
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(fs.readdirSync(real)).toEqual([]);
  });
});
