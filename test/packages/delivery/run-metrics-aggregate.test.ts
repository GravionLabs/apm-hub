import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PwshWorker } from '../../helpers/pwsh-worker';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/delivery/.apm/skills/retro/scripts/Get-RunMetrics.ps1'
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

if (!hasPwsh && process.env.CI) throw new Error('pwsh is required in CI');

describe.skipIf(!hasPwsh)('Get-RunMetrics.ps1 multi-run', () => {
  let dir: string;
  let state: string;
  let worker: PwshWorker;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-agg-'));
    state = path.join(dir, '.agents');
    fs.mkdirSync(state);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = async (args: string[], extraEnv: NodeJS.ProcessEnv = {}) => {
    const r = await worker.run(args, {
      cwd: dir,
      env: { ...process.env, DROMOS_STATE_DIR: state, ...extraEnv },
    });
    return { ...r, json: r.status === 0 ? JSON.parse(r.stdout) : null };
  };

  const ledger = (name: string, lines: string[]) => {
    fs.mkdirSync(path.join(state, name), { recursive: true });
    fs.writeFileSync(path.join(state, name, 'progress.md'), lines.join('\n') + '\n');
  };

  describe('-Loop', () => {
    const loopFixture = () => {
      ledger('loop-9', [
        '# orchestrator ledger — loop #9 — branch main',
        '2026-10-01T10:00:00Z Loop: PBI #12 started',
        'Loop: PBI #12 done — https://example.test/pull/1',
        'Loop: PBI #12 merged — abc1234',
        'Loop: PBI #11 started',
        'Loop: PBI #11 parked — which store?',
        'Loop: PBI #13 started',
        'Loop: stopped — nothing selectable',
      ]);
      ledger('12', [
        '# ledger',
        'Task #101: DONE — model sonnet',
        'Fix round 1 (#101): DONE — model sonnet',
        'Fix round 2 (#101): DONE — model opus',
        'Ruling: keep the cache',
      ]);
      ledger('11', ['# ledger', 'Task #102: DONE — model sonnet', 'Gate: which store?']);
    };

    it('lists the PBIs in order of first appearance with the parked flag', async () => {
      loopFixture();
      const { status, json } = await run(['-Loop', '9']);
      expect(status).toBe(0);
      expect(json.source).toBe('ledger');
      expect(json.transcript).toBeNull();
      expect(json.runs.map((r: any) => r.issue)).toEqual([12, 11, 13]);
      expect(json.runs.map((r: any) => r.parked)).toEqual([false, true, false]);
      expect(json.runs[0]).toMatchObject({
        fixRounds: 2,
        escalations: 1,
        gates: 0,
        rulings: ['keep the cache'],
        cost: null,
        source: 'ledger',
      });
      expect(json.runs[1].gates).toBe(1);
    });

    it('gives a missing PBI ledger a null run and one warning', async () => {
      loopFixture();
      const { json } = await run(['-Loop', '9']);
      expect(json.runs[2].ledger).toBeNull();
      expect(json.runs[2].fixRounds).toBe(0);
      expect(json.warnings).toEqual(['Ledger not found for #13']);
    });

    it('computes the aggregate over all runs', async () => {
      loopFixture();
      const { json } = await run(['-Loop', '9']);
      // fix rounds 2 + 0 + 0 over 3 runs; 1 of 2 tasks escalated
      expect(json.aggregate).toEqual({
        fixRoundsPerPbi: 0.67,
        escalationShare: 0.5,
        gateCount: 1,
        parkedCount: 1,
        repeatedRulings: [],
      });
    });

    it('fails when the loop ledger is missing', async () => {
      const r = await run(['-Loop', '4']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(
        `Loop ledger not found: ${path.join(state, 'loop-4', 'progress.md')}`
      );
    });

    it('takes every Loop: PBI line whatever its state word, merge skipped included', async () => {
      ledger('loop-2', [
        'Loop: PBI #21 merge skipped — not approved',
        'Loop: PBI #22 resumed',
        'Loop: PBI #210 started',
        'Loop: stopped — user stop',
      ]);
      const { json } = await run(['-Loop', '2']);
      expect(json.runs.map((r: any) => r.issue)).toEqual([21, 22, 210]);
    });

    it('clears the parked flag when a later line of the loop ledger finishes the PBI', async () => {
      ledger('loop-6', [
        'Loop: PBI #31 parked — q',
        'Loop: PBI #31 started',
        'Loop: PBI #31 done — https://example.test/pull/2',
        'Loop: PBI #32 started',
        'Loop: PBI #32 parked — q2',
      ]);
      const { json } = await run(['-Loop', '6']);
      expect(json.runs.map((r: any) => r.parked)).toEqual([false, true]);
      expect(json.aggregate.parkedCount).toBe(1);
    });

    it('counts a legacy fix round >= 3 without model as an escalation', async () => {
      ledger('loop-7', ['Loop: PBI #41 started']);
      ledger('41', [
        '# ledger',
        'Task #401: DONE',
        'Fix round 1: DONE',
        'Fix round 2: DONE',
        'Fix round 3: DONE',
        'Task #402: DONE',
      ]);
      const { json } = await run(['-Loop', '7']);
      expect(json.runs[0].escalations).toBe(1);
      expect(json.aggregate.escalationShare).toBe(0.5);
    });

    it('reads the parked flag only from the selected loop ledger', async () => {
      ledger('loop-1', ['Loop: PBI #5 started']);
      ledger('loop-2', ['Loop: PBI #5 parked — q']);
      ledger('5', ['# ledger']);
      const { json } = await run(['-Loop', '1']);
      expect(json.runs[0].parked).toBe(false);
    });
  });

  describe('-Issues', () => {
    it('takes the given numbers in the given order', async () => {
      ledger('1', ['# ledger', 'Fix round 1: DONE']);
      ledger('2', ['# ledger']);
      ledger('loop-3', ['Loop: PBI #2 parked — q']);
      const { status, json } = await run(['-Issues', '2,1']);
      expect(status).toBe(0);
      expect(json.runs.map((r: any) => r.issue)).toEqual([2, 1]);
      expect(json.runs.map((r: any) => r.parked)).toEqual([true, false]);
      expect(json.aggregate.fixRoundsPerPbi).toBe(0.5);
      expect(json.aggregate.parkedCount).toBe(1);
      expect(json.warnings).toEqual([]);
    });

    it('applies the newest loop ledger line across loop ledgers', async () => {
      ledger('3', ['# ledger']);
      ledger('4', ['# ledger']);
      ledger('loop-1', [
        '2026-10-01T08:00:00Z Loop: PBI #3 parked — q',
        '2026-10-01T08:00:00Z Loop: PBI #4 done — pr',
      ]);
      ledger('loop-2', [
        '2026-10-02T08:00:00Z Loop: PBI #3 done — pr',
        '2026-10-02T08:00:00Z Loop: PBI #4 parked — q',
      ]);
      const { json } = await run(['-Issues', '3,4']);
      expect(json.runs.map((r: any) => r.parked)).toEqual([false, true]);
    });

    it('gives a missing ledger a null run and a warning', async () => {
      ledger('1', ['# ledger', 'Gate: go?']);
      const { status, json } = await run(['-Issues', '1,5']);
      expect(status).toBe(0);
      expect(json.runs[1]).toMatchObject({
        issue: 5,
        ledger: null,
        fixRounds: 0,
        gates: 0,
        parked: false,
      });
      expect(json.warnings).toEqual(['Ledger not found for #5']);
      expect(json.aggregate.gateCount).toBe(1);
    });

    it('rejects a non-numeric entry', async () => {
      const r = await run(['-Issues', '1,x']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('-Issues takes issue numbers: x');
    });
  });

  describe('-Since', () => {
    it('selects later ledgers sorted by their first timestamp and skips untimestamped ones', async () => {
      ledger('7', ['# ledger', '2026-10-05T08:00:00Z Phase read: complete']);
      ledger('3', ['2026-10-03T08:00:00Z # ledger']);
      ledger('2', ['2026-09-01T08:00:00Z # ledger']);
      ledger('4', ['# ledger without timestamps']);
      ledger('loop-5', ['2026-10-04T08:00:00Z Loop: PBI #3 started']);
      ledger('adhoc', ['2026-10-04T08:00:00Z # ledger']);
      const { status, json } = await run(['-Since', '2026-10-02']);
      expect(status).toBe(0);
      expect(json.runs.map((r: any) => r.issue)).toEqual([3, 7]);
      expect(json.warnings).toEqual(['4: no timestamps, skipped by -Since']);
    });

    it('returns no runs and a zero aggregate when nothing is later', async () => {
      ledger('2', ['2026-09-01T08:00:00Z # ledger']);
      const { json } = await run(['-Since', '2026-10-02T00:00:00Z']);
      expect(json.runs).toEqual([]);
      expect(json.aggregate).toEqual({
        fixRoundsPerPbi: 0,
        escalationShare: 0,
        gateCount: 0,
        parkedCount: 0,
        repeatedRulings: [],
      });
    });

    it('excludes a ledger whose first timestamp equals -Since', async () => {
      ledger('1', ['2026-10-02T00:00:00Z # ledger']);
      ledger('2', ['2026-10-02T00:00:01Z # ledger']);
      const { json } = await run(['-Since', '2026-10-02T00:00:00Z']);
      expect(json.runs.map((r: any) => r.issue)).toEqual([2]);
    });

    it('rejects an unparsable date', async () => {
      const r = await run(['-Since', 'yesterday-ish']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('-Since is not an ISO date: yesterday-ish');
    });
  });

  describe('parameter rules', () => {
    it.each([
      [['-Loop', '9', '-Transcript', 'x.jsonl']],
      [['-Issues', '1', '-Issue', '1']],
      [['-Since', '2026-10-01', '-Ledger', 'p.md']],
    ])('rejects single-issue parameters in multi-run mode: %j', async (args) => {
      const r = await run(args);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('-Transcript, -Issue and -Ledger apply to a single issue only');
    });

    it('rejects two multi-run parameters together', async () => {
      const r = await run(['-Loop', '9', '-Issues', '1']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('-Loop, -Issues and -Since exclude each other');
    });
  });

  describe('repeated rulings', () => {
    it('normalises numbers, SHAs, paths and the trailing why/cost to one key', async () => {
      ledger('1', [
        '# ledger',
        'Ruling: skip review of src/a.ts at 3f9c2e1 for #12 after 2 rounds — too slow — 5 min',
        'Ruling: only here',
      ]);
      ledger('2', [
        '# ledger',
        'Ruling: skip review of lib\\b.ps1 at 0a1b2c3d4e for #340 after 7 rounds — other why — 1 h',
      ]);
      const { json } = await run(['-Issues', '1,2']);
      expect(json.aggregate.repeatedRulings).toEqual([
        { text: 'skip review of PATH at SHA for #N after N rounds', count: 2 },
      ]);
    });

    it('counts a ruling repeated inside one run once', async () => {
      ledger('1', [
        '# ledger',
        'Ruling: use 1 worker',
        'Ruling: use 2 workers',
        'Ruling: use 3 worker',
      ]);
      ledger('2', ['# ledger', 'Ruling: use 4 workers']);
      const { json } = await run(['-Issues', '1,2']);
      expect(json.aggregate.repeatedRulings).toEqual([{ text: 'use N workers', count: 2 }]);
    });

    it.each([
      ['different decisions', 'use the cache', 'drop the cache'],
      ['a number inside a word', 'pin v2 of the api', 'pin v3 of the api'],
      ['hex letters without a digit', 'keep defaced flag', 'keep acceded flag'],
      ['the same why after different decisions', 'split it — too big', 'merge it — too big'],
    ])('keeps %s apart', async (_label, a, b) => {
      ledger('1', ['# ledger', `Ruling: ${a}`]);
      ledger('2', ['# ledger', `Ruling: ${b}`]);
      const { json } = await run(['-Issues', '1,2']);
      expect(json.aggregate.repeatedRulings).toEqual([]);
    });

    it('sorts by count, then text', async () => {
      ledger('1', ['# ledger', 'Ruling: b 1', 'Ruling: a 1', 'Ruling: c 1']);
      ledger('2', ['# ledger', 'Ruling: b 2', 'Ruling: a 2', 'Ruling: c 2']);
      ledger('3', ['# ledger', 'Ruling: c 3']);
      const { json } = await run(['-Issues', '1,2,3']);
      expect(json.aggregate.repeatedRulings).toEqual([
        { text: 'c N', count: 3 },
        { text: 'a N', count: 2 },
        { text: 'b N', count: 2 },
      ]);
    });
  });

  describe('single issue', () => {
    it('keeps every old key and adds runs (1) and aggregate', async () => {
      const t = path.join(dir, 's.jsonl');
      fs.writeFileSync(
        t,
        JSON.stringify({
          type: 'assistant',
          message: {
            id: 'a',
            role: 'assistant',
            model: 'claude-sonnet-5-5',
            content: [],
            usage: { input_tokens: 1000000, output_tokens: 0 },
          },
        }) + '\n'
      );
      ledger('8', ['# ledger', 'Task #81: DONE — model sonnet', 'Gate: go?', 'Ruling: go']);
      ledger('loop-1', ['Loop: PBI #8 parked — go?']);
      // PATH of one empty directory (no agentlens): the cost comes from the script's price table
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      const { status, json } = await run(['-Transcript', t, '-Issue', '8'], { PATH: bin });
      expect(status).toBe(0);
      for (const k of [
        'source',
        'transcript',
        'ledger',
        'warnings',
        'main',
        'subagents',
        'roles',
        'fixRounds',
        'unattributedFixRounds',
        'tasks',
        'escalationShare',
        'rulings',
        'gates',
        'durations',
      ])
        expect(json).toHaveProperty(k);
      expect(json.runs).toHaveLength(1);
      // 1M sonnet input tokens = 3 USD (estimate, no measured cost)
      expect(json.runs[0]).toMatchObject({
        issue: 8,
        gates: 1,
        parked: true,
        rulings: ['go'],
        cost: 3,
        source: 'transcript',
      });
      expect(json.aggregate).toMatchObject({ gateCount: 1, parkedCount: 1, fixRoundsPerPbi: 0 });
    });
  });
});

describe('retro SKILL.md multi-run', () => {
  const skill = fs.readFileSync(
    path.resolve(__dirname, '../../../packages/delivery/.apm/skills/retro/SKILL.md'),
    'utf8'
  );

  it.each(['-Loop', '-Issues', '-Since', 'repeatedRulings', 'Loop: PBI #<n> parked'])(
    'mentions %s',
    (term) => {
      expect(skill).toContain(term);
    }
  );

  it('documents the per-PBI columns, the aggregate row and the repeated-ruling lines', () => {
    const line = skill.split('\n').find((l) => l.includes('one row per `runs[]` entry')) ?? '';
    expect(line).toContain('(issue, fix rounds, escalations, gates, parked, duration, cost)');
    expect(line).toContain('aggregate row from `aggregate`');
    expect(line).toContain('one line per `repeatedRulings[]`');
    expect(line).toContain('seven-column table stays for `-Issue`');
  });

  it('keeps the step anchors and adds at most 5 lines to the base file', () => {
    expect(skill).toContain('1. **Metrics.**');
    expect(skill).toContain('2. **Read primary sources.**');
    const base = spawnSync(
      'git',
      ['show', 'fd1950ad:packages/delivery/.apm/skills/retro/SKILL.md'],
      {
        cwd: path.resolve(__dirname, '../../..'),
        encoding: 'utf8',
      }
    );
    const lines = (t: string) => t.trimEnd().split('\n').length;
    // base commit unavailable (shallow clone): fall back to the absolute cap
    const cap = base.status === 0 ? lines(base.stdout) + 5 : 47;
    expect(lines(skill)).toBeLessThanOrEqual(cap);
  });
});
