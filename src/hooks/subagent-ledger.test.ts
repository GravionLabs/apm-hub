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
    run({ cwd: dir });
    run({ cwd: dir, response: 'a'.repeat(200) });
    const lines = fs.readFileSync(ledger, 'utf8').trim().split('\n');
    expect(lines[1]).toBe('Subagent subagent: stopped');
    expect(lines[2]).toBe(`Subagent subagent: stopped — ${'a'.repeat(120)}`);
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

  it('exits 0 on an empty payload', () => {
    expect(run('').status).toBe(0);
  });
});
