import { spawn, spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readLedger, gitCleanEnv } from '../hooks/ledger-test-helpers';

const SCRIPTS = path.resolve(__dirname, '../../../packages/github/.apm/skills/github-issue/scripts');
const SCRIPT = path.join(SCRIPTS, 'Add-LedgerLine.ps1');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 marker per checkout (#466)', () => {
  let root: string;
  let main: string;
  let wt: string;
  let state: string;
  const git = (cwd: string, ...a: string[]) => {
    const r = spawnSync('git', ['-C', cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', env: gitCleanEnv(process.env) });
    if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
  };
  const key = (p: string) => createHash('sha256').update(p, 'utf8').digest('hex').slice(0, 16);
  const run = (cwd: string, ...args: string[]) => spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], { cwd, encoding: 'utf8', env: gitCleanEnv(process.env) });
  const marker = (checkout: string) => path.join(state, 'current.d', key(checkout));
  const ledger = (nr: string, body: string) => {
    fs.mkdirSync(path.join(state, nr), { recursive: true });
    fs.writeFileSync(path.join(state, nr, 'progress.md'), body);
  };
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-co-')));
    main = path.join(root, 'main');
    wt = path.join(main, '.worktrees', '9');
    fs.mkdirSync(main);
    git(main, 'init', '-q');
    fs.writeFileSync(path.join(main, '.gitignore'), '.worktrees/\n');
    git(main, 'add', '.gitignore');
    git(main, 'commit', '-q', '-m', 'init');
    git(main, 'worktree', 'add', '-q', '-b', 'feat/9-x', wt);
    state = path.join(main, '.git', 'agents');
    ledger('loop-5', '# loop\n');
    ledger('loop-6', '# loop\n');
    ledger('9', '# 9\n');
    ledger('8', '# 8\n');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('binds the checkout of the caller: main and worktree get their own marker', () => {
    expect(run(main, '-Issue', '8', '-Bind', 'loop-5').status).toBe(0);
    expect(run(wt, '-Issue', '9', '-Bind', 'loop-6').status).toBe(0);
    expect(readLedger(marker(main))).toBe('8 loop-5\n');
    expect(readLedger(marker(wt))).toBe('9 loop-6\n');
    expect(fs.existsSync(path.join(state, 'current'))).toBe(false);
  });

  it('uses the git top level of a subdirectory as the checkout', () => {
    fs.mkdirSync(path.join(wt, 'sub'));
    expect(run(path.join(wt, 'sub'), '-Issue', '9', '-Bind', 'loop-6').status).toBe(0);
    expect(fs.existsSync(marker(wt))).toBe(true);
  });

  it('-Unbind removes only the marker of its own checkout', () => {
    expect(run(main, '-Issue', '8', '-Bind', 'loop-5').status).toBe(0);
    expect(run(wt, '-Issue', '9', '-Bind', 'loop-6').status).toBe(0);
    expect(run(wt, '-Unbind').status).toBe(0);
    expect(fs.existsSync(marker(wt))).toBe(false);
    expect(fs.existsSync(marker(main))).toBe(true);
  });

  it('-Unbind also removes the legacy marker <state>/current', () => {
    fs.writeFileSync(path.join(state, 'current'), '8 loop-5\n');
    expect(run(main, '-Unbind').status).toBe(0);
    expect(fs.existsSync(path.join(state, 'current'))).toBe(false);
  });

  it('refuses a symlinked current.d', () => {
    const real = path.join(root, 'real');
    fs.mkdirSync(real);
    fs.symlinkSync(real, path.join(state, 'current.d'));
    expect(run(main, '-Issue', '8', '-Bind', 'loop-5').status).not.toBe(0);
    expect(fs.readdirSync(real)).toEqual([]);
    expect(run(main, '-Unbind').status).not.toBe(0);
  });

  it('the key equals the lease key written by Enter-Checkout.ps1 for the same checkout', () => {
    const origin = path.join(root, 'origin.git');
    git(root, 'init', '-q', '--bare', '-b', 'main', origin);
    git(main, 'remote', 'add', 'origin', origin);
    git(main, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
    const enter = path.join(SCRIPTS, 'Enter-Checkout.ps1');
    const r = spawnSync('pwsh', ['-NoProfile', '-File', enter, '-Issue', '8', '-Branch', 'feat/8-x', '-Base', 'main'], { cwd: main, encoding: 'utf8', env: gitCleanEnv(process.env) });
    expect(r.status, r.stderr).toBe(0);
    expect(path.basename(JSON.parse(r.stdout.trim()).lease as string)).toBe(`${key(main)}.json`);
    // and for a worktree created by Enter-Checkout (main is now busy)
    const r2 = spawnSync('pwsh', ['-NoProfile', '-File', enter, '-Issue', '7', '-Branch', 'feat/7-x', '-Base', 'main'], { cwd: main, encoding: 'utf8', env: gitCleanEnv(process.env) });
    expect(r2.status, r2.stderr).toBe(0);
    const out = JSON.parse(r2.stdout.trim());
    expect(out.worktree).toBe(true);
    expect(path.basename(out.lease)).toBe(`${key(out.path)}.json`);
    ledger('7', '# 7\n');
    expect(run(out.path, '-Issue', '7', '-Bind', 'loop-5').status).toBe(0);
    expect(fs.existsSync(marker(out.path))).toBe(true);
  });
});

describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 concurrent appends (#466)', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-conc-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('8 parallel writers x 50 lines: no lost and no interleaved line', async () => {
    const WRITERS = 8;
    const LINES = 50;
    const pad = 'x'.repeat(300); // long lines make a torn write visible
    const env = { ...process.env, DROMOS_STATE_DIR: path.join(dir, 'state') };
    const spawnWriter = (w: number) =>
      new Promise<number | null>((resolve) => {
        const cmd = `1..${LINES} | ForEach-Object { & '${SCRIPT}' -Issue 5 -Line ("w${w}-" + $_ + "-${pad}") | Out-Null }`;
        spawn('pwsh', ['-NoProfile', '-Command', cmd], { cwd: dir, env, stdio: 'ignore' }).on('exit', (code) => resolve(code));
      });
    const codes = await Promise.all(Array.from({ length: WRITERS }, (_, w) => spawnWriter(w)));
    expect(codes).toEqual(Array(WRITERS).fill(0));
    const lines = fs.readFileSync(path.join(dir, 'state', '5', 'progress.md'), 'utf8').split('\n');
    expect(lines.pop()).toBe(''); // ends with a newline
    expect(lines).toHaveLength(WRITERS * LINES);
    const seen = new Set<string>();
    for (const l of lines) {
      const m = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z (w\d)-(\d+)-x{300}$/.exec(l);
      expect(m, l.slice(0, 120)).not.toBeNull();
      seen.add(`${m![1]}-${m![2]}`);
    }
    expect(seen.size).toBe(WRITERS * LINES); // every (writer, n) exactly once
  }, 180_000);

  it('a leftover lock file of a dead process does not block a writer', () => {
    const state = path.join(dir, 'state');
    fs.mkdirSync(path.join(state, '5'), { recursive: true });
    fs.writeFileSync(path.join(state, '5', 'progress.md.lock'), '');
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Issue', '5', '-Line', 'hello'], { cwd: dir, encoding: 'utf8', env: { ...process.env, DROMOS_STATE_DIR: state } });
    expect(r.status, r.stderr).toBe(0);
    expect(readLedger(path.join(state, '5', 'progress.md'))).toBe('hello\n');
  });
});
