import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../packages/development-workflow/.apm/skills/retro/scripts/Get-RunMetrics.ps1',
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

const msg = (id: string, model: string, usage: object) =>
  JSON.stringify({ type: 'assistant', message: { id, role: 'assistant', model, content: [], usage } });

describe.skipIf(!hasPwsh)('Get-RunMetrics.ps1', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (args: string[]) => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], { encoding: 'utf8', cwd: dir });
    return { ...r, json: r.status === 0 ? JSON.parse(r.stdout) : null };
  };

  const fixture = () => {
    const transcript = path.join(dir, 'sess.jsonl');
    fs.writeFileSync(
      transcript,
      [
        '{"type":"mode"}',
        msg('m1', 'claude-sonnet-5-5', { input_tokens: 100, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0, output_tokens: 10 }),
        // same id again (streamed block): must count once, last usage wins
        msg('m1', 'claude-sonnet-5-5', { input_tokens: 100, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0, output_tokens: 50 }),
        msg('m2', 'claude-sonnet-5-5', { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 5000, output_tokens: 20 }),
        '{"truncated":',
      ].join('\n') + '\n',
    );
    const sub = path.join(dir, 'sess', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const agent = (name: string, role: string, lines: string[]) => {
      fs.writeFileSync(path.join(sub, `${name}.meta.json`), JSON.stringify({ agentType: role }));
      fs.writeFileSync(path.join(sub, `${name}.jsonl`), lines.join('\n') + '\n');
    };
    const u = { input_tokens: 1000000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 };
    agent('agent-a', 'implementer', [msg('s1', 'claude-sonnet-5-5', u), msg('s1', 'claude-sonnet-5-5', u)]);
    agent('agent-b', 'implementer', [msg('s2', 'claude-sonnet-5-5', u)]);
    agent('agent-c', 'explorer', [msg('s3', 'claude-haiku-4-5', u)]);
    const ledger = path.join(dir, 'progress.md');
    fs.writeFileSync(
      ledger,
      ['# ledger', 'Ruling: skip split', 'Ruling: manual stack', 'Fix round 1: DONE', 'Fix round 2: DONE', 'Gate: merge denied', 'Subagent reviewer: stopped'].join('\n') + '\n',
    );
    return { transcript, ledger };
  };

  it('reports main thread, subagent roles and ledger counts', () => {
    const { transcript, ledger } = fixture();
    const { status, json } = run(['-Transcript', transcript, '-Ledger', ledger]);
    expect(status).toBe(0);
    expect(json.main.requests).toBe(2);
    expect(json.main.peakContext).toBe(5010);
    expect(json.main.outputTokens).toBe(70);
    expect(json.main.costMeasured).toBe(0);
    // m1: 100*3 + 1000*3.75 + 50*15 = 4800; m2: 10*3 + 5000*0.3 + 20*15 = 1830 -> 6630 / 1e6 (output rounded to 4 decimals)
    expect(json.main.costEstimated).toBeCloseTo(0.0066, 4);
    expect(json.subagents.count).toBe(3);
    const roles = Object.fromEntries(json.subagents.byRole.map((r: any) => [r.role, r]));
    expect(roles.implementer.count).toBe(2);
    expect(roles.implementer.requests).toBe(2);
    expect(roles.implementer.costEstimated).toBeCloseTo(6, 4);
    expect(roles.explorer.costEstimated).toBeCloseTo(1, 4);
    expect(json.subagents.costEstimated).toBeCloseTo(7, 4);
    expect(json.fixRounds).toBe(2);
    expect(json.rulings.count).toBe(2);
    expect(json.rulings.items).toEqual(['skip split', 'manual stack']);
    expect(json.gates.count).toBe(1);
  });

  it('prefers measured costUSD over the estimate', () => {
    const t = path.join(dir, 'm.jsonl');
    const e = JSON.parse(msg('x', 'claude-opus-4', { input_tokens: 1, output_tokens: 1 }));
    fs.writeFileSync(t, JSON.stringify({ ...e, costUSD: 0.5 }) + '\n');
    const { json } = run(['-Transcript', t]);
    expect(json.main.costMeasured).toBe(0.5);
    expect(json.main.costEstimated).toBe(0);
  });

  it('resolves the ledger from -Issue and tolerates a missing one', () => {
    const { transcript } = fixture();
    fs.mkdirSync(path.join(dir, '.agents', '9'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.agents', '9', 'progress.md'), 'Fix round 1: x\n');
    expect(run(['-Transcript', transcript, '-Issue', '9']).json.fixRounds).toBe(1);
    const none = run(['-Transcript', transcript, '-Issue', '404']).json;
    expect(none.ledger).toBeNull();
    expect(none.fixRounds).toBe(0);
  });

  it('works without subagents', () => {
    const t = path.join(dir, 'solo.jsonl');
    fs.writeFileSync(t, msg('a', 'claude-haiku-4-5', { input_tokens: 5, output_tokens: 1 }) + '\n');
    const { json } = run(['-Transcript', t]);
    expect(json.subagents.count).toBe(0);
    expect(json.main.peakContext).toBe(5);
  });

  it('fails on a missing transcript', () => {
    const r = run(['-Transcript', path.join(dir, 'nope.jsonl')]);
    expect(r.status).not.toBe(0);
  });
});
