import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readLedger, gitCleanEnv } from '../hooks/ledger-test-helpers';

const SCRIPT = path.resolve(__dirname, '../../../packages/github/.apm/skills/github-issue/scripts/Add-LedgerLine.ps1');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

it('pwsh is installed in CI (the Add-LedgerLine cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 -Issue', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (issue: string, line?: string) =>
    spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Issue', issue, ...(line === undefined ? [] : ['-Line', line])], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, DROMOS_STATE_DIR: path.join(dir, '.agents') },
    });
  const ledger = (issue: string) => path.join(dir, '.agents', issue, 'progress.md');

  it.each(['loop-308', '42', 'adhoc'])('accepts %s and appends the line', (issue) => {
    const r = run(issue, 'hello');
    expect(r.status).toBe(0);
    expect(readLedger(ledger(issue)).trim()).toBe('hello');
  });

  it('prefixes every line with an ISO-8601 UTC timestamp', () => {
    const before = Date.now();
    expect(run('42', 'Phase read: complete — n/a').status).toBe(0);
    expect(run('42', 'Task #1: DONE — abc').status).toBe(0);
    const lines = fs.readFileSync(ledger('42'), 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z Phase read: complete — n\/a$/);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z Task #1: DONE — abc$/);
    const at = Date.parse(lines[0].slice(0, 20));
    expect(at).toBeGreaterThan(before - 5000);
    expect(at).toBeLessThan(Date.now() + 5000);
  });

  it('does not prefix a line that already carries a timestamp', () => {
    expect(run('42', '2026-10-21T15:19:46Z Gate: x').status).toBe(0);
    expect(fs.readFileSync(ledger('42'), 'utf8')).toBe('2026-10-21T15:19:46Z Gate: x\n');
  });

  it('appends: two calls give two lines in order', () => {
    expect(run('loop-308', '# header').status).toBe(0);
    expect(run('loop-308', 'Loop: PBI #1 done — url').status).toBe(0);
    expect(readLedger(ledger('loop-308'))).toBe('# header\nLoop: PBI #1 done — url\n');
  });

  it('creates .agents/loop-308/ without a line', () => {
    expect(run('loop-308').status).toBe(0);
    expect(fs.statSync(path.join(dir, '.agents', 'loop-308')).isDirectory()).toBe(true);
  });

  it.each(['loop-0', 'loop-x', 'loop-', 'loop-01', '../x', '0', '12345678901', 'loop-12345678901'])('rejects %s', (issue) => {
    const r = run(issue, 'x');
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
  });

  it('refuses a symlinked progress.md', () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.join(dir, '.agents', '42'), { recursive: true });
    fs.symlinkSync(target, ledger('42'));
    const r = run('42', 'x');
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(readLedger(target)).toBe('secret\n');
  });
});

describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 -Bind / -Unbind (loop marker, #375)', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-bind-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (...args: string[]) => spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: gitCleanEnv(process.env, { DROMOS_STATE_DIR: path.join(dir, '.agents') }) });
  const marker = () => path.join(dir, '.agents', 'current');
  const repo = (branch: string) => {
    for (const a of [['init', '-q'], ['symbolic-ref', 'HEAD', `refs/heads/${branch}`], ['commit', '-q', '--allow-empty', '-m', 'init']]) {
      const r = spawnSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', env: gitCleanEnv(process.env) });
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

  it('writes the marker and records the start in the loop ledger', () => {
    withLoop();
    const r = run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
    expect(readLedger(loopLedger())).toBe('# loop\nLoop: PBI #9 started\n');
  });

  it('writes the PBI ledger line first when -Line is given too', () => {
    withLoop('# loop\n', false);
    expect(run('-Issue', '9', '-Line', '# orchestrator ledger — issue #9', '-Bind', 'loop-5').status).toBe(0);
    expect(readLedger(path.join(dir, '.agents', '9', 'progress.md'))).toBe('# orchestrator ledger — issue #9\n');
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });

  it('replaces the marker of the previous PBI at the next boundary (also after a resumed stop)', () => {
    withLoop('# loop\nLoop: PBI #8 started\nLoop: stopped — pbi cap\n');
    fs.writeFileSync(marker(), '8 loop-5\n');
    expect(run('-Issue', '9', '-Bind', 'loop-5').status).toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
    expect(readLedger(loopLedger()).trimEnd().split('\n').pop()).toBe('Loop: PBI #9 started');
  });

  it.each(['adhoc', 'loop-5', '09', '0', 'x'])('rejects -Issue %s with -Bind and writes no marker', (issue) => {
    withLoop();
    const r = run('-Issue', issue, '-Bind', 'loop-5');
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(marker())).toBe(false);
    expect(readLedger(loopLedger())).toBe('# loop\n');
  });

  it.each(['5', 'loop-0', 'loop-05', 'loop-x', '../loop-5', 'loop-5/x', ''])('rejects -Bind %s', (bind) => {
    withLoop();
    const r = run('-Issue', '9', '-Bind', bind);
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('refuses to bind without a loop ledger', () => {
    const r = run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/loop ledger/i);
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('refuses a symlinked marker and leaves its target untouched', () => {
    withLoop();
    const target = path.join(dir, 'target');
    fs.writeFileSync(target, 'secret\n');
    fs.symlinkSync(target, marker());
    const r = run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(readLedger(target)).toBe('secret\n');
    expect(readLedger(loopLedger())).toBe('# loop\n');
  });

  it('refuses a symlinked loop ledger', () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, '# loop\n');
    fs.mkdirSync(path.join(dir, '.agents', 'loop-5'), { recursive: true });
    fs.symlinkSync(target, loopLedger());
    const r = run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).not.toBe(0);
    expect(readLedger(target)).toBe('# loop\n');
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('refuses a symlinked .agents directory', () => {
    const real = path.join(dir, 'real');
    fs.mkdirSync(path.join(real, 'loop-5'), { recursive: true });
    fs.writeFileSync(path.join(real, 'loop-5', 'progress.md'), '# loop\n');
    fs.symlinkSync(real, path.join(dir, '.agents'));
    const r = run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(real, 'current'))).toBe(false);
  });

  it('fails without a PBI ledger and writes nothing (no marker, no start line, no PBI directory)', () => {
    withLoop('# loop\n', false);
    const r = run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/PBI ledger/);
    expect(fs.existsSync(marker())).toBe(false);
    expect(readLedger(loopLedger())).toBe('# loop\n');
    expect(fs.existsSync(path.join(dir, '.agents', '9'))).toBe(false);
  });

  it('creates the PBI ledger with -Line in the same call, then binds', () => {
    withLoop('# loop\n', false);
    expect(run('-Issue', '9', '-Line', '# 9', '-Bind', 'loop-5').status).toBe(0);
    expect(readLedger(pbiLedger())).toBe('# 9\n');
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });

  it('a failing -Bind with -Line does not create the PBI ledger when the loop ledger is missing', () => {
    const r = run('-Issue', '9', '-Line', '# 9', '-Bind', 'loop-5');
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents', '9'))).toBe(false);
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('a failing -Bind with -Line leaves the PBI ledger unchanged when the marker is a symlink', () => {
    withLoop();
    const target = path.join(dir, 'target');
    fs.writeFileSync(target, 'secret\n');
    fs.symlinkSync(target, marker());
    expect(run('-Issue', '9', '-Line', 'more', '-Bind', 'loop-5').status).not.toBe(0);
    expect(readLedger(pbiLedger())).toBe('# 9\n');
    expect(readLedger(loopLedger())).toBe('# loop\n');
    expect(readLedger(target)).toBe('secret\n');
  });

  it('a failing -Bind with -Line leaves the PBI ledger unchanged when the marker is a directory', () => {
    withLoop();
    fs.mkdirSync(marker());
    const r = run('-Issue', '9', '-Line', 'more', '-Bind', 'loop-5');
    expect(r.status).not.toBe(0);
    expect(readLedger(pbiLedger())).toBe('# 9\n');
    expect(readLedger(loopLedger())).toBe('# loop\n');
    expect(fs.statSync(marker()).isDirectory()).toBe(true);
  });

  it('-Bind refuses a directory marker without -Line too', () => {
    withLoop();
    fs.mkdirSync(marker());
    expect(run('-Issue', '9', '-Bind', 'loop-5').status).not.toBe(0);
    expect(readLedger(loopLedger())).toBe('# loop\n');
  });

  it('-Unbind refuses a symlinked .agents and keeps the marker behind it', () => {
    const real = path.join(dir, 'real');
    fs.mkdirSync(real);
    fs.writeFileSync(path.join(real, 'current'), '9 loop-5\n');
    fs.symlinkSync(real, path.join(dir, '.agents'));
    const r = run('-Unbind');
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(readLedger(path.join(real, 'current'))).toBe('9 loop-5\n');
  });

  it('-Unbind leaves a directory named current alone and exits 0', () => {
    fs.mkdirSync(marker(), { recursive: true });
    fs.writeFileSync(path.join(marker(), 'keep'), 'x');
    expect(run('-Unbind').status).toBe(0);
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
  ])('records the issue number of the branch %s in the marker', (branch, expected) => {
    repo(branch);
    withLoop();
    expect(run('-Issue', '9', '-Bind', 'loop-5').status).toBe(0);
    expect(readLedger(marker())).toBe(expected);
  });

  it('writes the two-field marker in a directory outside any repository', () => {
    expect(spawnSync('git', ['-C', dir, 'rev-parse', '--git-dir'], { env: gitCleanEnv(process.env) }).status).not.toBe(0);
    withLoop();
    const r = run('-Issue', '9', '-Bind', 'loop-5');
    expect(r.status).toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });

  it('writes the two-field marker when git is not on the PATH', () => {
    repo('fix/12-x');
    withLoop();
    const pwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '(Get-Process -Id $PID).Path'], { encoding: 'utf8' }).stdout.trim();
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-nogit-'));
    try {
      const env = { ...gitCleanEnv(process.env, { DROMOS_STATE_DIR: path.join(dir, '.agents') }), PATH: bin };
      expect(spawnSync(pwsh, ['-NoProfile', '-Command', 'if (Get-Command git -ErrorAction Ignore) { exit 1 }'], { env }).status).toBe(0);
      const r = spawnSync(pwsh, ['-NoProfile', '-File', SCRIPT, '-Issue', '9', '-Bind', 'loop-5'], { cwd: dir, encoding: 'utf8', env });
      expect(r.status).toBe(0);
      expect(readLedger(marker())).toBe('9 loop-5\n');
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });

  it('writes the two-field marker on a detached HEAD', () => {
    repo('fix/12-x');
    spawnSync('git', ['-C', dir, 'checkout', '-q', '--detach'], { env: gitCleanEnv(process.env) });
    withLoop();
    expect(run('-Issue', '9', '-Bind', 'loop-5').status).toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });

  it('a failing -Bind with -Line leaves the PBI ledger unchanged when the loop ledger is a symlink', () => {
    withPbi();
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, '# loop\n');
    fs.mkdirSync(path.join(dir, '.agents', 'loop-5'), { recursive: true });
    fs.symlinkSync(target, loopLedger());
    expect(run('-Issue', '9', '-Line', 'more', '-Bind', 'loop-5').status).not.toBe(0);
    expect(readLedger(pbiLedger())).toBe('# 9\n');
    expect(readLedger(target)).toBe('# loop\n');
    expect(fs.existsSync(marker())).toBe(false);
  });

  it('-Unbind removes the marker', () => {
    withLoop();
    fs.writeFileSync(marker(), '9 loop-5\n');
    expect(run('-Unbind').status).toBe(0);
    expect(fs.existsSync(marker())).toBe(false);
    expect(readLedger(loopLedger())).toBe('# loop\n');
  });

  it('-Unbind is a no-op without a marker (and without .agents)', () => {
    expect(run('-Unbind').status).toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
  });

  it('-Unbind refuses a symlinked marker and keeps its target', () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    const target = path.join(dir, 'target');
    fs.writeFileSync(target, 'secret\n');
    fs.symlinkSync(target, marker());
    const r = run('-Unbind');
    expect(r.status).not.toBe(0);
    expect(readLedger(target)).toBe('secret\n');
  });

  it('-Unbind cannot be combined with -Issue, -Line or -Bind', () => {
    withLoop();
    fs.writeFileSync(marker(), '9 loop-5\n');
    expect(run('-Unbind', '-Issue', '9').status).not.toBe(0);
    expect(run('-Unbind', '-Bind', 'loop-5').status).not.toBe(0);
    expect(readLedger(marker())).toBe('9 loop-5\n');
  });
});

describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 state directory (#402)', () => {
  let root: string;
  let main: string;
  const cleanEnv = (extra: Record<string, string> = {}) => {
    const env = gitCleanEnv(process.env, extra);
    if (!('DROMOS_STATE_DIR' in extra)) delete env.DROMOS_STATE_DIR;
    return env;
  };
  const git = (cwd: string, ...a: string[]) => {
    const r = spawnSync('git', ['-C', cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', env: cleanEnv() });
    if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
  };
  const run = (cwd: string, extra: Record<string, string> = {}, ...args: string[]) =>
    spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Issue', '7', '-Line', 'x', ...args], { cwd, encoding: 'utf8', env: cleanEnv(extra) });
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

  it('writes into <git common dir>/agents and prints the ledger path', () => {
    initRepo();
    const r = run(main);
    const expected = path.join(main, '.git', 'agents', '7', 'progress.md');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(expected);
    expect(readLedger(expected)).toBe('x\n');
    expect(fs.existsSync(path.join(main, '.agents'))).toBe(false);
  });

  it('a linked worktree writes into the main checkout git dir', () => {
    initRepo();
    const wt = path.join(root, 'wt');
    git(main, 'worktree', 'add', '-q', '-b', 'feat/7-x', wt);
    const r = run(wt);
    const expected = path.join(main, '.git', 'agents', '7', 'progress.md');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(expected);
    expect(readLedger(expected)).toBe('x\n');
    expect(fs.existsSync(path.join(wt, '.agents'))).toBe(false);
  });

  it('DROMOS_STATE_DIR overrides the git location, relative paths resolve against the cwd', () => {
    initRepo();
    const abs = path.join(root, 'state');
    expect(run(main, { DROMOS_STATE_DIR: abs }).status).toBe(0);
    expect(readLedger(path.join(abs, '7', 'progress.md'))).toBe('x\n');
    expect(run(main, { DROMOS_STATE_DIR: 'rel/state' }).status).toBe(0);
    expect(fs.existsSync(path.join(main, 'rel', 'state', '7', 'progress.md'))).toBe(true);
    expect(fs.existsSync(path.join(main, '.git', 'agents'))).toBe(false);
  });

  it('accepts DROMOS_STATE_DIR with a trailing slash', () => {
    initRepo();
    const abs = path.join(root, 'state');
    const r = run(main, { DROMOS_STATE_DIR: abs + '/' });
    expect(r.status, r.stderr).toBe(0);
    expect(readLedger(path.join(abs, '7', 'progress.md'))).toBe('x\n');
  });

  it('exits 1 with a message outside a repository without DROMOS_STATE_DIR', () => {
    const r = run(main);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/No state directory: not inside a git repository \(set DROMOS_STATE_DIR\)/);
  });

  it('refuses a symlinked state directory', () => {
    const real = path.join(root, 'real');
    fs.mkdirSync(real);
    const link = path.join(root, 'link');
    fs.symlinkSync(real, link);
    const r = run(main, { DROMOS_STATE_DIR: link });
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(fs.readdirSync(real)).toEqual([]);
  });
});
