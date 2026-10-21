import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/delivery/.apm/skills/retro/scripts/Get-RunMetrics.ps1',
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

const msg = (id: string, model: string, usage: object) =>
  JSON.stringify({ type: 'assistant', message: { id, role: 'assistant', model, content: [], usage } });

if (!hasPwsh && process.env.CI) throw new Error('pwsh is required in CI');

describe.skipIf(!hasPwsh)('Get-RunMetrics.ps1', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (args: string[], cwd = dir, stateDir: string | null = path.join(dir, '.agents')) => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], { encoding: 'utf8', cwd, env: { ...process.env, DROMOS_STATE_DIR: stateDir ?? '' } });
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

  it('finds the newest ledger under <git common dir>/agents without -Ledger or -Issue', () => {
    const { transcript } = fixture();
    spawnSync('git', ['init', '-q'], { cwd: dir });
    fs.mkdirSync(path.join(dir, '.git', 'agents', '7'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git', 'agents', '7', 'progress.md'), 'Fix round 1: x\nFix round 2: y\n');
    const viaCommon = run(['-Transcript', transcript], dir, null);
    expect(viaCommon.json.fixRounds).toBe(2);
    expect(viaCommon.json.ledger).toMatch(/agents[\/]7[\/]progress\.md$/);
    expect(run(['-Transcript', transcript, '-Issue', '7'], dir, null).json.fixRounds).toBe(2);
  });

  it('finds the ledger from a linked worktree via the shared <git common dir>/agents', () => {
    const { transcript } = fixture();
    const g = (cwd: string, ...a: string[]) => expect(spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' } }).status).toBe(0);
    g(dir, 'init', '-q', '-b', 'main');
    g(dir, 'commit', '-q', '--allow-empty', '-m', 'x');
    const wt = path.join(dir, 'wt');
    g(dir, 'worktree', 'add', '-q', wt, '-b', 'side');
    fs.mkdirSync(path.join(dir, '.git', 'agents', '5'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git', 'agents', '5', 'progress.md'), 'Fix round 1: x\n');
    const r = run(['-Transcript', transcript, '-Issue', '5'], wt, null);
    expect(r.json.fixRounds).toBe(1);
    expect(r.json.ledger).toMatch(/\.git[\/\\]agents[\/\\]5[\/\\]progress\.md$/);
  });

  it('honours DROMOS_STATE_DIR, also an absolute one with a trailing slash outside the repository', () => {
    const { transcript } = fixture();
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-state-'));
    try {
      fs.mkdirSync(path.join(other, '3'));
      fs.writeFileSync(path.join(other, '3', 'progress.md'), 'Fix round 1: x\nFix round 2: y\nFix round 3: z\n');
      const r = run(['-Transcript', transcript, '-Issue', '3'], dir, other + path.sep);
      expect(r.json.fixRounds).toBe(3);
      expect(r.json.ledger).toBe(path.join(other, '3', 'progress.md'));
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')('reads (never writes) through a symlinked state directory', () => {
    const { transcript } = fixture();
    const real = path.join(dir, 'real');
    fs.mkdirSync(path.join(real, '4'), { recursive: true });
    fs.writeFileSync(path.join(real, '4', 'progress.md'), 'Fix round 1: x\n');
    const link = path.join(dir, 'linked');
    fs.symlinkSync(real, link);
    const r = run(['-Transcript', transcript, '-Issue', '4'], dir, link);
    expect(r.status).toBe(0);
    expect(r.json.fixRounds).toBe(1);
    expect(fs.readdirSync(real)).toEqual(['4']);
  });

  it('reports no ledger outside a git repository without DROMOS_STATE_DIR', () => {
    const { transcript } = fixture();
    const r = run(['-Transcript', transcript, '-Issue', '7'], dir, null);
    expect(r.status).toBe(0);
    expect(r.json.ledger).toBeNull();
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

  it('fails with a clear message when no transcript exists', () => {
    const r = run([]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('No transcript found');
  });

  it('rejects a non-numeric -Issue', () => {
    const t = path.join(dir, 's.jsonl');
    fs.writeFileSync(t, '');
    expect(run(['-Transcript', t, '-Issue', '../x']).status).not.toBe(0);
  });

  it('reports zero requests for an empty transcript and warns about the missing ledger', () => {
    const t = path.join(dir, 'e.jsonl');
    fs.writeFileSync(t, '');
    const { json } = run(['-Transcript', t]);
    expect(json.main.requests).toBe(0);
    expect(json.main.peakContext).toBe(0);
    expect(json.warnings.length).toBe(1);
    expect(json.fixRounds).toBe(0);
  });

  it('uses the max for peak context and per field across duplicate ids', () => {
    const t = path.join(dir, 'p.jsonl');
    fs.writeFileSync(
      t,
      [
        msg('a', 'claude-sonnet-5-5', { input_tokens: 9000, output_tokens: 1 }),
        msg('b', 'claude-sonnet-5-5', { input_tokens: 10, output_tokens: 5 }),
        msg('b', 'claude-sonnet-5-5', { input_tokens: 4, output_tokens: 2 }),
      ].join('\n') + '\n',
    );
    const { json } = run(['-Transcript', t]);
    expect(json.main.requests).toBe(2);
    expect(json.main.peakContext).toBe(9000);
    expect(json.main.outputTokens).toBe(6);
  });

  it('skips sidechain records in the main transcript', () => {
    const t = path.join(dir, 'sc.jsonl');
    const side = { ...JSON.parse(msg('s', 'claude-sonnet-5-5', { input_tokens: 500, output_tokens: 1 })), isSidechain: true };
    fs.writeFileSync(t, JSON.stringify(side) + '\n' + msg('m', 'claude-sonnet-5-5', { input_tokens: 5, output_tokens: 1 }) + '\n');
    const { json } = run(['-Transcript', t]);
    expect(json.main.requests).toBe(1);
    expect(json.main.peakContext).toBe(5);
  });

  it('handles metas without agentType, malformed metas and metas without jsonl', () => {
    const t = path.join(dir, 'x.jsonl');
    fs.writeFileSync(t, '');
    const sub = path.join(dir, 'x', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'a.meta.json'), '{}');
    fs.writeFileSync(path.join(sub, 'a.jsonl'), msg('q', 'claude-haiku-4-5', { input_tokens: 1000000, output_tokens: 0 }) + '\n');
    fs.writeFileSync(path.join(sub, 'b.meta.json'), '{bad');
    fs.writeFileSync(path.join(sub, 'c.meta.json'), JSON.stringify({ agentType: '../evil role' }));
    const { json } = run(['-Transcript', t]);
    expect(json.subagents.skipped).toBe(1);
    expect(json.subagents.count).toBe(2);
    const roles = json.subagents.byRole;
    expect(roles.length).toBe(1);
    expect(roles[0].role).toBe('unknown');
    expect(roles[0].requests).toBe(1);
  });

  it('keeps measured and estimated cost apart and ignores unknown model families', () => {
    const t = path.join(dir, 'mix.jsonl');
    const e = { ...JSON.parse(msg('a', 'claude-opus-4-5', { input_tokens: 1, output_tokens: 1 })), costUSD: 0.25 };
    fs.writeFileSync(
      t,
      [JSON.stringify(e), msg('b', 'claude-haiku-4-5', { input_tokens: 1000000, output_tokens: 0 }), msg('c', 'gpt-x', { input_tokens: 1000000, output_tokens: 0 })].join('\n') + '\n',
    );
    const { json } = run(['-Transcript', t]);
    expect(json.main.costMeasured).toBe(0.25);
    expect(json.main.costEstimated).toBeCloseTo(1, 4);
  });

  it('prices opus at 5/25 and 1-hour cache writes at 2x', () => {
    const t = path.join(dir, 'o.jsonl');
    fs.writeFileSync(
      t,
      msg('a', 'claude-opus-4-5', {
        input_tokens: 1000000,
        output_tokens: 1000000,
        cache_creation_input_tokens: 1000000,
        cache_creation: { ephemeral_1h_input_tokens: 1000000 },
      }) + '\n',
    );
    expect(run(['-Transcript', t]).json.main.costEstimated).toBeCloseTo(5 + 25 + 10, 4);
  });

  it('parses bulleted ledger lines, copes with an empty ledger and redacts secrets', () => {
    const t = path.join(dir, 'l.jsonl');
    fs.writeFileSync(t, '');
    const l = path.join(dir, 'l.md');
    fs.writeFileSync(
      l,
      ['- Fix round 1: x', '  Ruling: use ghp_abcdef123456 now', '- Gate: Bearer abc.def and password=hunter2', 'Ruling: sk-abcdefghijkl'].join('\n') + '\n',
    );
    const { json } = run(['-Transcript', t, '-Ledger', l]);
    expect(json.fixRounds).toBe(1);
    expect(json.rulings.count).toBe(2);
    expect(json.gates.count).toBe(1);
    const all = JSON.stringify(json);
    for (const secret of ['ghp_abcdef', 'abc.def', 'hunter2', 'sk-abcdefghijkl']) expect(all).not.toContain(secret);
    const empty = path.join(dir, 'empty.md');
    fs.writeFileSync(empty, '');
    expect(run(['-Transcript', t, '-Ledger', empty]).json.rulings.count).toBe(0);
  });

  describe('per-task ledger metrics', () => {
    const metrics = (lines: string[]) => {
      const t = path.join(dir, 't.jsonl');
      fs.writeFileSync(t, '');
      const l = path.join(dir, 'tasks.md');
      fs.writeFileSync(l, lines.join('\n') + '\n');
      return run(['-Transcript', t, '-Ledger', l]).json;
    };

    it('reports model, rounds and status per task with no escalation', () => {
      const json = metrics([
        '# ledger',
        'Task #11: DONE — abc1234 — model sonnet',
        'Task #12: DONE — def5678 — model opus',
        'Phase review: complete — n/a',
        'Fix round 1: DONE — model opus',
      ]);
      expect(json.tasks).toEqual([
        { task: 11, model: 'sonnet', status: 'DONE', fixRounds: 0, escalated: false, escalatedTo: null, reviewRounds: 1 },
        { task: 12, model: 'opus', status: 'DONE', fixRounds: 1, escalated: false, escalatedTo: null, reviewRounds: 1 },
      ]);
      expect(json.escalationShare).toBe(0);
      expect(json.fixRounds).toBe(1);
    });

    it('yields null models for ledgers without the model suffix and 0 share without tasks', () => {
      const old = metrics(['Task #5: DONE — abc1234', 'Fix round 1: DONE']);
      expect(old.tasks).toEqual([{ task: 5, model: null, status: 'DONE', fixRounds: 1, escalated: false, escalatedTo: null, reviewRounds: 0 }]);
      expect(old.escalationShare).toBe(0);
      const none = metrics(['# ledger']);
      expect(none.tasks).toEqual([]);
      expect(none.escalationShare).toBe(0);
    });

    it('escalates a task whose fix round runs on a different named model, with that model as target', () => {
      const json = metrics(['Task #1: DONE — a — model sonnet', 'Fix round 1 (#1): DONE — model opus']);
      expect(json.tasks[0]).toMatchObject({ fixRounds: 1, escalated: true, escalatedTo: 'opus' });
    });

    it('escalates a task at fix round 3 even on the same model', () => {
      const json = metrics(['Task #1: DONE — a — model sonnet', 'Fix round 3 (#1): x — model sonnet']);
      expect(json.tasks[0]).toMatchObject({ fixRounds: 1, escalated: true });
    });

    it('does not escalate on fix rounds 1-2 with the same model', () => {
      const json = metrics(['Task #1: DONE — a — model sonnet', 'Fix round 1 (#1): x — model sonnet', 'Fix round 2 (#1): x — model sonnet']);
      expect(json.tasks[0]).toMatchObject({ fixRounds: 2, escalated: false, escalatedTo: null });
    });

    it('does not escalate when either side has no model suffix', () => {
      const json = metrics([
        'Task #1: DONE — a — model sonnet',
        'Fix round 1 (#1): x',
        'Task #2: DONE — b',
        'Fix round 1 (#2): x — model opus',
      ]);
      expect(json.tasks.map((t: { escalated: boolean }) => t.escalated)).toEqual([false, false]);
    });

    it('reports escalatedTo null for a fix round 3 on inherit', () => {
      const json = metrics(['Task #1: DONE — a — model sonnet', 'Fix round 3 (#1): x — model inherit']);
      expect(json.tasks[0]).toMatchObject({ escalated: true, escalatedTo: null });
    });

    it('reports the share of escalated tasks', () => {
      const json = metrics([
        'Task #1: DONE — a — model sonnet',
        'Fix round 1 (#1): x — model opus',
        'Task #2: DONE — b — model sonnet',
        'Task #3: DONE — c — model sonnet',
        'Task #4: DONE — d — model sonnet',
      ]);
      expect(json.escalationShare).toBe(0.25);
    });

    it('attributes a legacy fix line with a model suffix to the last Task line', () => {
      const json = metrics(['Task #1: DONE — a — model sonnet', 'Task #2: DONE — b — model sonnet', 'Fix round 1: x — model opus']);
      expect(json.tasks.map((t: { fixRounds: number }) => t.fixRounds)).toEqual([0, 1]);
      expect(json.tasks[1]).toMatchObject({ escalated: true, escalatedTo: 'opus' });
      expect(json.unattributedFixRounds).toBe(0);
    });

    it('tracks a single task without issue under its plan id', () => {
      const json = metrics(['Task #p1: DONE — a — model sonnet', 'Fix round 1 (#p1): x — model sonnet', 'Fix round 3 (#p1): x — model opus']);
      expect(json.tasks).toEqual([
        { task: 'p1', model: 'sonnet', status: 'DONE', fixRounds: 2, escalated: true, escalatedTo: 'opus', reviewRounds: 0 },
      ]);
      expect(json.unattributedFixRounds).toBe(0);
      expect(json.escalationShare).toBe(1);
    });

    it('ignores a Task line whose id is neither a number nor a plan id', () => {
      const json = metrics(['Task #abc: DONE — a', 'Fix round 1 (#abc): x']);
      expect(json.tasks).toEqual([]);
      expect(json.unattributedFixRounds).toBe(1);
    });

    it('attributes fix rounds to the named task, not the last Task line', () => {
      const json = metrics([
        'Task #1: DONE — a — model sonnet',
        'Task #2: DONE — b — model sonnet',
        'Fix round 1 (#1): DONE — model sonnet',
        'Fix round 2 (#1): DONE — model sonnet',
      ]);
      expect(json.tasks.map((t: { fixRounds: number }) => t.fixRounds)).toEqual([2, 0]);
    });

    it('falls back to the last Task line for old fix lines and ignores a stray #number in the text', () => {
      const json = metrics([
        'Task #1: DONE — a',
        'Task #2: DONE — b',
        'Fix round 1: resolved #1 findings',
      ]);
      expect(json.tasks.map((t: { fixRounds: number }) => t.fixRounds)).toEqual([0, 1]);
    });

    it('keeps counters when a Task line repeats and the latest status wins', () => {
      const json = metrics([
        'Task #1: BLOCKED — a — model sonnet',
        'Fix round 1 (#1): x — model sonnet',
        'Task #1: DONE — b — model opus',
      ]);
      expect(json.tasks).toHaveLength(1);
      expect(json.tasks[0]).toMatchObject({ status: 'DONE', model: 'opus', fixRounds: 1 });
    });

    it('handles mixed ledgers with and without model suffixes', () => {
      const json = metrics([
        'Task #1: DONE — a — model sonnet',
        'Task #2: DONE — b',
        'Fix round 1 (#2): x — model opus',
      ]);
      expect(json.tasks.map((t: { model: string | null }) => t.model)).toEqual(['sonnet', null]);
      expect(json.escalationShare).toBe(0);
    });

    it('does not count inherit versus a named model as escalation, but a different named model is, with its target', () => {
      const json = metrics([
        'Task #1: DONE — a — model inherit',
        'Fix round 1 (#1): x — model opus',
        'Task #2: DONE — b — model sonnet',
        'Fix round 1 (#2): x — model inherit',
        'Task #3: DONE — c — model sonnet',
        'Fix round 1 (#3): x — model opus',
      ]);
      expect(json.tasks.map((t: { escalated: boolean }) => t.escalated)).toEqual([false, false, true]);
      expect(json.tasks[2].escalatedTo).toBe('opus');
    });

    it('counts only Phase review lines as review rounds', () => {
      const json = metrics(['Task #1: DONE — a', 'Phase review: complete — n/a', 'Review round 2: x', 'Phase review: complete — n/a']);
      expect(json.tasks[0].reviewRounds).toBe(2);
    });

    it('keeps a fix round with an unknown target unattributed instead of charging the last task', () => {
      const json = metrics(['Task #1: DONE — a — model sonnet', 'Task #2: DONE — b — model sonnet', 'Fix round 1 (#p9): x — model opus']);
      expect(json.tasks.map((t: { fixRounds: number }) => t.fixRounds)).toEqual([0, 0]);
      expect(json.fixRounds).toBe(1);
      expect(json.unattributedFixRounds).toBe(1);
    });

    it('leaves a fix round unattributed when no Task line precedes it', () => {
      const json = metrics(['Fix round 1: x', 'Task #1: DONE — a']);
      expect(json.tasks[0].fixRounds).toBe(0);
      expect(json.unattributedFixRounds).toBe(1);
    });

    it('reads bulleted Task and Fix round lines', () => {
      const json = metrics(['- Task #1: DONE — a — model sonnet', '* Fix round 1 (#1): x — model opus']);
      expect(json.tasks[0]).toMatchObject({ fixRounds: 1, escalated: true, escalatedTo: 'opus' });
    });

    it('does not replace a model with null on a repeated Task line without suffix', () => {
      const json = metrics(['Task #1: BLOCKED — a — model opus', 'Task #1: DONE — b']);
      expect(json.tasks[0]).toMatchObject({ model: 'opus', status: 'DONE' });
    });

    it('reports escalatedTo null for round 3 without a model and ignores an oversized task number', () => {
      const json = metrics(['Task #1: DONE — a', 'Fix round 3 (#1): x', 'Task #99999999999: DONE — z']);
      expect(json.tasks[0]).toMatchObject({ escalated: true, escalatedTo: null });
      expect(json.tasks).toHaveLength(1);
    });

    it('reports the run-wide review count on every task', () => {
      const json = metrics(['Task #1: DONE — a', 'Task #2: DONE — b', 'Phase review: complete — n/a', 'Phase review: complete — n/a']);
      expect(json.tasks.map((t: { reviewRounds: number }) => t.reviewRounds)).toEqual([2, 2]);
    });
  });

  describe('durations from ledger timestamps', () => {
    const metrics = (lines: string[]) => {
      const t = path.join(dir, 't.jsonl');
      fs.writeFileSync(t, '');
      const l = path.join(dir, 'dur.md');
      fs.writeFileSync(l, lines.join('\n') + '\n');
      return run(['-Transcript', t, '-Ledger', l]).json;
    };

    const FIXTURE = [
      '2026-10-21T10:00:00Z # orchestrator ledger — issue #1 — branch feat/1-x',
      '2026-10-21T10:00:10Z Phase read: complete — n/a',
      '2026-10-21T10:00:40Z Phase explore: complete — n/a',
      '2026-10-21T10:01:10Z Phase Plan: complete — plan.json',
      '2026-10-21T10:05:10Z Task #11: DONE — abc1234 — model sonnet',
      '2026-10-21T10:05:11Z Subagent implementer: stopped — ok',
      '2026-10-21T10:06:10Z Fix round 1 (#11): 1 fixed — model sonnet',
      '2026-10-21T10:08:10Z Task #12: DONE — def5678 — model sonnet',
      '2026-10-21T10:09:00Z Phase implement: complete — abc1234',
      '2026-10-21T10:09:30Z Phase verify: complete — n/a',
      '2026-10-21T10:11:30Z Phase review: complete — n/a',
      '2026-10-21T10:11:50Z Fix round 2 (#12): 1 fixed — model sonnet',
      '2026-10-21T10:12:50Z Phase Pull request: complete — https://example.com/o/r/pull/3',
    ];

    it('computes total, phases, tasks and fix rounds from consecutive timestamps', () => {
      const d = metrics(FIXTURE).durations;
      expect(d.total).toBe(770);
      expect(d.phases).toEqual({ read: 10, explore: 30, plan: 30, implement: 470, verify: 30, review: 120, pr: 80 });
      // a Task ends at its line and starts at the previous Phase-complete, Task or Fix round line
      expect(d.tasks).toEqual([
        { task: 11, seconds: 240 },
        { task: 12, seconds: 120 },
      ]);
      expect(d.fixRounds).toEqual([
        { round: 1, task: 11, seconds: 60 },
        { round: 2, task: 12, seconds: 20 },
      ]);
    });

    it('accepts lines with and without the prefix; untimed spans and absent phases are null', () => {
      const d = metrics([
        '# orchestrator ledger',
        'Phase read: complete — n/a',
        '2026-10-21T10:00:00Z Phase plan: complete — plan.json',
        '2026-10-21T10:00:30Z Task #1: DONE — abc — model sonnet',
        'Task #2: DONE — def — model sonnet',
        '2026-10-21T10:01:00Z Fix round 1 (#2): x',
      ]).durations;
      expect(d.total).toBe(60);
      expect(d.phases.read).toBeNull();
      expect(d.phases.plan).toBeNull(); // starts at the untimed read line
      expect(d.phases.pr).toBeNull();
      expect(d.tasks).toEqual([
        { task: 1, seconds: 30 },
        { task: 2, seconds: null },
      ]);
      expect(d.fixRounds).toEqual([{ round: 1, task: 2, seconds: null }]);
    });

    it('reads Phase verify: ok|fail lines with the tests part as the verify phase', () => {
      const d = metrics([
        '2026-10-21T10:00:00Z # h',
        '2026-10-21T10:01:00Z Phase verify: fail — tests 3/5',
        '2026-10-21T10:01:30Z Fix round 1 (#1): x — model sonnet — tests 5/5',
        '2026-10-21T10:03:00Z Phase verify: ok — tests 5/5',
      ]).durations;
      expect(d.phases.verify).toBe(180);
    });

    it('still parses the tasks of a prefixed ledger', () => {
      const json = metrics(FIXTURE);
      expect(json.tasks.map((t: { task: number; status: string }) => [t.task, t.status])).toEqual([[11, 'DONE'], [12, 'DONE']]);
      expect(json.fixRounds).toBe(2);
    });

    it('gives null everywhere for a ledger without timestamps, never an error', () => {
      const json = metrics(['# ledger', 'Phase read: complete — n/a', 'Task #5: DONE — abc', 'Fix round 1 (#5): x', 'Phase review: complete — n/a']);
      expect(json.durations.total).toBeNull();
      expect(Object.values(json.durations.phases).every((v) => v === null)).toBe(true);
      expect(Object.keys(json.durations.phases)).toEqual(['read', 'explore', 'plan', 'implement', 'verify', 'review', 'pr']);
      expect(json.durations.tasks).toEqual([{ task: 5, seconds: null }]);
      expect(json.durations.fixRounds).toEqual([{ round: 1, task: 5, seconds: null }]);
    });

    it('reports an empty durations block without a ledger', () => {
      const t = path.join(dir, 't.jsonl');
      fs.writeFileSync(t, '');
      const json = run(['-Transcript', t, '-Ledger', path.join(dir, 'missing.md')]).json;
      expect(json.durations.total).toBeNull();
      expect(json.durations.tasks).toEqual([]);
      expect(json.durations.fixRounds).toEqual([]);
    });

    it('treats a clock going backwards as null', () => {
      const d = metrics(['2026-10-21T10:10:00Z # h', '2026-10-21T10:05:00Z Phase read: complete — n/a']).durations;
      expect(d.phases.read).toBeNull();
    });
  });
});
