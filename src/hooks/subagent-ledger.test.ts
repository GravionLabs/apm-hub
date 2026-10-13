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
    expect(lines[1]).toBe('Subagent subagent: stopped — no message');
    expect(lines[2]).toBe(`Subagent subagent: stopped — ${'a'.repeat(120)}`);
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
