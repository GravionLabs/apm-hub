import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  hasPwsh,
  posix,
  runBatchParallel,
  type BatchCase,
  type BatchResult,
} from '../../helpers/queue.helpers';

// Parked gates in the Feature/Epic queue (#579): a gated PBI is parked through the park script (PARK_SCRIPT, the fake
// test/helpers/fake-park.ps1 by default) and the queue runs the next 'next <nr>' iteration; exit 2 only at the end.
// Iteration k of the fake claude runs steps/<k>. All cases run batched, one beforeAll.

type Def = {
  args?: string[];
  steps: string[];
  env?: (dir: string) => Record<string, string | null>;
  gh?: boolean;
};

const gated = (n: number, q: string) =>
  `mkdir -p .agents/${n}; echo "Next PBI: #${n} T"; printf '%s\\n' '${q}'`;
const done = (n: number) =>
  `mkdir -p .agents/${n}; echo "Next PBI: #${n} T"; echo "Ledger complete." >> .agents/${n}/progress.md`;
const none = 'echo "Nothing selectable: Feature #10"';
const featureDone = 'echo "Feature #10 is done."';
// copies the queue cache as the next child sees it (invariant: parked entry saved before the next child starts)
const snap = 'cp .agents/queue-10.json snapshot.json; ';

// the whole case batch runs inside the beforeAll hook: far above the 30 s default on a loaded CI runner
const SETUP_TIMEOUT = 120_000;

describe.skipIf(!hasPwsh || !posix)('Invoke-OrchestratorQueue.ps1 parked gates (#579)', () => {
  let root: string;
  const defs = new Map<string, Def>();
  const dirs: Record<string, string> = {};
  const R: Record<string, BatchResult> = {};
  const reg = (key: string, def: Def) => (defs.set(key, def), key);
  const read = (key: string, f: string) => fs.readFileSync(path.join(dirs[key], f), 'utf8');
  const queue = (key: string) => JSON.parse(read(key, '.agents/queue-10.json'));
  const parkLog = (key: string) =>
    fs.existsSync(path.join(dirs[key], 'park.log'))
      ? read(key, 'park.log').trim().split('\n').filter(Boolean)
      : [];
  const calls = (key: string) => Number(read(key, 'count').trim());
  const outcomes = (key: string) =>
    (queue(key).pbis as { number: number | null; outcome: string }[]).map((p) => [
      p.number,
      p.outcome,
    ]);

  const main = reg('park-continue', {
    steps: [gated(11, 'Gate: Pick A or B?'), snap + done(12), none],
  });
  const noGate = reg('no-gate', { steps: [done(11), done(12), none] });
  const noGateDone = reg('no-gate-done', { steps: [done(11), featureDone] });
  const again = reg('again', { steps: [gated(11, 'Gate: Q1'), gated(11, 'Gate: Q1'), none] });
  const later = reg('again-later', {
    steps: [gated(11, 'Gate: Q1'), done(12), gated(11, 'Gate: Q1'), none],
  });
  const twoParked = reg('two-parked', {
    steps: [gated(11, '**Gate**: First?'), gated(12, '> Gate: Second?'), featureDone],
  });
  const parkExit = reg('park-exit', {
    steps: [gated(11, 'Gate: Q'), none],
    env: () => ({ FAKE_PARK_EXIT: '3' }),
  });
  const parkLabel = reg('park-label-failed', {
    steps: [gated(11, 'Gate: Q'), none],
    env: () => ({
      FAKE_PARK_OUT:
        '{"parked":true,"label":"failed","comment":"ok","ledger":"skipped","checkout":"failed"}',
    }),
  });
  const parkMissing = reg('park-missing', {
    steps: [gated(11, 'Gate: Q'), none],
    env: (dir) => ({ PARK_SCRIPT: path.join(dir, 'nope.ps1') }),
  });
  const laterFail = reg('later-fail', {
    steps: [gated(11, 'Gate: Q'), 'echo "Next PBI: #12 T"; exit 1', none],
  });
  const laterFailCont = reg('later-fail-continue', {
    args: ['-Feature', '10', '-ContinueOnError'],
    steps: [gated(11, 'Gate: Q'), 'echo "Next PBI: #12 T"; exit 1', none],
  });
  const contBlocked = reg('continue-fail-blocked', {
    args: ['-Feature', '10', '-ContinueOnError'],
    steps: ['echo "Next PBI: #12 T"; exit 1', none],
  });
  const noPbiGate = reg('gate-no-pbi', { steps: ['echo "Gate: which PBI?"'] });
  // the real Set-ParkedGate.ps1 (default lookup in the repository layout) against a fake gh
  const real = reg('real-script', {
    steps: [gated(11, 'Gate: Use the cache or not?'), none],
    env: () => ({ PARK_SCRIPT: null }),
    gh: true,
  });

  beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'queue-parked-')));
    const cases: BatchCase[] = [...defs.entries()].map(([key, def], i) => {
      const dir = path.join(root, `c${i}`);
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(path.join(dir, 'steps'), { recursive: true });
      fs.mkdirSync(bin);
      dirs[key] = dir;
      def.steps.forEach((s, k) => fs.writeFileSync(path.join(dir, 'steps', String(k + 1)), s));
      fs.writeFileSync(
        path.join(bin, 'claude'),
        `#!/bin/sh
c=$(cat "${dir}/count" 2>/dev/null || echo 0); c=$((c+1)); echo $c > "${dir}/count"
sh "${dir}/steps/$c"
`,
        { mode: 0o755 }
      );
      // always a fake gh: a done PBI makes the runner call Merge-ApprovedPr.ps1
      fs.writeFileSync(
        path.join(bin, 'gh'),
        `#!/bin/sh\nfor a in "$@"; do printf '[%s]' "$a" >> "${dir}/gh.log"; done; echo >> "${dir}/gh.log"\nexit 0\n`,
        { mode: 0o755 }
      );
      return {
        key,
        args: def.args ?? ['-Feature', '10'],
        cwd: dir,
        path: `${bin}${path.delimiter}${process.env.PATH}`,
        env: def.env?.(dir),
      };
    });
    const results = await runBatchParallel(cases);
    cases.forEach((c, i) => (R[c.key] = results[i]));
  }, SETUP_TIMEOUT);
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it('parks the gated PBI, runs the next PBI, lists it as parked and exits 2', () => {
    const r = R[main];
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(parkLog(main)).toEqual(['11|Pick A or B?']);
    expect(calls(main)).toBe(3);
    expect(outcomes(main)).toEqual([
      [11, 'parked'],
      [12, 'done'],
      [null, 'blocked'],
    ]);
    expect(queue(main)).toMatchObject({
      state: 'gate',
      exitCode: 2,
      parked: [{ number: 11, question: 'Pick A or B?' }],
    });
    expect(queue(main).pbis[0]).toMatchObject({ gate: 'Gate: Pick A or B?', note: null });
    expect(r.stdout).toContain('#11 parked - Pick A or B?');
    expect(r.stdout).toContain(
      'Parked in Feature #10: answer with /ruling <option> on each PBI, then run the queue again'
    );
    expect(r.stdout).not.toContain('Nothing selectable in Feature #10');
    expect(r.stdout).not.toContain('Gate on Feature');
  });

  it('writes the parked entry to queue-<nr>.json before the next child starts', () => {
    const s = JSON.parse(read(main, 'snapshot.json'));
    expect(s.state).toBe('running');
    expect(s.parked).toEqual([{ number: 11, question: 'Pick A or B?' }]);
    expect(s.pbis.map((p: { outcome: string }) => p.outcome)).toEqual(['parked']);
  });

  it('without a gate keeps today’s exit codes: 3 on Nothing selectable, 0 on done, no park call', () => {
    expect(R[noGate].status).toBe(3);
    expect(queue(noGate)).toMatchObject({ state: 'blocked', parked: [] });
    expect(R[noGateDone].status).toBe(0);
    expect(queue(noGateDone)).toMatchObject({ state: 'done', parked: [] });
    expect(R[noGateDone].stdout).not.toContain('Parked in');
    expect(parkLog(noGate)).toEqual([]);
    expect(parkLog(noGateDone)).toEqual([]);
  });

  it('stops with exit 1 when a parked PBI is selected again, in a row or later', () => {
    for (const k of [again, later]) {
      expect(R[k].status, R[k].stdout).toBe(1);
      expect(queue(k).state).toBe('failed');
      expect(queue(k).pbis.at(-1).note).toBe(
        'parked PBI selected again (needs-decision label missing?)'
      );
      expect(parkLog(k)).toEqual(['11|Q1']);
    }
    expect(calls(again)).toBe(2);
    expect(calls(later)).toBe(3);
  });

  it('parks several PBIs, strips markdown-wrapped gate prefixes and exits 2 even after "is done."', () => {
    const r = R[twoParked];
    expect(r.status).toBe(2);
    expect(parkLog(twoParked)).toEqual(['11|First?', '12|Second?']);
    expect(queue(twoParked).parked).toEqual([
      { number: 11, question: 'First?' },
      { number: 12, question: 'Second?' },
    ]);
    expect(r.stdout).toContain('#11 parked - First?');
    expect(r.stdout).toContain('#12 parked - Second?');
    expect(queue(twoParked)).toMatchObject({ state: 'gate', exitCode: 2 });
  });

  it('a failing park script is the entry note; the PBI stays parked and the queue continues', () => {
    expect(R[parkExit].status).toBe(2);
    expect(calls(parkExit)).toBe(2);
    expect(queue(parkExit).pbis[0]).toMatchObject({
      outcome: 'parked',
      note: 'park script failed (exit code 3)',
    });
    expect(R[parkExit].stdout).toContain('#11 parked - Q (park script failed (exit code 3))');
    expect(R[parkLabel].status).toBe(2);
    expect(queue(parkLabel).pbis[0]).toMatchObject({
      outcome: 'parked',
      note: 'park script failed: label, checkout',
    });
    expect(R[parkMissing].status).toBe(2);
    expect(queue(parkMissing).pbis[0].note).toBe(
      'park script failed: Set-ParkedGate.ps1 not found'
    );
  });

  it('a later failed PBI wins with exit 1 over the deferred exit 2 without -ContinueOnError', () => {
    expect(R[laterFail].status).toBe(1);
    expect(calls(laterFail)).toBe(2);
    expect(queue(laterFail)).toMatchObject({ state: 'failed', exitCode: 1 });
    expect(queue(laterFail).parked).toEqual([{ number: 11, question: 'Q' }]);
  });

  it('with -ContinueOnError runs past the failure, and the earlier failure still wins with exit 1 over parked and blocked', () => {
    expect(R[laterFailCont].status).toBe(1);
    expect(queue(laterFailCont)).toMatchObject({ state: 'failed', exitCode: 1 });
    expect(calls(laterFailCont)).toBe(3);
    expect(outcomes(laterFailCont)).toEqual([
      [11, 'parked'],
      [12, 'failed'],
      [null, 'blocked'],
    ]);
  });

  it('with -ContinueOnError a failure followed by Nothing selectable exits 1, not 3', () => {
    expect(R[contBlocked].status).toBe(1);
    expect(queue(contBlocked)).toMatchObject({ state: 'failed', exitCode: 1, parked: [] });
  });

  it('a gate without a selected PBI stays terminal (exit 2) and parks nothing', () => {
    expect(R[noPbiGate].status).toBe(2);
    expect(queue(noPbiGate).pbis[0]).toMatchObject({ number: null, outcome: 'gate' });
    expect(queue(noPbiGate).parked).toEqual([]);
    expect(parkLog(noPbiGate)).toEqual([]);
    expect(R[noPbiGate].stdout).toContain('Gate on Feature #10, queue stopped');
  });

  it('finds the real Set-ParkedGate.ps1 and passes the question as one argument', () => {
    const r = R[real];
    expect(r.status, r.stdout + r.stderr).toBe(2);
    const gh = read(real, 'gh.log');
    expect(gh).toContain('[issue][edit][11][--add-label][needs-decision]');
    expect(gh).toContain('[issue][comment][11][--body-file]');
    expect(queue(real).pbis[0]).toMatchObject({ outcome: 'parked' });
  });
});
