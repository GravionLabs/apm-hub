import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gitCleanEnv, readLedger } from './ledger-test-helpers';

// Loop marker per checkout (#466): <state>/current.d/<key>, shared scenarios for subagent-ledger.sh and the OpenCode plugin.
const HOOK = path.resolve(__dirname, '../../../packages/hooks/.apm/hooks/subagent-ledger.sh');
const PLUGIN = path.resolve(__dirname, '../../../packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts');

const key = (checkout: string) => createHash('sha256').update(checkout, 'utf8').digest('hex').slice(0, 16);
const stamp = (ms = Date.now()) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const LOOP5 = '# loop\nLoop: PBI #9 started\n';
const LOOP6 = '# loop\nLoop: PBI #8 started\n';
const OLD = new Date(2020, 1, 1);
const LINE = 'Subagent issue-reader: stopped — ok\n';

describe.each(['hook', 'plugin'] as const)('loop marker per checkout (#466): %s', (impl) => {
  let root: string;
  let main: string;
  let wt: string; // .worktrees/9, branch wip-nine (no issue number)
  let other: string; // .worktrees/other, branch wip-other, never leased
  let state: string;
  const saved = { ...process.env };

  const git = (cwd: string, ...a: string[]) => {
    const r = spawnSync('git', ['-C', cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', env: gitCleanEnv(process.env) });
    if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
  };
  const ledger = (nr: string, body = `# ${nr}\n`, mtime?: Date) => {
    const f = path.join(state, nr, 'progress.md');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
    if (mtime) fs.utimesSync(f, mtime, mtime);
    return f;
  };
  const marker = (checkout: string, content: string) => {
    fs.mkdirSync(path.join(state, 'current.d'), { recursive: true });
    fs.writeFileSync(path.join(state, 'current.d', key(checkout)), content);
  };
  const lease = (checkout: string, issue: number, heartbeat = stamp()) => {
    fs.mkdirSync(path.join(state, 'leases'), { recursive: true });
    fs.writeFileSync(path.join(state, 'leases', `${key(checkout)}.json`), JSON.stringify({ path: checkout, issue, branch: `feat/${issue}-x`, host: 'h', started: heartbeat, heartbeat }));
  };
  const stop = async (cwd: string) => {
    if (impl === 'hook') {
      const env = gitCleanEnv(process.env, { AGENTS_LEDGER: '' });
      delete env.DROMOS_STATE_DIR;
      const r = spawnSync('bash', [HOOK], { input: JSON.stringify({ cwd, agent_type: 'issue-reader', last_assistant_message: 'ok' }), encoding: 'utf8', env });
      expect(r.status).toBe(0);
      return;
    }
    const mod = await import(/* @vite-ignore */ PLUGIN);
    const h = await mod.ApmHubHooks({ directory: cwd });
    await h['tool.execute.after']({ tool: 'task', args: { subagent_type: 'issue-reader' } }, { output: '<task_result>\nok\n</task_result>' });
  };

  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'binding-')));
    main = path.join(root, 'main');
    wt = path.join(main, '.worktrees', '9');
    other = path.join(main, '.worktrees', 'other');
    fs.mkdirSync(main);
    git(main, 'init', '-q', '-b', 'main');
    git(main, 'commit', '-q', '--allow-empty', '-m', 'init');
    git(main, 'worktree', 'add', '-q', '-b', 'wip-nine', wt);
    git(main, 'worktree', 'add', '-q', '-b', 'wip-other', other);
    state = path.join(main, '.git', 'agents');
    process.env = gitCleanEnv(process.env);
    delete process.env.DROMOS_STATE_DIR;
    delete process.env.AGENTS_LEDGER;
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    process.env = { ...saved };
  });

  describe('marker of the payload checkout', () => {
    it('binds each checkout to its own PBI', async () => {
      const l8 = ledger('8', '# 8\n', OLD);
      const l9 = ledger('9', '# 9\n', OLD);
      ledger('loop-5', LOOP5);
      ledger('loop-6', LOOP6);
      marker(main, '8 loop-6\n');
      marker(wt, '9 loop-5\n');
      await stop(main);
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
      expect(readLedger(l9)).toBe('# 9\n');
      await stop(wt);
      expect(readLedger(l9)).toBe(`# 9\n${LINE}`);
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
    });

    it('uses the checkout of a subdirectory', async () => {
      const l9 = ledger('9', '# 9\n', OLD);
      ledger('8', '# 8\n');
      ledger('loop-5', LOOP5);
      marker(wt, '9 loop-5\n');
      fs.mkdirSync(path.join(wt, 'sub'));
      await stop(path.join(wt, 'sub'));
      expect(readLedger(l9)).toBe(`# 9\n${LINE}`);
    });

    it('ignores a marker of another checkout when nothing resolves it (falls back to the newest ledger)', async () => {
      const l9 = ledger('9', '# 9\n', OLD);
      const l8 = ledger('8');
      ledger('loop-5', LOOP5);
      marker(wt, '9 loop-5\n');
      await stop(main);
      expect(readLedger(l9)).toBe('# 9\n');
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
    });
  });

  describe('legacy marker <state>/current', () => {
    it('is read while current.d/ does not exist', async () => {
      const l9 = ledger('9', '# 9\n', OLD);
      ledger('8');
      ledger('loop-5', LOOP5);
      fs.writeFileSync(path.join(state, 'current'), '9 loop-5\n');
      await stop(main);
      expect(readLedger(l9)).toBe(`# 9\n${LINE}`);
    });

    it('is ignored once current.d/ exists', async () => {
      const l9 = ledger('9', '# 9\n', OLD);
      const l8 = ledger('8');
      ledger('loop-5', LOOP5);
      fs.writeFileSync(path.join(state, 'current'), '9 loop-5\n');
      fs.mkdirSync(path.join(state, 'current.d'));
      await stop(main);
      expect(readLedger(l9)).toBe('# 9\n');
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
    });
  });

  describe('newest-ledger fallback with live leases', () => {
    it('is skipped with two live leases: nothing is written', async () => {
      const l8 = ledger('8');
      const l9 = ledger('9', '# 9\n', OLD);
      lease(main, 8);
      lease(wt, 9);
      await stop(other);
      expect(readLedger(l8)).toBe('# 8\n');
      expect(readLedger(l9)).toBe('# 9\n');
    });

    it('is kept with one live lease', async () => {
      const l8 = ledger('8');
      ledger('9', '# 9\n', OLD);
      lease(main, 8);
      await stop(other);
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
    });

    it('counts only live leases: a stale second lease does not skip the fallback', async () => {
      const l8 = ledger('8');
      ledger('9', '# 9\n', OLD);
      lease(main, 8);
      lease(wt, 9, stamp(Date.now() - 3 * 3600_000));
      await stop(other);
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
    });

    it('does not apply to a branch with an issue number (the branch ledger is written)', async () => {
      git(other, 'checkout', '-q', '-b', 'feat/8-x');
      const l8 = ledger('8');
      ledger('9', '# 9\n', OLD);
      lease(main, 8);
      lease(wt, 9);
      await stop(other);
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
    });
  });

  describe('checkout resolved through the lease of the bound PBI', () => {
    it('cwd in no leased checkout: the one marker whose PBI holds a live lease', async () => {
      const l9 = ledger('9', '# 9\n', OLD);
      ledger('8');
      ledger('loop-5', LOOP5);
      marker(main, '9 loop-5\n'); // bound from the session directory, the run works in the worktree
      lease(wt, 9);
      await stop(other);
      expect(readLedger(l9)).toBe(`# 9\n${LINE}`);
    });

    it('cwd inside the leased worktree: the marker of that lease issue', async () => {
      git(wt, 'checkout', '-q', '--detach');
      const l9 = ledger('9', '# 9\n', OLD);
      ledger('8');
      ledger('loop-5', LOOP5);
      marker(main, '9 loop-5\n');
      lease(wt, 9);
      lease(main, 8); // main is leased by another run: a second live lease, the fallback would be skipped
      await stop(wt);
      expect(readLedger(l9)).toBe(`# 9\n${LINE}`);
    });

    it('a marker whose PBI holds no live lease is not resolved', async () => {
      const l9 = ledger('9', '# 9\n', OLD);
      const l8 = ledger('8');
      ledger('loop-5', LOOP5);
      marker(main, '9 loop-5\n');
      await stop(other);
      expect(readLedger(l9)).toBe('# 9\n');
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
    });

    it('two candidate markers: none is chosen, nothing is written with two live leases', async () => {
      const l8 = ledger('8');
      const l9 = ledger('9', '# 9\n', OLD);
      ledger('loop-5', LOOP5);
      ledger('loop-6', LOOP6);
      marker(main, '9 loop-5\n');
      marker(wt, '8 loop-6\n');
      const second = path.join(main, '.worktrees', 'second');
      git(main, 'worktree', 'add', '-q', '-b', 'wip-second', second);
      lease(wt, 9);
      lease(second, 8); // the main checkout (which contains `other`) is not leased: cwd is in no leased checkout
      await stop(other);
      expect(readLedger(l8)).toBe('# 8\n');
      expect(readLedger(l9)).toBe('# 9\n');
    });

    it('a symlinked current.d is never read', async () => {
      const l9 = ledger('9', '# 9\n', OLD);
      const l8 = ledger('8');
      ledger('loop-5', LOOP5);
      const real = path.join(root, 'real.d');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, key(main)), '9 loop-5\n');
      fs.symlinkSync(real, path.join(state, 'current.d'));
      await stop(main);
      expect(readLedger(l9)).toBe('# 9\n');
      expect(readLedger(l8)).toBe(`# 8\n${LINE}`);
    });
  });
});
