import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/hooks/.apm/hooks/subagent-ledger.sh');

describe('subagent-ledger hook', () => {
  let dir: string;
  let ledger: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const withLedger = () => {
    fs.mkdirSync(path.join(dir, '.agents', '7'), { recursive: true });
    ledger = path.join(dir, '.agents', '7', 'progress.md');
    fs.writeFileSync(ledger, '# ledger\n');
  };

  const run = (payload: unknown) =>
    spawnSync('bash', [SCRIPT], {
      input: typeof payload === 'string' ? payload : JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, AGENTS_LEDGER: '' },
    });

  it('appends a line for a Claude payload', () => {
    withLedger();
    const r = run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'Status: DONE\nmore' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('appends the same line format for a Copilot payload', () => {
    withLedger();
    const r = run({ cwd: dir, agentType: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped — APPROVE\n');
  });

  it('ignores a newer .agents/loop-<nr>/progress.md and writes to the newest PBI ledger', () => {
    withLedger();
    const loop = path.join(dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    fs.utimesSync(ledger, new Date(2020, 1, 1), new Date(2020, 1, 1));
    const r = run({ cwd: dir, agent_type: 'issue-reader', last_assistant_message: 'ok' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent issue-reader: stopped — ok\n');
    expect(fs.readFileSync(loop, 'utf8')).toBe('# loop\n');
  });

  it('writes nothing and exits 0 when only loop ledgers exist', () => {
    const loop = path.join(dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    const r = run({ cwd: dir, agent_type: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(loop, 'utf8')).toBe('# loop\n');
  });

  it('treats a non-numeric loop-x directory as a PBI ledger', () => {
    const odd = path.join(dir, '.agents', 'loop-x', 'progress.md');
    fs.mkdirSync(path.dirname(odd), { recursive: true });
    fs.writeFileSync(odd, '# odd\n');
    run({ cwd: dir, agent_type: 'reviewer', response: 'APPROVE' });
    expect(fs.readFileSync(odd, 'utf8')).toBe('# odd\nSubagent reviewer: stopped — APPROVE\n');
  });

  it('honours an AGENTS_LEDGER override pointing at a loop ledger', () => {
    withLedger();
    const loop = path.join(dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', response: 'ok' }),
      encoding: 'utf8',
      env: { ...process.env, AGENTS_LEDGER: loop },
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(loop, 'utf8')).toBe('# loop\nSubagent reviewer: stopped — ok\n');
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
  });

  it('does not write through a symlinked progress.md or a symlinked issue directory', () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.join(dir, '.agents', '7'), { recursive: true });
    fs.symlinkSync(target, path.join(dir, '.agents', '7', 'progress.md'));
    expect(run({ cwd: dir, agent_type: 'reviewer', response: 'x' }).status).toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe('secret\n');

    const outside = path.join(dir, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'progress.md'), 'secret\n');
    fs.symlinkSync(outside, path.join(dir, '.agents', '8'));
    expect(run({ cwd: dir, agent_type: 'reviewer', response: 'x' }).status).toBe(0);
    expect(fs.readFileSync(path.join(outside, 'progress.md'), 'utf8')).toBe('secret\n');
  });

  it('does not write through a symlinked AGENTS_LEDGER', () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    const link = path.join(dir, 'link.md');
    fs.symlinkSync(target, link);
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', response: 'x' }),
      encoding: 'utf8',
      env: { ...process.env, AGENTS_LEDGER: link },
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe('secret\n');
  });

  it('writes one line when the same payload fires twice', () => {
    withLedger();
    const payload = { cwd: dir, agent_type: 'implementer', last_assistant_message: 'Status: DONE' };
    run(payload);
    run(payload);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('writes two lines for two different payloads', () => {
    withLedger();
    run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'one' });
    run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'two' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe(
      '# ledger\nSubagent implementer: stopped — one\nSubagent implementer: stopped — two\n',
    );
  });

  it('accepts agentName and subagent_type as agent name', () => {
    withLedger();
    run({ cwd: dir, agentName: 'explorer', response: 'x' });
    run({ cwd: dir, subagent_type: 'planner', response: 'y' });
    const text = fs.readFileSync(ledger, 'utf8');
    expect(text).toContain('Subagent explorer: stopped — x\n');
    expect(text).toContain('Subagent planner: stopped — y\n');
  });

  it('falls back to defaults and cuts the summary to 120 chars', () => {
    withLedger();
    run({ cwd: dir, agent_type: 'reviewer' });
    run({ cwd: dir, agent_type: 'planner', response: 'a'.repeat(200) });
    const lines = fs.readFileSync(ledger, 'utf8').trim().split('\n');
    expect(lines[1]).toBe('Subagent reviewer: stopped');
    expect(lines[2]).toBe(`Subagent planner: stopped — ${'a'.repeat(120)}`);
  });

  it('uses the last text line of the agent transcript when the message is missing', () => {
    withLedger();
    const tp = path.join(dir, 't.jsonl');
    const entry = (role: string, text: string) =>
      JSON.stringify({ type: role, message: { role, content: [{ type: 'text', text }] } });
    fs.writeFileSync(tp, [entry('assistant', 'first'), entry('user', 'q'), entry('assistant', 'a\nStatus: DONE\n')].join('\n') + '\n');
    run({ cwd: dir, agent_type: 'implementer', last_assistant_message: '', agent_transcript_path: tp });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('falls back to the newest report path when message and transcript are missing', () => {
    withLedger();
    fs.writeFileSync(path.join(dir, '.agents', '7', 'task-1-report.md'), 'x');
    run({ cwd: dir, agent_type: 'implementer', agent_transcript_path: path.join(dir, 'missing.jsonl') });
    expect(fs.readFileSync(ledger, 'utf8')).toBe(
      '# ledger\nSubagent implementer: stopped — report: .agents/7/task-1-report.md\n',
    );
  });

  it('does not use transcript_path (parent session transcript)', () => {
    withLedger();
    const tp = path.join(dir, 'parent.jsonl');
    fs.writeFileSync(tp, JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'parent line' } }) + '\n');
    run({ cwd: dir, agent_type: 'reviewer', transcript_path: tp });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('keeps the last good transcript line when the final line is truncated', () => {
    withLedger();
    const tp = path.join(dir, 't.jsonl');
    const good = JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Status: DONE' }, 'str'] } });
    fs.writeFileSync(tp, ['"junk"', good, '{"type":"assistant","message":{"role":"assi'].join('\n'));
    run({ cwd: dir, agent_type: 'implementer', agent_transcript_path: tp });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('does not use a report path for non-implementer agents', () => {
    withLedger();
    fs.writeFileSync(path.join(dir, '.agents', '7', 'task-1-report.md'), 'x');
    run({ cwd: dir, agent_type: 'reviewer' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('ignores a stale implementer report', () => {
    withLedger();
    const rp = path.join(dir, '.agents', '7', 'task-1-report.md');
    fs.writeFileSync(rp, 'x');
    const old = new Date(Date.now() - 3600_000);
    fs.utimesSync(rp, old, old);
    run({ cwd: dir, agent_type: 'implementer' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped\n');
  });

  it('falls through without jq', () => {
    withLedger();
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    for (const c of ['cat', 'sed', 'head', 'tail', 'cut', 'ls', 'dirname', 'tr', 'grep', 'find', 'sort', 'bash']) {
      const src = ['/usr/bin', '/bin'].map((d) => path.join(d, c)).find((f) => fs.existsSync(f));
      if (src) fs.symlinkSync(src, path.join(bin, c));
    }
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', agent_transcript_path: path.join(dir, 'x.jsonl') }),
      encoding: 'utf8',
      env: { ...process.env, AGENTS_LEDGER: '', PATH: bin },
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('never writes "no message"', () => {
    withLedger();
    run({ cwd: dir, agent_type: 'reviewer' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('drops orchestrator entries', () => {
    withLedger();
    const r = run({ cwd: dir, agent_type: 'orchestrator', last_assistant_message: 'done' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
  });

  it('drops namespaced and case-variant orchestrator entries', () => {
    withLedger();
    run({ cwd: dir, agent_type: 'agents:orchestrator', last_assistant_message: 'a' });
    run({ cwd: dir, agentType: 'Orchestrator', response: 'b' });
    run({ cwd: dir, agentName: 'ORCHESTRATOR', response: 'c' });
    run({ cwd: dir, subagent_type: 'orchestrator', response: 'd' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
  });

  it('writes nothing and exits 0 without a ledger', () => {
    const r = run({ cwd: dir, agentType: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  describe('agent allowlist and branch binding', () => {
    const git = (...args: string[]) =>
      spawnSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { encoding: 'utf8' });
    const repo = (branch: string) => {
      git('init', '-q');
      git('checkout', '-q', '-b', branch);
      git('commit', '-q', '--allow-empty', '-m', 'init');
    };
    const mk = (nr: string, mtime?: Date) => {
      const f = path.join(dir, '.agents', nr, 'progress.md');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, `# ${nr}\n`);
      if (mtime) fs.utimesSync(f, mtime, mtime);
      return f;
    };
    const read = (f: string) => fs.readFileSync(f, 'utf8');

    it.each(['general-purpose', 'Explore', 'subagent', 'evil:general-purpose'])('writes nothing for foreign agent %s', (t) => {
      withLedger();
      const r = run({ cwd: dir, agent_type: t, last_assistant_message: 'x' });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
    });

    it.each(['agents:implementer', 'agents/implementer', 'a:b:reviewer'])('writes for namespaced agent %s', (t) => {
      withLedger();
      run({ cwd: dir, agent_type: t, last_assistant_message: 'x' });
      expect(fs.readFileSync(ledger, 'utf8')).toBe(`# ledger\nSubagent ${t}: stopped — x\n`);
    });

    it.each(['issue-reader', 'explorer', 'planner', 'reviewer', 'review-lead', 'implementer', 'pr-writer', 'pbi-runner'])(
      'writes for %s',
      (t) => {
        withLedger();
        run({ cwd: dir, agent_type: t, last_assistant_message: 'x' });
        expect(fs.readFileSync(ledger, 'utf8')).toBe(`# ledger\nSubagent ${t}: stopped — x\n`);
      },
    );

    it('writes to the ledger of the branch issue although another ledger is newer', () => {
      repo('fix/7-x');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      const r = run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(read(l7)).toBe('# 7\nSubagent implementer: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('writes nothing when the branch issue has no ledger', () => {
      repo('feat/7-x');
      const l9 = mk('9');
      const r = run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(read(l9)).toBe('# 9\n');
    });

    it('falls back to the newest ledger on a branch without a number', () => {
      repo('main');
      const old = mk('7', new Date(2020, 1, 1));
      const nw = mk('9');
      run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(read(nw)).toBe('# 9\nSubagent implementer: stopped — ok\n');
      expect(read(old)).toBe('# 7\n');
    });

    it('does not bind to loop-<nr> and keeps the loop ledger out of the fallback', () => {
      repo('main');
      const l7 = mk('7', new Date(2020, 1, 1));
      const loop = mk('loop-8');
      run({ cwd: dir, agent_type: 'reviewer', last_assistant_message: 'ok' });
      expect(read(loop)).toBe('# loop-8\n');
      expect(read(l7)).toBe('# 7\nSubagent reviewer: stopped — ok\n');
    });

    it('lets AGENTS_LEDGER win over the branch binding', () => {
      repo('fix/7-x');
      mk('7');
      const l9 = mk('9');
      spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', response: 'ok' }),
        encoding: 'utf8',
        env: { ...process.env, AGENTS_LEDGER: l9 },
      });
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
    });
  });

  describe('pbi-runner and nested stops', () => {
    const runner = (reply: unknown, extra: object = {}) => ({
      cwd: dir,
      agent_type: 'pbi-runner',
      agent_id: 'r1',
      last_assistant_message: typeof reply === 'string' ? reply : JSON.stringify(reply),
      ...extra,
    });

    it('summarises a GATE reply with its phase', () => {
      withLedger();
      run(runner({ status: 'GATE', pbi: 7, phase: 'plan', question: 'Proceed?', options: ['yes', 'no'] }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent pbi-runner: stopped — GATE plan\n');
    });

    it('summarises a DONE reply with the PR url, also pretty-printed in a code fence', () => {
      withLedger();
      const json = JSON.stringify({ status: 'DONE', pbi: 7, pr: 'https://x/pull/9', summary: 'a\nb' }, null, 2);
      run(runner('```json\n' + json + '\n```'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent pbi-runner: stopped — DONE https://x/pull/9\n');
    });

    it('summarises BLOCKED and FAILED by status only', () => {
      withLedger();
      run(runner({ status: 'BLOCKED', pbi: 7, pr: null, summary: 's' }, { agent_id: 'r2' }));
      run(runner({ status: 'FAILED', pbi: 7, pr: null, summary: 's' }, { agent_id: 'r3' }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        '# ledger\nSubagent pbi-runner: stopped — BLOCKED\nSubagent pbi-runner: stopped — FAILED\n',
      );
    });

    it('writes a depth-2 implementer stop into the PBI ledger, not a newer loop ledger', () => {
      withLedger();
      fs.mkdirSync(path.join(dir, '.agents', 'loop-300'), { recursive: true });
      const loop = path.join(dir, '.agents', 'loop-300', 'progress.md');
      fs.writeFileSync(loop, '# loop\n');
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'i1', last_assistant_message: 'Status: DONE' });
      run(runner({ status: 'DONE', pbi: 7, pr: 'https://x/pull/9' }));
      expect(fs.readFileSync(loop, 'utf8')).toBe('# loop\n');
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        '# ledger\nSubagent implementer: stopped — Status: DONE\nSubagent pbi-runner: stopped — DONE https://x/pull/9\n',
      );
    });

    it('records a resumed runner (same agent_id) once per distinct outcome', () => {
      withLedger();
      run(runner({ status: 'GATE', phase: 'plan' }));
      run(runner({ status: 'DONE', pr: 'https://x/pull/9' }));
      // an interleaved child line and a repeated resume stop must not duplicate the earlier runner line
      run({ cwd: dir, agent_type: 'reviewer', agent_id: 'v1', last_assistant_message: 'APPROVE' });
      run(runner({ status: 'DONE', pr: 'https://x/pull/9' }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        '# ledger\nSubagent pbi-runner: stopped — GATE plan\nSubagent pbi-runner: stopped — DONE https://x/pull/9\nSubagent reviewer: stopped — APPROVE\n',
      );
    });

    it('still records two different agents with the same message', () => {
      withLedger();
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'a', last_assistant_message: 'Status: DONE' });
      run({ cwd: dir, agent_type: 'reviewer', agent_id: 'b', last_assistant_message: 'x' });
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'c', last_assistant_message: 'Status: DONE' });
      expect(fs.readFileSync(ledger, 'utf8').split('\n').filter(Boolean)).toHaveLength(4);
    });

    const LEDGER = (...lines: string[]) => '# ledger\n' + lines.map((l) => l + '\n').join('');

    it('keeps two GATE replies of the same phase and runner as separate entries', () => {
      withLedger();
      run(runner({ status: 'GATE', phase: 'review', question: 'Fix advisories?' }));
      run(runner({ status: 'GATE', phase: 'review', question: 'Still blocked?' }));
      run(runner({ status: 'GATE', phase: 'review', question: 'Still blocked?' }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        LEDGER('Subagent pbi-runner: stopped — GATE review', 'Subagent pbi-runner: stopped — GATE review'),
      );
    });

    it('reads the status from the agent transcript when the message is missing', () => {
      withLedger();
      const t = path.join(dir, 'agent.jsonl');
      fs.writeFileSync(
        t,
        JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'x {"status":"GATE","phase":"plan"}' }] } }) + '\n',
      );
      run({ cwd: dir, agent_type: 'pbi-runner', agent_id: 'r1', agent_transcript_path: t });
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent pbi-runner: stopped — GATE plan'));
    });

    it('uses the last status object when the reply holds several', () => {
      withLedger();
      run(runner('earlier {"status":"GATE","phase":"plan"} then {"status":"DONE","pr":"#12"} and {"note":1}'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent pbi-runner: stopped — DONE #12'));
    });

    it.each([
      [{ status: 'GATE' }, 'GATE'],
      [{ status: 'DONE' }, 'DONE'],
      [{ status: 'DONE', pr: 12 }, 'DONE'],
      [{ status: 'DONE', pr: null }, 'DONE'],
      [{ status: 'DONE', pr: 'javascript:alert(1)' }, 'DONE'],
      [{ status: 'GATE', phase: 'a b\nc' }, 'GATE'],
    ])('summarises %j as %s', (reply, expected) => {
      withLedger();
      run(runner(reply));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER(`Subagent pbi-runner: stopped — ${expected}`));
    });

    it('falls back to the first line for an unknown status', () => {
      withLedger();
      run(runner('{"status":"WAITING"}'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent pbi-runner: stopped — {"status":"WAITING"}'));
    });

    it('recognises a namespaced runner name', () => {
      withLedger();
      run(runner({ status: 'DONE', pr: 'https://x/pull/1' }, { agent_type: 'agents:pbi-runner' }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent agents:pbi-runner: stopped — DONE https://x/pull/1'));
    });

    it('writes no status summary without jq', () => {
      withLedger();
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      for (const c of ['cat', 'sed', 'head', 'tail', 'cut', 'ls', 'dirname', 'tr', 'grep', 'find', 'sort', 'bash', 'cksum']) {
        const src = ['/usr/bin', '/bin'].map((d) => path.join(d, c)).find((f) => fs.existsSync(f));
        if (src) fs.symlinkSync(src, path.join(bin, c));
      }
      const r = spawnSync('bash', [SCRIPT], {
        input: JSON.stringify(runner({ status: 'DONE', pr: 'https://x/pull/9' })),
        encoding: 'utf8',
        env: { ...process.env, AGENTS_LEDGER: '', PATH: bin },
      });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent pbi-runner: stopped'));
    });

    it('sanitises the agent name', () => {
      withLedger();
      run({ cwd: dir, agent_type: 'evil\r\n- injected `x` ' + 'a'.repeat(100) + '/reviewer', agent_id: 'e1', last_assistant_message: 'ok' });
      run({ cwd: dir, agent_type: 'agents:re\r\nviewer`', agent_id: 'e2', last_assistant_message: 'ok' });
      const out = fs.readFileSync(ledger, 'utf8').split('\n');
      expect(out).toHaveLength(3);
      expect(out[1]).toBe('Subagent agents:reviewer: stopped — ok');
    });

    it('does not dedupe without a valid agent_id and does not write a sidecar', () => {
      withLedger();
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'bad id!', last_assistant_message: 'Status: DONE' });
      run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'Status: DONE' });
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent implementer: stopped — Status: DONE'));
      expect(fs.existsSync(path.join(dir, '.agents', '7', '.ledger-seen'))).toBe(false);
    });

    it('records every stop of different agents with the same message when ids differ', () => {
      withLedger();
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'a', last_assistant_message: 'Status: DONE' });
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'b', last_assistant_message: 'Status: DONE' });
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        LEDGER('Subagent implementer: stopped — Status: DONE', 'Subagent implementer: stopped — Status: DONE'),
      );
    });

    it('ignores a symlinked sidecar and still writes the line', () => {
      withLedger();
      const target = path.join(dir, 'elsewhere');
      fs.writeFileSync(target, '');
      fs.symlinkSync(target, path.join(dir, '.agents', '7', '.ledger-seen'));
      const r = run({ cwd: dir, agent_type: 'reviewer', agent_id: 'a', last_assistant_message: 'x' });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent reviewer: stopped — x'));
      expect(fs.readFileSync(target, 'utf8')).toBe('');
    });

    it('exits 0 and still writes the line when the sidecar cannot be written', () => {
      withLedger();
      fs.mkdirSync(path.join(dir, '.agents', '7', '.ledger-seen'));
      const r = run({ cwd: dir, agent_type: 'reviewer', agent_id: 'a', last_assistant_message: 'x' });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent reviewer: stopped — x'));
    });

    it('falls back to the first line for a runner reply without a status object', () => {
      withLedger();
      run(runner('plain text'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent pbi-runner: stopped — plain text\n');
    });
  });

  it('exits 0 on an empty payload', () => {
    expect(run('').status).toBe(0);
  });
});
