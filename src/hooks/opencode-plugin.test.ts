import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PLUGIN = path.resolve(__dirname, '../../packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts');

type Hooks = {
  event: (a: any) => Promise<void>;
  'tool.execute.after': (i: any, o: any) => Promise<void>;
  'chat.message': (i: any, o: any) => Promise<void>;
};

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

    it('writes the bare line without a result and defaults the name', async () => {
      withLedger();
      const h = await load();
      await h['tool.execute.after'](...task(undefined, ''));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent subagent: stopped\n');
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
