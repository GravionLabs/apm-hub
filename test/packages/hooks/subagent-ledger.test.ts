import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readLedger, gitCleanEnv } from './ledger-test-helpers';
import { SCRIPT, useLedgerFixture } from '../../helpers/subagent-ledger-fixture';

describe('subagent-ledger hook', () => {
  const fx = useLedgerFixture();
  const { cleanEnv, withLedger, run } = fx;

  it('appends a line for a Claude payload', () => {
    withLedger();
    const r = run({
      cwd: fx.dir,
      agent_type: 'implementer',
      last_assistant_message: 'Status: DONE\nmore',
    });
    expect(r.status).toBe(0);
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('prefixes the line with an ISO-8601 UTC timestamp', () => {
    withLedger();
    const before = Date.now();
    run({ cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'Status: DONE' });
    const lines = fs.readFileSync(fx.ledger, 'utf8').trimEnd().split('\n');
    expect(lines[0]).toBe('# ledger');
    expect(lines[1]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z Subagent implementer: stopped — Status: DONE$/
    );
    expect(Math.abs(Date.parse(lines[1].slice(0, 20)) - before)).toBeLessThan(10_000);
  });

  it('skips an identical last line whether or not the ledger line carries a timestamp', () => {
    withLedger();
    fs.appendFileSync(fx.ledger, '2026-10-21T15:19:46Z Subagent reviewer: stopped\n');
    run({ cwd: fx.dir, agent_type: 'reviewer' });
    fs.writeFileSync(fx.ledger, '# ledger\nSubagent reviewer: stopped\n');
    run({ cwd: fx.dir, agent_type: 'reviewer' });
    expect(fs.readFileSync(fx.ledger, 'utf8').trimEnd().split('\n')).toHaveLength(2);
  });

  it('appends the same line format for a Copilot payload', () => {
    withLedger();
    const r = run({ cwd: fx.dir, agentType: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent reviewer: stopped — APPROVE\n');
  });

  it('ignores a newer .agents/loop-<nr>/progress.md and writes to the newest PBI ledger', () => {
    withLedger();
    const loop = path.join(fx.dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    fs.utimesSync(fx.ledger, new Date(2020, 1, 1), new Date(2020, 1, 1));
    const r = run({ cwd: fx.dir, agent_type: 'issue-reader', last_assistant_message: 'ok' });
    expect(r.status).toBe(0);
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent issue-reader: stopped — ok\n');
    expect(readLedger(loop)).toBe('# loop\n');
  });

  it('writes nothing and exits 0 when only loop ledgers exist', () => {
    const loop = path.join(fx.dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    const r = run({ cwd: fx.dir, agent_type: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(readLedger(loop)).toBe('# loop\n');
  });

  it('treats a non-numeric loop-x directory as a PBI ledger', () => {
    const odd = path.join(fx.dir, '.agents', 'loop-x', 'progress.md');
    fs.mkdirSync(path.dirname(odd), { recursive: true });
    fs.writeFileSync(odd, '# odd\n');
    run({ cwd: fx.dir, agent_type: 'reviewer', response: 'APPROVE' });
    expect(readLedger(odd)).toBe('# odd\nSubagent reviewer: stopped — APPROVE\n');
  });

  it('honours an AGENTS_LEDGER override pointing at a loop ledger', () => {
    withLedger();
    const loop = path.join(fx.dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: fx.dir, agent_type: 'reviewer', response: 'ok' }),
      encoding: 'utf8',
      env: { ...process.env, AGENTS_LEDGER: loop },
    });
    expect(r.status).toBe(0);
    expect(readLedger(loop)).toBe('# loop\nSubagent reviewer: stopped — ok\n');
    expect(readLedger(fx.ledger)).toBe('# ledger\n');
  });

  it('does not write through a symlinked progress.md or a symlinked issue directory', () => {
    const target = path.join(fx.dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.join(fx.dir, '.agents', '7'), { recursive: true });
    fs.symlinkSync(target, path.join(fx.dir, '.agents', '7', 'progress.md'));
    expect(run({ cwd: fx.dir, agent_type: 'reviewer', response: 'x' }).status).toBe(0);
    expect(readLedger(target)).toBe('secret\n');

    const outside = path.join(fx.dir, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'progress.md'), 'secret\n');
    fs.symlinkSync(outside, path.join(fx.dir, '.agents', '8'));
    expect(run({ cwd: fx.dir, agent_type: 'reviewer', response: 'x' }).status).toBe(0);
    expect(readLedger(path.join(outside, 'progress.md'))).toBe('secret\n');
  });

  it('does not write through a symlinked AGENTS_LEDGER', () => {
    const target = path.join(fx.dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    const link = path.join(fx.dir, 'link.md');
    fs.symlinkSync(target, link);
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: fx.dir, agent_type: 'reviewer', response: 'x' }),
      encoding: 'utf8',
      env: { ...process.env, AGENTS_LEDGER: link },
    });
    expect(r.status).toBe(0);
    expect(readLedger(target)).toBe('secret\n');
  });

  it('writes one line when the same payload fires twice', () => {
    withLedger();
    const payload = {
      cwd: fx.dir,
      agent_type: 'implementer',
      last_assistant_message: 'Status: DONE',
    };
    run(payload);
    run(payload);
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('writes two lines for two different payloads', () => {
    withLedger();
    run({ cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'one' });
    run({ cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'two' });
    expect(readLedger(fx.ledger)).toBe(
      '# ledger\nSubagent implementer: stopped — one\nSubagent implementer: stopped — two\n'
    );
  });

  it('accepts agentName and subagent_type as agent name', () => {
    withLedger();
    run({ cwd: fx.dir, agentName: 'explorer', response: 'x' });
    run({ cwd: fx.dir, subagent_type: 'planner', response: 'y' });
    const text = readLedger(fx.ledger);
    expect(text).toContain('Subagent explorer: stopped — x\n');
    expect(text).toContain('Subagent planner: stopped — y\n');
  });

  it('falls back to defaults and cuts the summary to 120 chars', () => {
    withLedger();
    run({ cwd: fx.dir, agent_type: 'reviewer' });
    run({ cwd: fx.dir, agent_type: 'planner', response: 'a'.repeat(200) });
    const lines = readLedger(fx.ledger).trim().split('\n');
    expect(lines[1]).toBe('Subagent reviewer: stopped');
    expect(lines[2]).toBe(`Subagent planner: stopped — ${'a'.repeat(120)}`);
  });

  it('uses the last text line of the agent transcript when the message is missing', () => {
    withLedger();
    const tp = path.join(fx.dir, 't.jsonl');
    const entry = (role: string, text: string) =>
      JSON.stringify({ type: role, message: { role, content: [{ type: 'text', text }] } });
    fs.writeFileSync(
      tp,
      [
        entry('assistant', 'first'),
        entry('user', 'q'),
        entry('assistant', 'a\nStatus: DONE\n'),
      ].join('\n') + '\n'
    );
    run({
      cwd: fx.dir,
      agent_type: 'implementer',
      last_assistant_message: '',
      agent_transcript_path: tp,
    });
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('falls back to the newest report path when message and transcript are missing', () => {
    withLedger();
    fs.writeFileSync(path.join(fx.dir, '.agents', '7', 'task-1-report.md'), 'x');
    run({
      cwd: fx.dir,
      agent_type: 'implementer',
      agent_transcript_path: path.join(fx.dir, 'missing.jsonl'),
    });
    expect(readLedger(fx.ledger)).toBe(
      '# ledger\nSubagent implementer: stopped — report: 7/task-1-report.md\n'
    );
  });

  it('does not use transcript_path (parent session transcript)', () => {
    withLedger();
    const tp = path.join(fx.dir, 'parent.jsonl');
    fs.writeFileSync(
      tp,
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: 'parent line' },
      }) + '\n'
    );
    run({ cwd: fx.dir, agent_type: 'reviewer', transcript_path: tp });
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('keeps the last good transcript line when the final line is truncated', () => {
    withLedger();
    const tp = path.join(fx.dir, 't.jsonl');
    const good = JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Status: DONE' }, 'str'] },
    });
    fs.writeFileSync(
      tp,
      ['"junk"', good, '{"type":"assistant","message":{"role":"assi'].join('\n')
    );
    run({ cwd: fx.dir, agent_type: 'implementer', agent_transcript_path: tp });
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('does not use a report path for non-implementer agents', () => {
    withLedger();
    fs.writeFileSync(path.join(fx.dir, '.agents', '7', 'task-1-report.md'), 'x');
    run({ cwd: fx.dir, agent_type: 'reviewer' });
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('ignores a stale implementer report', () => {
    withLedger();
    const rp = path.join(fx.dir, '.agents', '7', 'task-1-report.md');
    fs.writeFileSync(rp, 'x');
    const old = new Date(Date.now() - 3600_000);
    fs.utimesSync(rp, old, old);
    run({ cwd: fx.dir, agent_type: 'implementer' });
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent implementer: stopped\n');
  });

  it('falls through without jq', () => {
    withLedger();
    const bin = path.join(fx.dir, 'bin');
    fs.mkdirSync(bin);
    for (const c of [
      'cat',
      'sed',
      'head',
      'tail',
      'cut',
      'ls',
      'dirname',
      'tr',
      'grep',
      'find',
      'sort',
      'bash',
    ]) {
      const src = ['/usr/bin', '/bin'].map((d) => path.join(d, c)).find((f) => fs.existsSync(f));
      if (src) fs.symlinkSync(src, path.join(bin, c));
    }
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({
        cwd: fx.dir,
        agent_type: 'reviewer',
        agent_transcript_path: path.join(fx.dir, 'x.jsonl'),
      }),
      encoding: 'utf8',
      env: cleanEnv({ AGENTS_LEDGER: '', PATH: bin }),
    });
    expect(r.status).toBe(0);
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('never writes "no message"', () => {
    withLedger();
    run({ cwd: fx.dir, agent_type: 'reviewer' });
    expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('drops orchestrator entries', () => {
    withLedger();
    const r = run({ cwd: fx.dir, agent_type: 'orchestrator', last_assistant_message: 'done' });
    expect(r.status).toBe(0);
    expect(readLedger(fx.ledger)).toBe('# ledger\n');
  });

  it('drops namespaced and case-variant orchestrator entries', () => {
    withLedger();
    run({ cwd: fx.dir, agent_type: 'agents:orchestrator', last_assistant_message: 'a' });
    run({ cwd: fx.dir, agentType: 'Orchestrator', response: 'b' });
    run({ cwd: fx.dir, agentName: 'ORCHESTRATOR', response: 'c' });
    run({ cwd: fx.dir, subagent_type: 'orchestrator', response: 'd' });
    expect(readLedger(fx.ledger)).toBe('# ledger\n');
  });

  it('writes nothing and exits 0 without a ledger', () => {
    const r = run({ cwd: fx.dir, agentType: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(fx.dir, '.agents'))).toBe(false);
    expect(fs.readdirSync(fx.dir)).toEqual([]);
  });

  it('exits 0 on an empty payload', () => {
    expect(run('').status).toBe(0);
  });

  describe('state dir resolver (git common dir, DROMOS_STATE_DIR)', () => {
    const git = (cwd: string, ...args: string[]) =>
      spawnSync(
        'git',
        [
          '-C',
          cwd,
          '-c',
          'user.email=t@t',
          '-c',
          'user.name=t',
          '-c',
          'commit.gpgsign=false',
          ...args,
        ],
        { encoding: 'utf8', env: gitCleanEnv(process.env) }
      );
    const repo = (branch: string) => {
      for (const a of [
        ['init', '-q'],
        ['checkout', '-q', '-b', branch],
        ['commit', '-q', '--allow-empty', '-m', 'init'],
      ]) {
        const r = git(fx.dir, ...a);
        if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
      }
    };
    const mkLedger = (state: string, nr: string) => {
      const f = path.join(state, nr, 'progress.md');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, `# ${nr}\n`);
      return f;
    };
    const stop = (cwd: string, env: Record<string, string> = {}) =>
      spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd, agent_type: 'reviewer', last_assistant_message: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv({ AGENTS_LEDGER: '', DROMOS_STATE_DIR: '', ...env }),
      });
    const read = (f: string) => readLedger(f);
    const LINE = 'Subagent reviewer: stopped — ok\n';

    it('writes to <git dir>/agents/<nr> for the branch issue', () => {
      repo('feat/7-x');
      const l7 = mkLedger(path.join(fx.dir, '.git', 'agents'), '7');
      expect(stop(fx.dir).status).toBe(0);
      expect(read(l7)).toBe(`# 7\n${LINE}`);
    });

    it('ignores a ledger in the working-tree .agents', () => {
      repo('feat/7-x');
      const old = mkLedger(path.join(fx.dir, '.agents'), '7');
      stop(fx.dir);
      expect(read(old)).toBe('# 7\n');
    });

    it('a linked worktree on feat/7-x writes to the main .git/agents', () => {
      repo('main');
      const state = path.join(fx.dir, '.git', 'agents');
      const l7 = mkLedger(state, '7');
      const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-wt-'));
      try {
        expect(
          git(fx.dir, 'worktree', 'add', '-q', '-b', 'feat/7-x', path.join(wt, 'w')).status
        ).toBe(0);
        expect(stop(path.join(wt, 'w')).status).toBe(0);
        expect(read(l7)).toBe(`# 7\n${LINE}`);
        expect(fs.existsSync(path.join(wt, 'w', '.agents'))).toBe(false);
      } finally {
        fs.rmSync(wt, { recursive: true, force: true });
      }
    });

    it('binds the loop marker <state>/current as before', () => {
      repo('main');
      const state = path.join(fx.dir, '.git', 'agents');
      const l9 = mkLedger(state, '9');
      const l7 = mkLedger(state, '7');
      mkLedger(state, 'loop-5');
      fs.writeFileSync(path.join(state, 'current'), '9 loop-5\n');
      stop(fx.dir);
      expect(read(l9)).toBe(`# 9\n${LINE}`);
      expect(read(l7)).toBe('# 7\n');
    });

    it('falls back to the newest ledger of the state dir on a branch without a number', () => {
      repo('main');
      const state = path.join(fx.dir, '.git', 'agents');
      const old = mkLedger(state, '7');
      fs.utimesSync(old, new Date(2020, 1, 1), new Date(2020, 1, 1));
      const fresh = mkLedger(state, '9');
      stop(fx.dir);
      expect(read(fresh)).toBe(`# 9\n${LINE}`);
      expect(read(old)).toBe('# 7\n');
    });

    it('writes nothing outside a repository without an override', () => {
      mkLedger(path.join(fx.dir, '.agents'), '7');
      const r = stop(fx.dir);
      expect(r.status).toBe(0);
      expect(fs.readdirSync(fx.dir)).toEqual(['.agents']);
      expect(read(path.join(fx.dir, '.agents', '7', 'progress.md'))).toBe('# 7\n');
    });

    it('lets DROMOS_STATE_DIR win over the git common dir', () => {
      repo('feat/7-x');
      const inGit = mkLedger(path.join(fx.dir, '.git', 'agents'), '7');
      const other = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-state-'));
      try {
        const over = mkLedger(other, '7');
        stop(fx.dir, { DROMOS_STATE_DIR: other });
        expect(read(over)).toBe(`# 7\n${LINE}`);
        expect(read(inGit)).toBe('# 7\n');
      } finally {
        fs.rmSync(other, { recursive: true, force: true });
      }
    });

    it('resolves a relative DROMOS_STATE_DIR against the payload cwd', () => {
      const l7 = mkLedger(path.join(fx.dir, 'st'), '7');
      stop(fx.dir, { DROMOS_STATE_DIR: 'st' });
      expect(read(l7)).toBe(`# 7\n${LINE}`);
    });

    it('lets AGENTS_LEDGER win over the override and the common dir', () => {
      repo('feat/7-x');
      const inGit = mkLedger(path.join(fx.dir, '.git', 'agents'), '7');
      const target = mkLedger(path.join(fx.dir, 'elsewhere'), '3');
      const overState = path.join(fx.dir, 'ov');
      mkLedger(overState, '7');
      stop(fx.dir, { AGENTS_LEDGER: target, DROMOS_STATE_DIR: overState });
      expect(read(target)).toBe(`# 3\n${LINE}`);
      expect(read(inGit)).toBe('# 7\n');
    });

    it('does not write through a symlinked state dir', () => {
      const real = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-real-'));
      try {
        const l7 = mkLedger(real, '7');
        fs.symlinkSync(real, path.join(fx.dir, 'st'));
        stop(fx.dir, { DROMOS_STATE_DIR: path.join(fx.dir, 'st') });
        expect(read(l7)).toBe('# 7\n');
      } finally {
        fs.rmSync(real, { recursive: true, force: true });
      }
    });
  });

  describe('DROMOS_URL ingest', () => {
    let bin: string;
    let calls: string;
    let snapshot: string;
    beforeEach(() => {
      bin = path.join(fx.dir, 'bin');
      calls = path.join(fx.dir, 'curl.log');
      snapshot = path.join(fx.dir, 'ledger.at-post');
      fs.mkdirSync(bin);
      // fake curl: log "ARGS <args>" and "BODY <stdin>" per call, snapshot the ledger (LEDGER_PROBE), exit FAKE_CURL_EXIT
      fs.writeFileSync(
        path.join(bin, 'curl'),
        `#!/bin/sh\nprintf 'ARGS %s\\n' "$*" >> "${calls}"\nprintf 'BODY ' >> "${calls}"\ncat >> "${calls}"\nprintf '\\n' >> "${calls}"\n[ -n "$LEDGER_PROBE" ] && cp "$LEDGER_PROBE" "${snapshot}"\nexit "\${FAKE_CURL_EXIT:-0}"\n`,
        { mode: 0o755 }
      );
    });
    const runWith = (payload: unknown, env: Record<string, string>, pathValue?: string) =>
      spawnSync('bash', [SCRIPT], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env: cleanEnv({
          AGENTS_LEDGER: '',
          PATH: pathValue ?? `${bin}:${process.env.PATH}`,
          ...env,
        }),
      });
    /** One entry per curl call: the argument line and the parsed JSON body. */
    const posts = (): { args: string; body: any }[] => {
      if (!fs.existsSync(calls)) return [];
      const lines = fs.readFileSync(calls, 'utf8').trim().split('\n');
      const out: { args: string; body: any }[] = [];
      for (let k = 0; k + 1 < lines.length; k += 2)
        out.push({ args: lines[k].slice(5), body: JSON.parse(lines[k + 1].slice(5)) });
      return out;
    };
    const URL = { DROMOS_URL: 'http://localhost:9' };

    it('makes no network call when DROMOS_URL is unset', () => {
      withLedger();
      const r = runWith({ cwd: fx.dir, agent_type: 'implementer' }, { DROMOS_URL: '' });
      expect(r.status).toBe(0);
      expect(fs.existsSync(calls)).toBe(false);
      expect(readLedger(fx.ledger)).toContain('Subagent implementer: stopped');
    });

    it('posts the appended line to DROMOS_URL/ingest as a JSON POST', () => {
      withLedger();
      const r = runWith(
        { cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'say "hi"' },
        { DROMOS_URL: 'http://localhost:9/', DROMOS_AGENT_ID: 'agent-1' }
      );
      expect(r.status).toBe(0);
      const [call] = posts();
      expect(call.args).toContain('--max-time 0.5');
      expect(call.args).toContain('-X POST');
      expect(call.args).toContain('Content-Type: application/json');
      expect(call.args).toContain('http://localhost:9/ingest');
      expect(call.body).toMatchObject({
        type: 'progress',
        source: 'apm-hub/subagent-stop',
        issue: 7,
        agentId: 'agent-1',
      });
      expect(call.body.data.agent).toBe('implementer');
      expect(call.body.data.line).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z Subagent implementer: stopped — say "hi"$/
      );
      expect(fs.readFileSync(fx.ledger, 'utf8')).toContain(call.body.data.line);
    });

    it('posts after the ledger write', () => {
      withLedger();
      runWith(
        { cwd: fx.dir, agent_type: 'planner' },
        { ...URL, LEDGER_PROBE: path.join(fx.dir, '.agents', '7', 'progress.md') }
      );
      expect(fs.readFileSync(snapshot, 'utf8')).toContain('Subagent planner: stopped');
    });

    it('escapes backslash, quote and tab so the body stays valid JSON', () => {
      withLedger();
      runWith({ cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'a\\b\t"c"' }, URL);
      expect(posts()[0].body.data.line).toMatch(/ Subagent implementer: stopped — a\\b\t"c"$/);
    });

    it('sends agentId null when neither DROMOS_AGENT_ID nor the payload has one', () => {
      withLedger();
      runWith({ cwd: fx.dir, agent_type: 'implementer' }, { ...URL, DROMOS_AGENT_ID: '' });
      expect(posts()[0].body.agentId).toBeNull();
    });

    it('falls back to the payload agent_id when DROMOS_AGENT_ID is empty', () => {
      withLedger();
      runWith(
        { cwd: fx.dir, agent_type: 'implementer', agent_id: 'abc-1' },
        { ...URL, DROMOS_AGENT_ID: '' }
      );
      expect(posts()[0].body.agentId).toBe('abc-1');
    });

    it('accepts https anywhere and http to loopback hosts', () => {
      withLedger();
      for (const [n, u] of [
        'https://example.com/x',
        'http://127.0.0.1:9',
        'http://[::1]:9',
        'http://localhost',
      ].entries()) {
        fs.rmSync(calls, { force: true });
        runWith(
          { cwd: fx.dir, agent_type: 'implementer', last_assistant_message: `run ${n}` },
          { DROMOS_URL: u }
        );
        expect(posts()).toHaveLength(1);
      }
    });

    it('falls back to the payload agent_id when DROMOS_AGENT_ID is empty after sanitising', () => {
      withLedger();
      runWith(
        { cwd: fx.dir, agent_type: 'implementer', agent_id: 'p-1' },
        { ...URL, DROMOS_AGENT_ID: '";$() ' }
      );
      expect(posts()[0].body.agentId).toBe('p-1');
    });

    it('prefers DROMOS_AGENT_ID over the payload agent_id', () => {
      withLedger();
      runWith(
        { cwd: fx.dir, agent_type: 'implementer', agent_id: 'p-1' },
        { ...URL, DROMOS_AGENT_ID: 'env-1' }
      );
      expect(posts()[0].body.agentId).toBe('env-1');
    });

    it('sanitises DROMOS_AGENT_ID', () => {
      withLedger();
      runWith(
        { cwd: fx.dir, agent_type: 'implementer' },
        { ...URL, DROMOS_AGENT_ID: 'a"b c;$(x)' }
      );
      expect(posts()[0].body.agentId).toBe('abcx');
    });

    it('sends issue null when the ledger directory is not an issue number', () => {
      fs.mkdirSync(path.join(fx.dir, 'led'), { recursive: true });
      fs.writeFileSync(path.join(fx.dir, 'led', 'progress.md'), '# ledger\n');
      runWith(
        { cwd: fx.dir, agent_type: 'implementer' },
        { ...URL, AGENTS_LEDGER: path.join(fx.dir, 'led', 'progress.md') }
      );
      expect(posts()[0].body.issue).toBeNull();
    });

    it('sends a leading-zero issue directory (010) as a valid JSON number', () => {
      fs.mkdirSync(path.join(fx.dir, '.agents', '010'), { recursive: true });
      fs.writeFileSync(path.join(fx.dir, '.agents', '010', 'progress.md'), '# ledger\n');
      runWith(
        { cwd: fx.dir, agent_type: 'implementer' },
        { ...URL, AGENTS_LEDGER: path.join(fx.dir, '.agents', '010', 'progress.md') }
      );
      expect(posts()[0].body.issue).toBe(10);
    });

    it.each([
      'ftp://h',
      '-oX',
      'localhost:9',
      'http://a b',
      'https://user:pw@host',
      'http://example.com',
      'http://localhost.evil.com',
      'http://u@localhost:9',
    ])('ignores DROMOS_URL %s', (url) => {
      withLedger();
      const r = runWith({ cwd: fx.dir, agent_type: 'implementer' }, { DROMOS_URL: url });
      expect(r.status).toBe(0);
      expect(posts()).toHaveLength(0);
      expect(readLedger(fx.ledger)).toContain('Subagent implementer: stopped');
    });

    it('posts a duplicate stop once', () => {
      withLedger();
      const payload = {
        cwd: fx.dir,
        agent_type: 'reviewer',
        agent_id: 'a1',
        last_assistant_message: 'ok',
      };
      runWith(payload, URL);
      runWith(payload, URL);
      expect(posts()).toHaveLength(1);
    });

    it('keeps exit 0 and the ledger line when curl fails', () => {
      withLedger();
      const r = runWith({ cwd: fx.dir, agent_type: 'planner' }, { ...URL, FAKE_CURL_EXIT: '28' });
      expect(r.status).toBe(0);
      expect(readLedger(fx.ledger)).toContain('Subagent planner: stopped');
    });

    it('still writes the ledger, exits 0 and posts nothing when curl is not installed', () => {
      withLedger();
      const tools = path.join(fx.dir, 'tools');
      fs.mkdirSync(tools);
      const need = [
        'bash',
        'sed',
        'tr',
        'cut',
        'git',
        'date',
        'grep',
        'cksum',
        'dirname',
        'basename',
        'tail',
        'head',
        'cat',
        'wc',
        'ls',
        'find',
      ];
      for (const t of [...need, 'jq']) {
        const found = spawnSync('sh', ['-c', `command -v ${t}`], {
          encoding: 'utf8',
        }).stdout.trim();
        if (found) fs.symlinkSync(found, path.join(tools, t));
        else expect(t).toBe('jq'); // only jq is optional
      }
      expect(fs.existsSync(path.join(tools, 'curl'))).toBe(false);
      const r = runWith({ cwd: fx.dir, agent_type: 'planner' }, URL, tools);
      expect(r.status).toBe(0);
      expect(readLedger(fx.ledger)).toContain('Subagent planner: stopped');
      expect(fs.existsSync(calls)).toBe(false);
    });

    it('posts nothing for an agent outside the orchestrator allowlist', () => {
      withLedger();
      runWith({ cwd: fx.dir, agent_type: 'stranger' }, URL);
      expect(fs.existsSync(calls)).toBe(false);
    });
  });
});
