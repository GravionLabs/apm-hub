import { vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

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
      const lines = fs.readFileSync(ledger, 'utf8').split('\n');
      expect(lines).toEqual(['# ledger', 'Subagent evil - forged line x:reviewer: stopped — ok', '']);
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
      fs.symlinkSync(target, path.join(dir, '.agents', '7', 'progress.md'));
      const h = await load();
      await h['tool.execute.after'](...task('reviewer', result('APPROVE')));
      expect(fs.readFileSync(target, 'utf8')).toBe('secret\n');
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
    const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
    const repo = (branch: string) => {
      git('init', '-q', '-b', branch);
      git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
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
