import { vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { BRANCHES_BOUND, BRANCHES_UNBOUND, LOOP_LEDGERS_LIVE, LOOP_LEDGERS_STALE, MARKERS_MALFORMED, gitCleanEnv } from './ledger-test-helpers';

const PLUGIN = path.resolve(__dirname, '../../packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts');

type Hooks = {
  event: (a: any) => Promise<void>;
  'tool.execute.after': (i: any, o: any) => Promise<void>;
  'chat.message': (i: any, o: any) => Promise<void>;
};

describe('opencode plugin shipping', () => {
  it('lives at the shipped path inside the hooks package', () => {
    expect(fs.existsSync(PLUGIN)).toBe(true);
    expect(path.relative(path.resolve(__dirname, '../../packages/hooks'), PLUGIN)).toBe(
      path.join('.apm', 'opencode', 'plugins', 'apm-hub-hooks.ts'),
    );
  });

  it('is not excluded by a files list in the hooks manifest', () => {
    const manifest = fs.readFileSync(path.resolve(__dirname, '../../packages/hooks/apm.yml'), 'utf8');
    expect(manifest).not.toMatch(/^files:/m);
  });
});

describe('opencode plugin apm-hub-hooks', () => {
  let dir: string;
  let ledger: string;
  const saved = { ...process.env };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-plugin-'));
    delete process.env.AGENTS_LEDGER;
    delete process.env.CONTEXT_WARN_TOKENS;
    delete process.env.CONTEXT_WARN_STEP;
    process.env = gitCleanEnv(process.env);
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    process.env = { ...saved };
  });

  // dynamic import with a variable path: the plugin lives outside the tsc rootDir
  const load = async (): Promise<Hooks> => {
    const mod = await import(/* @vite-ignore */ PLUGIN);
    return mod.ApmHubHooks({ directory: dir });
  };
  const withLedger = (issue = '7') => {
    fs.mkdirSync(path.join(dir, '.agents', issue), { recursive: true });
    ledger = path.join(dir, '.agents', issue, 'progress.md');
    fs.writeFileSync(ledger, '# ledger\n');
    return ledger;
  };
  const task = (subagent_type: unknown, output: unknown): [any, any] => [
    { tool: 'task', args: { subagent_type } },
    { output },
  ];
  const result = (s: string) => `<task id="ses_1" state="completed">\n<task_result>\n${s}\n</task_result>\n</task>`;
  const assistant = (sessionID: string, input: number, read = 0, write = 0) => ({
    event: {
      type: 'message.updated',
      properties: { sessionID, info: { role: 'assistant', sessionID, tokens: { input, output: 5, cache: { read, write } } } },
    },
  });
  const chat = async (h: Hooks, sessionID = 's1') => {
    const out = { message: { id: 'm1' }, parts: [] as any[] };
    await h['chat.message']({ sessionID, messageID: 'm1' }, out);
    return out.parts;
  };

  it('exports only the plugin function (OpenCode calls every export as a plugin)', async () => {
    const mod = await import(/* @vite-ignore */ PLUGIN);
    expect(Object.keys(mod)).toEqual(['ApmHubHooks']);
    expect(typeof mod.ApmHubHooks).toBe('function');
  });

  describe('ledger', () => {
    it('appends the line with the first result line', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after'](...task('implementer', result('Status: DONE\nmore')));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
    });

    it('truncates the summary to 120 characters', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after'](...task('explorer', result('x'.repeat(300))));
      expect(fs.readFileSync(ledger, 'utf8').split('\n')[1]).toBe(`Subagent explorer: stopped — ${'x'.repeat(120)}`);
    });

    it('writes the bare line without a result', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after'](...task('planner', ''));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent planner: stopped\n');
    });

    it('uses the newest ledger', async () => {
      const old = withLedger('1');
      fs.utimesSync(old, new Date(2020, 1, 1), new Date(2020, 1, 1));
      const fresh = withLedger('2');
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      expect(fs.readFileSync(old, 'utf8')).toBe('# ledger\n');
      expect(fs.readFileSync(fresh, 'utf8')).toContain('Subagent reviewer: stopped — APPROVE');
    });

    it('ignores a newer loop-<nr> ledger and writes to the newest PBI ledger', async () => {
      const pbi = withLedger('42');
      fs.utimesSync(pbi, new Date(2020, 1, 1), new Date(2020, 1, 1));
      const loop = withLedger('loop-7');
      const h = await load();
      await h['tool.execute.after'](...task('issue-reader', result('ok')));
      expect(fs.readFileSync(pbi, 'utf8')).toContain('Subagent issue-reader: stopped — ok');
      expect(fs.readFileSync(loop, 'utf8')).toBe('# ledger\n');
    });

    it('is a no-op when only loop ledgers exist', async () => {
      const loop = withLedger('loop-7');
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      expect(fs.readFileSync(loop, 'utf8')).toBe('# ledger\n');
    });

    it('treats a non-numeric loop-x directory as a PBI ledger', async () => {
      const odd = withLedger('loop-x');
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      expect(fs.readFileSync(odd, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped — APPROVE\n');
    });

    it('honours an AGENTS_LEDGER override pointing at a loop ledger', async () => {
      const pbi = withLedger();
      const loop = withLedger('loop-7');
      process.env.AGENTS_LEDGER = loop;
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('ok')));
      expect(fs.readFileSync(loop, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
      expect(fs.readFileSync(pbi, 'utf8')).toBe('# ledger\n');
    });

    it('honours AGENTS_LEDGER', async () => {
      withLedger();
      const other = path.join(dir, 'other.md');
      fs.writeFileSync(other, '');
      process.env.AGENTS_LEDGER = other;
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('ok')));
      expect(fs.readFileSync(other, 'utf8')).toBe('Subagent reviewer: stopped — ok\n');
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
    });

    it('skips the orchestrator in any case or namespace', async () => {
      withLedger();
      const h = await load();
      for (const n of ['orchestrator', 'Orchestrator', 'apm-hub:orchestrator', 'agents/orchestrator']) {
        await h['tool.execute.after'](...task(n, result('x')));
      }
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
    });

    it('ignores other tools', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after']({ tool: 'bash', args: { subagent_type: 'x' } }, { output: 'y' });
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
    });

    it('skips an identical last line', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped — APPROVE\n');
    });

    it('is a no-op without a ledger', async () => {
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
    });

    it('sanitizes newlines and control characters in the agent name and ignores names cut at 64', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after'](...task('evil\n- forged line\r\tx:reviewer', result('ok')));
      await h['tool.execute.after'](...task('a'.repeat(100) + ':reviewer', result('ok'))); // cut to 64, no allowlisted name left
      const fits = 'a'.repeat(55) + ':reviewer'; // exactly 64
      await h['tool.execute.after'](...task('a'.repeat(56) + ':reviewer', result('ok'))); // 65: cut to ":reviewe"
      await h['tool.execute.after'](...task(fits, result('ok')));
      const lines = fs.readFileSync(ledger, 'utf8').split('\n');
      expect(lines).toEqual(['# ledger', 'Subagent evil-forgedlinex:reviewer: stopped — ok', `Subagent ${fits}: stopped — ok`, '']);
    });

    it('replaces control characters in the summary', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after'](...task('explorer', result('a\x00b\x1bc\x7fd\u2028e')));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent explorer: stopped — a b c d e\n');
    });

    it('skips task_id header lines when there is no task_result wrapper', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after'](...task('explorer', 'task_id: ses_abc\n\nStatus: DONE'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent explorer: stopped — Status: DONE\n');
    });

    it('does not write through a symlinked progress.md', async () => {
      const target = path.join(dir, 'target.md');
      fs.writeFileSync(target, 'secret\n');
      fs.mkdirSync(path.join(dir, '.agents', '7'), { recursive: true });
      const link = path.join(dir, '.agents', '7', 'progress.md');
      fs.symlinkSync(target, link);
      const h = await load();
      await expect(h['tool.execute.after'](...task('reviewer', result('APPROVE')))).resolves.toBeUndefined();
      expect(fs.readFileSync(target, 'utf8')).toBe('secret\n');
      expect(fs.readdirSync(path.join(dir, '.agents', '7'))).toEqual(['progress.md']);
      // control: the same call writes once the link is a regular file, so the symlink is the reason for the refusal
      fs.rmSync(link);
      fs.writeFileSync(link, '# ledger\n');
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      expect(fs.readFileSync(link, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped — APPROVE\n');
    });

    it('does not write through a symlinked AGENTS_LEDGER', async () => {
      const target = path.join(dir, 'target.md');
      fs.writeFileSync(target, 'secret\n');
      const link = path.join(dir, 'link.md');
      fs.symlinkSync(target, link);
      process.env.AGENTS_LEDGER = link;
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      expect(fs.readFileSync(target, 'utf8')).toBe('secret\n');
    });

    it('never throws on malformed input', async () => {
      withLedger();
      const h = await load();
      const bad: [any, any][] = [[undefined, undefined], [null, null], [{ tool: 'task' }, {}], [{ tool: 'task', args: 5 }, { output: 5 }]];
      for (const [i, o] of bad) {
        await expect(h['tool.execute.after'](i, o)).resolves.toBeUndefined();
      }
      await expect(h.event(undefined)).resolves.toBeUndefined();
      await expect(h['chat.message'](undefined, undefined)).resolves.toBeUndefined();
    });

    it('never throws when the ledger cannot be written', async () => {
      withLedger();
      process.env.AGENTS_LEDGER = dir; // a directory
      const h = await load();
      await expect(h['tool.execute.after'](...task('reviewer', result('x')))).resolves.toBeUndefined();
    });
  });

  describe('ledger binding (#357)', () => {
    const git = (...a: string[]) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { stdio: 'ignore' });
    const repo = (branch: string) => {
      git('init', '-q');
      git('symbolic-ref', 'HEAD', `refs/heads/${branch}`); // not `init -b` (git >= 2.28)
      git('commit', '-q', '--allow-empty', '-m', 'init');
      const head = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
      expect(head).toBe(branch);
    };
    const read = (issue: string) => fs.readFileSync(path.join(dir, '.agents', issue, 'progress.md'), 'utf8');
    const run = async (name: unknown) => (await load())['tool.execute.after'](...task(name, result('ok')));

    it.each(['issue-reader', 'explorer', 'planner', 'reviewer', 'review-lead', 'implementer', 'pr-writer', 'pbi-runner'])(
      'records the allowlisted agent %s',
      async (n) => {
        withLedger();
        await run(n);
        expect(read('7')).toBe(`# ledger\nSubagent ${n}: stopped — ok\n`);
      },
    );

    it('records a namespaced allowlisted agent by its last part', async () => {
      withLedger();
      await run('agents:reviewer');
      await run('apm/Explorer');
      expect(read('7')).toBe('# ledger\nSubagent agents:reviewer: stopped — ok\nSubagent apm/Explorer: stopped — ok\n');
    });

    it.each(['general', 'subagent', 'build-helper', 'my-reviewer', 'reviewer-x', 'agents:other'])(
      'ignores the foreign agent %s',
      async (n) => {
        withLedger();
        await run(n);
        expect(read('7')).toBe('# ledger\n');
      },
    );

    it('ignores a missing subagent type', async () => {
      withLedger();
      await run(undefined);
      expect(read('7')).toBe('# ledger\n');
    });

    it('writes to the ledger of the branch issue even when another one is newer', async () => {
      repo('feat/12-thing');
      const own = withLedger('12');
      fs.utimesSync(own, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('99');
      await run('reviewer');
      expect(read('12')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
      expect(read('99')).toBe('# ledger\n');
    });

    it('writes nothing when the branch issue has no ledger', async () => {
      repo('fix/12-thing');
      withLedger('99');
      await run('reviewer');
      expect(read('99')).toBe('# ledger\n');
      expect(fs.existsSync(path.join(dir, '.agents', '12'))).toBe(false);
    });

    it('falls back to the newest non-loop ledger on a branch without a number', async () => {
      repo('main');
      const old = withLedger('1');
      fs.utimesSync(old, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('2');
      withLedger('loop-5');
      await run('reviewer');
      expect(read('1')).toBe('# ledger\n');
      expect(read('2')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
      expect(read('loop-5')).toBe('# ledger\n');
    });

    it('falls back to the newest ledger on a detached HEAD', async () => {
      repo('fix/12-thing');
      git('checkout', '-q', '--detach');
      withLedger('3');
      await run('reviewer');
      expect(read('3')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
    });

    it.each(BRANCHES_BOUND)('binds branch %s to .agents/7', async (b) => {
      repo(b);
      const own = withLedger('7');
      fs.utimesSync(own, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('99');
      await run('reviewer');
      expect(read('7')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
      expect(read('99')).toBe('# ledger\n');
    });

    it.each(BRANCHES_UNBOUND)('yields no number for branch %s (newest-ledger fallback)', async (b) => {
      repo(b);
      const old = withLedger('7');
      fs.utimesSync(old, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('99');
      await run('reviewer');
      expect(read('7')).toBe('# ledger\n');
      expect(read('99')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
    });

    it('without a .agents/current marker binds a stop to the ledger of the branch still checked out', async () => {
      repo('fix/7-x'); // no loop binding: the branch rule applies although ledger 9 is newer
      const prev = withLedger('7');
      fs.utimesSync(prev, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('9');
      await run('issue-reader');
      expect(read('7')).toBe('# ledger\nSubagent issue-reader: stopped — ok\n');
      expect(read('9')).toBe('# ledger\n');
    });

    it('does not write through a symlinked .agents directory', async () => {
      repo('fix/12-x');
      const real = path.join(dir, 'real');
      fs.mkdirSync(path.join(real, '12'), { recursive: true });
      fs.writeFileSync(path.join(real, '12', 'progress.md'), 'secret\n');
      fs.symlinkSync(real, path.join(dir, '.agents'));
      await expect(run('reviewer')).resolves.toBeUndefined();
      expect(fs.readFileSync(path.join(real, '12', 'progress.md'), 'utf8')).toBe('secret\n');
      expect(fs.readdirSync(path.join(real, '12'))).toEqual(['progress.md']);
      // control: the same tree as a real directory is written, so the symlink is the reason for the refusal
      fs.rmSync(path.join(dir, '.agents'));
      fs.cpSync(real, path.join(dir, '.agents'), { recursive: true });
      await run('reviewer');
      expect(read('12')).toBe('secret\nSubagent reviewer: stopped — ok\n');
    });

    it('writes a namespaced foreign prefix by the last name part (documented rule)', async () => {
      withLedger();
      await run('evil:reviewer');
      expect(read('7')).toBe('# ledger\nSubagent evil:reviewer: stopped — ok\n');
    });

    it('writes nothing on fix/8-x when only the loop ledger exists', async () => {
      repo('fix/8-x');
      withLedger('loop-8');
      await run('reviewer');
      expect(read('loop-8')).toBe('# ledger\n');
    });

    it('does not write through a symlinked .agents/<nr> directory', async () => {
      repo('fix/12-x');
      const real = path.join(dir, 'real');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'progress.md'), 'secret\n');
      fs.mkdirSync(path.join(dir, '.agents'));
      fs.symlinkSync(real, path.join(dir, '.agents', '12'));
      withLedger('99'); // newer fallback candidate: a refusal must not fall back to it
      await expect(run('reviewer')).resolves.toBeUndefined();
      expect(fs.readFileSync(path.join(real, 'progress.md'), 'utf8')).toBe('secret\n');
      expect(fs.readdirSync(real)).toEqual(['progress.md']);
      expect(read('99')).toBe('# ledger\n');
      // control: the same ledger in a real directory is written
      fs.rmSync(path.join(dir, '.agents', '12'));
      fs.cpSync(real, path.join(dir, '.agents', '12'), { recursive: true });
      await run('reviewer');
      expect(read('12')).toBe('secret\nSubagent reviewer: stopped — ok\n');
      expect(read('99')).toBe('# ledger\n');
    });

    it('falls back to the newest ledger when git cannot run', async () => {
      repo('fix/12-x');
      const own = withLedger('12');
      fs.utimesSync(own, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('99');
      process.env.PATH = path.join(dir, 'no-bin'); // git not found
      await run('reviewer');
      expect(read('99')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
      expect(read('12')).toBe('# ledger\n');
    });

    it('falls back to the newest ledger outside a git repository', async () => {
      const old = withLedger('12');
      fs.utimesSync(old, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('99');
      await run('reviewer');
      expect(read('99')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
    });

    /** Repo config whose fsmonitor command and hooks would create a marker file; checked live with `git status`. */
    const hostileConfig = () => {
      const marker = path.join(dir, 'MARKER');
      const hooks = path.join(dir, 'evil-hooks');
      fs.mkdirSync(hooks);
      for (const h of ['post-checkout', 'pre-commit', 'reference-transaction', 'post-index-change']) {
        fs.writeFileSync(path.join(hooks, h), `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o755 });
      }
      git('config', 'core.fsmonitor', `touch '${marker}'; echo`);
      git('config', 'core.hooksPath', hooks);
      git('status'); // positive control: this config does run the command
      expect(fs.existsSync(marker)).toBe(true);
      fs.rmSync(marker);
      return marker;
    };

    it('does not run a repository fsmonitor command or hooks and still binds to the branch issue', async () => {
      repo('fix/12-x');
      const own = withLedger('12');
      fs.utimesSync(own, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('99');
      const marker = hostileConfig();
      await run('reviewer');
      expect(fs.existsSync(marker)).toBe(false);
      expect(read('12')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
      expect(read('99')).toBe('# ledger\n');
    });

    /** Puts a `git` on PATH that runs the given shell body instead of git. */
    const brokenGit = (script = 'exit 128') => {
      const bin = path.join(dir, 'broken-bin');
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
      process.env.PATH = `${bin}${path.delimiter}${process.env.PATH ?? ''}`;
    };

    it('writes nothing when git fails inside a repository (no newest-ledger fallback)', async () => {
      repo('fix/12-x');
      const own = withLedger('12');
      fs.utimesSync(own, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('99');
      brokenGit();
      await expect(run('reviewer')).resolves.toBeUndefined();
      expect(read('12')).toBe('# ledger\n');
      expect(read('99')).toBe('# ledger\n');
    });

    it('writes nothing when git times out inside a repository', async () => {
      repo('main');
      withLedger('99');
      brokenGit('sleep 5');
      await expect(run('reviewer')).resolves.toBeUndefined();
      expect(read('99')).toBe('# ledger\n');
    }, 15000);

    it('writes nothing when git fails in a subdirectory of a repository', async () => {
      repo('main');
      const sub = path.join(dir, 'pkg');
      const l3 = path.join(sub, '.agents', '3', 'progress.md');
      fs.mkdirSync(path.dirname(l3), { recursive: true });
      fs.writeFileSync(l3, '# 3\n');
      brokenGit();
      const mod = await import(/* @vite-ignore */ PLUGIN);
      const h: Hooks = await mod.ApmHubHooks({ directory: sub });
      await h['tool.execute.after'](...task('reviewer', result('ok')));
      expect(fs.readFileSync(l3, 'utf8')).toBe('# 3\n');
    });

    it('writes nothing when real git cannot read the repository (corrupt HEAD)', async () => {
      repo('fix/12-x');
      withLedger('99');
      fs.writeFileSync(path.join(dir, '.git', 'HEAD'), 'garbage\n');
      await run('reviewer');
      expect(read('99')).toBe('# ledger\n');
    });

    it('still falls back to the newest ledger outside a repository when git fails', async () => {
      const old = withLedger('12');
      fs.utimesSync(old, new Date(2020, 1, 1), new Date(2020, 1, 1));
      withLedger('99');
      brokenGit();
      await run('reviewer');
      expect(read('99')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
      expect(read('12')).toBe('# ledger\n');
    });

    it('passes -c core.fsmonitor=false -c core.hooksPath=/dev/null to git', async () => {
      repo('fix/12-x');
      withLedger('12');
      const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
      const bin = path.join(dir, 'shim');
      const log = path.join(dir, 'git-args.log');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nprintf '%s ' "$@" >> '${log}'\nexec '${realGit}' "$@"\n`, { mode: 0o755 });
      process.env.PATH = `${bin}${path.delimiter}${process.env.PATH ?? ''}`;
      await run('reviewer');
      expect(fs.readFileSync(log, 'utf8')).toContain('-c core.fsmonitor=false -c core.hooksPath=/dev/null rev-parse');
      expect(read('12')).toBe('# ledger\nSubagent reviewer: stopped — ok\n');
    });

    it('resolves .agents under ctx.directory: a plugin opened in a repo subdirectory does not reach the root ledger', async () => {
      repo('fix/12-x');
      withLedger('12');
      const sub = path.join(dir, 'src', 'deep');
      fs.mkdirSync(sub, { recursive: true });
      const mod = await import(/* @vite-ignore */ PLUGIN);
      const h: Hooks = await mod.ApmHubHooks({ directory: sub });
      await expect(h['tool.execute.after'](...task('reviewer', result('ok')))).resolves.toBeUndefined();
      expect(read('12')).toBe('# ledger\n');
      expect(fs.existsSync(path.join(sub, '.agents'))).toBe(false);
    });

    it('binds a subdirectory ctx.directory to the branch issue ledger under that subdirectory', async () => {
      repo('fix/12-x');
      withLedger('12');
      const sub = path.join(dir, 'pkg');
      const own = path.join(sub, '.agents', '12', 'progress.md');
      const newer = path.join(sub, '.agents', '99', 'progress.md');
      for (const f of [own, newer]) {
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, '# sub\n');
      }
      fs.utimesSync(own, new Date(2020, 1, 1), new Date(2020, 1, 1));
      const mod = await import(/* @vite-ignore */ PLUGIN);
      const h: Hooks = await mod.ApmHubHooks({ directory: sub });
      await h['tool.execute.after'](...task('reviewer', result('ok')));
      expect(fs.readFileSync(own, 'utf8')).toBe('# sub\nSubagent reviewer: stopped — ok\n');
      expect(fs.readFileSync(newer, 'utf8')).toBe('# sub\n');
      expect(read('12')).toBe('# ledger\n');
    });

    it('AGENTS_LEDGER wins over the branch binding', async () => {
      repo('fix/12-thing');
      withLedger('12');
      const other = path.join(dir, 'other.md');
      fs.writeFileSync(other, '');
      process.env.AGENTS_LEDGER = other;
      await run('reviewer');
      expect(fs.readFileSync(other, 'utf8')).toBe('Subagent reviewer: stopped — ok\n');
      expect(read('12')).toBe('# ledger\n');
    });
  });

  describe('loop marker .agents/current (#375)', () => {
    const git = (...a: string[]) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { stdio: 'ignore' });
    const repo = (branch: string) => {
      git('init', '-q');
      git('symbolic-ref', 'HEAD', `refs/heads/${branch}`);
      git('commit', '-q', '--allow-empty', '-m', 'init');
    };
    const mk = (nr: string, content = `# ${nr}\n`, mtime?: Date) => {
      const f = path.join(dir, '.agents', nr, 'progress.md');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, content);
      if (mtime) fs.utimesSync(f, mtime, mtime);
      return f;
    };
    const read = (f: string) => fs.readFileSync(f, 'utf8');
    const marker = (content = '9 loop-5\n') => fs.writeFileSync(path.join(dir, '.agents', 'current'), content);
    const stop = async (name = 'issue-reader') => (await load())['tool.execute.after'](...task(name, result('ok')));
    const OLD = new Date(2020, 1, 1);
    const LOOP = '# loop\nLoop: PBI #9 started\n';
    const scenario = (loop = LOOP) => {
      repo('fix/7-x');
      const l7 = mk('7');
      const l9 = mk('9', '# 9\n', OLD);
      const lp = mk('loop-5', loop);
      return { l7, l9, lp };
    };
    const LINE = 'Subagent issue-reader: stopped — ok\n';

    it('sends a stop before the new PBI branch exists to the bound PBI, not the branch still checked out', async () => {
      const { l7, l9, lp } = scenario();
      marker();
      await stop();
      expect(read(l9)).toBe(`# 9\n${LINE}`);
      expect(read(l7)).toBe('# 7\n');
      expect(read(lp)).toBe(LOOP);
    });

    it('accepts a marker without a trailing newline', async () => {
      const { l7, l9 } = scenario();
      marker('9 loop-5');
      await stop();
      expect(read(l9)).toBe(`# 9\n${LINE}`);
      expect(read(l7)).toBe('# 7\n');
    });

    it('wins over the newest-ledger fallback on the integration branch', async () => {
      repo('release/next');
      const l9 = mk('9', '# 9\n', OLD);
      const l7 = mk('7');
      mk('loop-5', LOOP);
      marker();
      await stop();
      expect(read(l9)).toBe(`# 9\n${LINE}`);
      expect(read(l7)).toBe('# 7\n');
    });

    it('wins outside a git repository too', async () => {
      const l9 = mk('9', '# 9\n', OLD);
      const l7 = mk('7');
      mk('loop-5', LOOP);
      marker();
      await stop();
      expect(read(l9)).toBe(`# 9\n${LINE}`);
      expect(read(l7)).toBe('# 7\n');
    });

    it('loses against AGENTS_LEDGER', async () => {
      const { l7, l9 } = scenario();
      const other = mk('3');
      marker();
      process.env.AGENTS_LEDGER = other;
      await stop('reviewer');
      expect(read(other)).toBe('# 3\nSubagent reviewer: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it.each(MARKERS_MALFORMED.map((m) => [JSON.stringify(m), m]))('ignores the malformed marker %s and binds to the branch', async (_, m) => {
      const { l7, l9 } = scenario();
      marker(m);
      await stop();
      expect(read(l7)).toBe(`# 7\n${LINE}`);
      expect(read(l9)).toBe('# 9\n');
    });

    it('ignores a symlinked marker', async () => {
      const { l7, l9 } = scenario();
      const real = path.join(dir, 'real-current');
      fs.writeFileSync(real, '9 loop-5\n');
      fs.symlinkSync(real, path.join(dir, '.agents', 'current'));
      await stop();
      expect(read(l7)).toBe(`# 7\n${LINE}`);
      expect(read(l9)).toBe('# 9\n');
    });

    it('ignores a marker that is a directory', async () => {
      const { l7 } = scenario();
      fs.mkdirSync(path.join(dir, '.agents', 'current'));
      await stop();
      expect(read(l7)).toBe(`# 7\n${LINE}`);
    });

    it('ignores a marker whose PBI ledger does not exist and creates none', async () => {
      repo('fix/7-x');
      const l7 = mk('7');
      mk('loop-5', LOOP);
      marker();
      await stop();
      expect(read(l7)).toBe(`# 7\n${LINE}`);
      expect(fs.existsSync(path.join(dir, '.agents', '9'))).toBe(false);
    });

    it('ignores a marker whose loop ledger does not exist', async () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const l9 = mk('9', '# 9\n', OLD);
      marker();
      await stop();
      expect(read(l7)).toBe(`# 7\n${LINE}`);
      expect(read(l9)).toBe('# 9\n');
    });

    it.each(LOOP_LEDGERS_STALE.map((l) => [JSON.stringify(l), l]))('ignores a stale marker when the loop ledger is %s', async (_, l) => {
      const { l7, l9, lp } = scenario(l);
      marker();
      await stop();
      expect(read(l7)).toBe(`# 7\n${LINE}`);
      expect(read(l9)).toBe('# 9\n');
      expect(read(lp)).toBe(l);
    });

    it.each([...LOOP_LEDGERS_LIVE, '# loop\n'].map((l) => [JSON.stringify(l), l]))('honours the marker while the loop ledger is %s', async (_, l) => {
      const { l7, l9 } = scenario(l);
      marker();
      await stop();
      expect(read(l9)).toBe(`# 9\n${LINE}`);
      expect(read(l7)).toBe('# 7\n');
    });

    it('ignores a marker whose loop ledger is a symlink', async () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const l9 = mk('9', '# 9\n', OLD);
      const real = path.join(dir, 'real-loop.md');
      fs.writeFileSync(real, LOOP);
      fs.mkdirSync(path.join(dir, '.agents', 'loop-5'));
      fs.symlinkSync(real, path.join(dir, '.agents', 'loop-5', 'progress.md'));
      marker();
      await stop();
      expect(read(l7)).toBe(`# 7\n${LINE}`);
      expect(read(l9)).toBe('# 9\n');
    });

    it('does not write through a symlinked bound PBI directory and falls back to the branch', async () => {
      repo('fix/7-x');
      const l7 = mk('7');
      mk('loop-5', LOOP);
      const real = path.join(dir, 'real');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'progress.md'), 'secret\n');
      fs.symlinkSync(real, path.join(dir, '.agents', '9'));
      marker();
      await stop();
      expect(read(path.join(real, 'progress.md'))).toBe('secret\n');
      expect(read(l7)).toBe(`# 7\n${LINE}`);
    });

    it.each(['general', 'subagent', 'build-helper'])('writes nothing for the foreign agent %s with a valid marker', async (t) => {
      const { l7, l9, lp } = scenario();
      marker();
      await stop(t);
      expect(read(l9)).toBe('# 9\n');
      expect(read(l7)).toBe('# 7\n');
      expect(read(lp)).toBe(LOOP);
    });
  });

  describe('context warning', () => {
    it('stays silent below the threshold and without usage', async () => {
      const h = await load();
      expect(await chat(h)).toEqual([]);
      await h.event(assistant('s1', 1000, 100000));
      expect(await chat(h)).toEqual([]);
    });

    it('warns once input + cache read + cache write pass 150k', async () => {
      const h = await load();
      await h.event(assistant('s1', 1000, 140000, 10000));
      const parts = await chat(h);
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({ type: 'text', synthetic: true, sessionID: 's1', messageID: 'm1' });
      expect(parts[0].text).toContain('Context is 151k tokens (limit 150k)');
    });

    it('does not repeat until the context grew by the step, then warns again', async () => {
      const h = await load();
      await h.event(assistant('s1', 160000));
      expect(await chat(h)).toHaveLength(1);
      await h.event(assistant('s1', 200000));
      expect(await chat(h)).toEqual([]);
      await h.event(assistant('s1', 260000));
      expect(await chat(h)).toHaveLength(1);
    });

    it('resets after the context dropped below the threshold', async () => {
      const h = await load();
      await h.event(assistant('s1', 160000));
      await chat(h);
      await h.event(assistant('s1', 5000));
      await chat(h);
      await h.event(assistant('s1', 160000));
      expect(await chat(h)).toHaveLength(1);
    });

    it('tracks sessions separately and ignores user messages', async () => {
      const h = await load();
      await h.event(assistant('s1', 160000));
      await h.event({ type: 'message.updated', properties: { info: { role: 'user', sessionID: 's2', tokens: { input: 999999 } } } });
      expect(await chat(h, 's2')).toEqual([]);
      expect(await chat(h, 's1')).toHaveLength(1);
    });

    it('gives every warning part a unique id', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1234);
      try {
        const h = await load();
        await h.event(assistant('s1', 160000));
        await h.event(assistant('s2', 160000));
        const ids = [...(await chat(h, 's1')), ...(await chat(h, 's2'))].map((p) => p.id);
        expect(ids).toHaveLength(2);
        expect(new Set(ids).size).toBe(2);
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('honours CONTEXT_WARN_STEP and falls back on invalid values', async () => {
      process.env.CONTEXT_WARN_STEP = '10000';
      let h = await load();
      await h.event(assistant('s1', 160000));
      expect(await chat(h)).toHaveLength(1);
      await h.event(assistant('s1', 171000));
      expect(await chat(h)).toHaveLength(1);
      for (const bad of ['0', '-5']) {
        process.env.CONTEXT_WARN_STEP = bad;
        h = await load();
        await h.event(assistant('s1', 160000));
        expect(await chat(h)).toHaveLength(1);
        await h.event(assistant('s1', 171000));
        expect(await chat(h)).toEqual([]); // default step 100k, not 0 or negative
      }
    });

    it('falls back to 150k for invalid CONTEXT_WARN_TOKENS (0, -5) and warns at 160000', async () => {
      for (const bad of ['0', '-5']) {
        process.env.CONTEXT_WARN_TOKENS = bad;
        const h = await load();
        await h.event(assistant('s1', 100000));
        expect(await chat(h)).toEqual([]);
        await h.event(assistant('s1', 160000));
        const parts = await chat(h);
        expect(parts).toHaveLength(1);
        expect(parts[0].text).toContain('limit 150k');
      }
    });

    it('honours CONTEXT_WARN_TOKENS and falls back on invalid values', async () => {
      process.env.CONTEXT_WARN_TOKENS = '1000';
      let h = await load();
      await h.event(assistant('s1', 2000));
      expect(await chat(h)).toHaveLength(1);
      process.env.CONTEXT_WARN_TOKENS = 'abc';
      h = await load();
      await h.event(assistant('s1', 2000));
      expect(await chat(h)).toEqual([]);
    });
  });
});
