import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  GATE_ACCEPT,
  GATE_REJECT,
  hasPwsh,
  posix,
  queueHelpers,
  runBatchParallel,
  type BatchCase,
  type BatchResult,
} from '../../helpers/queue.helpers';

// Every case of the queue mode runs batched through queue-batch.ps1 (same pattern as queue.fast.test.ts), dealt to a few concurrent pwsh processes (a case takes ~0.7 s, too slow for one sequential process):
// the cases are registered while the file is collected (own temp dir, fake claude/gh binaries, optional per-case env and cwd),
// one beforeAll runs them all, and each `it` asserts on the result and the files of its own case. Nothing needs a separate
// pwsh process: the env cases (inherited AGENTS_LEDGER, unset DROMOS_STATE_DIR) go through the per-case env map of the batch.

// isolated git: no user/system config, no signing, fixed identity; every call must succeed
const gitIn = (cwd: string, ...a: string[]) => {
  const r = spawnSync(
    'git',
    ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    }
  );
  if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

// the per-case tools: everything that used to close over the per-test `dir` and `bin`
const toolsFor = (dir: string, bin: string) => {
  const { ledger, readLedger, calls } = queueHelpers(
    () => dir,
    () => bin
  );
  // fake claude: iteration k runs steps/<k> (a sh script); records AGENTS_LEDGER and args per call
  const fakeQueue = (steps: string[]) => {
    fs.rmSync(path.join(dir, 'steps'), { recursive: true, force: true });
    fs.rmSync(path.join(dir, 'count'), { force: true });
    fs.mkdirSync(path.join(dir, 'steps'));
    steps.forEach((body, i) => fs.writeFileSync(path.join(dir, 'steps', String(i + 1)), body));
    fs.writeFileSync(
      path.join(bin, 'claude'),
      `#!/bin/sh
c=$(cat "${dir}/count" 2>/dev/null || echo 0); c=$((c+1)); echo $c > "${dir}/count"
echo "$@" >> "${dir}/calls.log"
echo "[$c] \${AGENTS_LEDGER:-unset}" >> "${dir}/env.log"
sh "${dir}/steps/$c"
`,
      { mode: 0o755 }
    );
  };
  // fake gh: `pr list` prints the given PRs (or fails), `pr merge` exits with mergeExit
  const ghFake = (
    prs: object[],
    o: { listFails?: boolean; mergeExit?: number; view?: object } = {}
  ) => {
    fs.writeFileSync(path.join(dir, 'gh-list.json'), JSON.stringify(prs));
    fs.writeFileSync(path.join(dir, 'gh-view.json'), JSON.stringify(o.view ?? {}));
    fs.writeFileSync(
      path.join(bin, 'gh'),
      `#!/bin/sh
echo "$@" >> "${dir}/gh.log"
echo "$AGENTS_LEDGER" >> "${dir}/gh-env.log"
case "$1 $2" in
  "pr list") ${o.listFails ? 'echo "boom" >&2; exit 1' : `cat "${dir}/gh-list.json"`} ;;
  "pr view") cat "${dir}/gh-view.json" ;;
  "pr merge") exit ${o.mergeExit ?? 0} ;;
esac
exit 0
`,
      { mode: 0o755 }
    );
  };
  const ghCalls = () =>
    fs.existsSync(path.join(dir, 'gh.log'))
      ? fs.readFileSync(path.join(dir, 'gh.log'), 'utf8')
      : '';
  const queue = (nr = 10) =>
    JSON.parse(fs.readFileSync(path.join(dir, '.agents', `queue-${nr}.json`), 'utf8'));
  type Pbi = {
    number: number | null;
    outcome: string;
    pr: number | null;
    note: string | null;
    gate: string | null;
  };
  const outcomes = () => (queue().pbis as Pbi[]).map((p) => [p.number, p.outcome]);
  const lines = () => ghCalls().trim().split('\n').filter(Boolean);
  return {
    dir,
    bin,
    ledger,
    readLedger,
    calls,
    fakeQueue,
    ghFake,
    ghCalls,
    queue,
    outcomes,
    lines,
  };
};
type Tools = ReturnType<typeof toolsFor>;

type Def = {
  args: string[];
  setup: (t: Tools) => void;
  env?: (t: Tools) => Record<string, string | null>; // null removes the variable for this case
  cwd?: (t: Tools) => string;
  repo?: boolean; // start from a copy of the template repository (origin has feat/11-x at oid)
};

describe.skipIf(!hasPwsh)('Invoke-OrchestratorQueue.ps1', () => {
  describe.skipIf(!posix)('Feature and Epic queue mode', () => {
    let root: string;
    let tpl: string;
    let oid: string;
    const defs = new Map<string, Def>();
    const T: Record<string, Tools> = {};
    const R: Record<string, BatchResult> = {};

    const reg = (
      key: string,
      args: string[],
      setup: (t: Tools) => void,
      opts: Partial<Def> = {}
    ) => {
      if (defs.has(key)) throw new Error(`duplicate case ${key}`);
      defs.set(key, { args, setup, ...opts });
      return key;
    };
    const got = (key: string) => ({ r: R[key], t: T[key] });

    // a finished PBI run: announces the PBI, writes its ledger (optionally with the PR line) and prints extra output
    const pbiRun = (n: number, o: { pr?: number; out?: string } = {}) =>
      `mkdir -p .agents/${n}; echo "Next PBI: #${n} Title ${n}"; ` +
      (o.pr
        ? `echo "Phase pull-request: complete — https://github.com/o/r/pull/${o.pr}" >> .agents/${n}/progress.md; `
        : '') +
      `echo "Ledger complete." >> .agents/${n}/progress.md; ${o.out ?? ''}`;
    const doneStep =
      'echo "Feature #10 is done."; echo "Ledger complete. Start the next issue in a new session."';
    const defaultPr = {
      number: 101,
      state: 'OPEN',
      headRefName: 'feat/11-x',
      baseRefName: 'release/next',
      headRefOid: 'abc123',
      isCrossRepository: false,
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      statusCheckRollup: [{ conclusion: 'SUCCESS' }],
    };
    const approve = 'echo "Verdict: APPROVE"';
    const F10 = ['-Feature', '10'];
    const fq =
      (...steps: string[]) =>
      (t: Tools) =>
        t.fakeQueue(steps);

    beforeAll(async () => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-mode-'));
      // template repository of the -MergeApproved cases: origin has feat/11-x at oid, no local feat/11-x branch
      tpl = path.join(root, 'tpl');
      fs.mkdirSync(tpl);
      gitIn(tpl, 'init', '-q', '-b', 'main');
      gitIn(tpl, 'commit', '-q', '--allow-empty', '-m', 'x');
      oid = gitIn(tpl, 'rev-parse', 'HEAD');
      expect(oid).toMatch(/^[0-9a-f]{40,64}$/);
      gitIn(tpl, 'init', '-q', '--bare', path.join(tpl, 'upstream-store'));
      gitIn(tpl, 'remote', 'add', 'origin', path.join(tpl, 'upstream-store'));
      gitIn(tpl, 'push', '-q', 'origin', 'HEAD:refs/heads/feat/11-x');
      defaultPr.headRefOid = oid;

      const cases: BatchCase[] = [...defs.entries()].map(([key, def], i) => {
        const dir = path.join(root, `c${i}`);
        if (def.repo) {
          fs.cpSync(tpl, dir, { recursive: true });
          const cfg = path.join(dir, '.git', 'config');
          fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').split(tpl).join(dir));
        } else fs.mkdirSync(dir);
        const bin = path.join(dir, 'bin');
        fs.mkdirSync(bin);
        const t = (T[key] = toolsFor(dir, bin));
        def.setup(t);
        return {
          key,
          args: def.args,
          cwd: fs.realpathSync(def.cwd?.(t) ?? dir),
          path: `${bin}${path.delimiter}${process.env.PATH}`,
          env: def.env?.(t),
        };
      });
      const results = await runBatchParallel(cases);
      cases.forEach((c, i) => (R[c.key] = results[i]));
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    const loop = reg('loop', F10, fq(pbiRun(11, { pr: 101 }), pbiRun(12), doneStep));
    it('loops in fresh processes until the Feature is done and writes the queue json', () => {
      const { r, t } = got(loop);
      expect(r.status).toBe(0);
      expect(t.calls()).toHaveLength(3);
      expect(t.calls()[0]).toContain('-p next 10');
      const q = t.queue();
      expect(q).toMatchObject({
        queue: 10,
        kind: 'Feature',
        state: 'done',
        exitCode: 0,
        mergeApproved: false,
      });
      expect(t.outcomes()).toEqual([
        [11, 'done'],
        [12, 'done'],
      ]);
      expect(q.pbis[0].pr).toBe(101);
      expect(q.pbis[1].pr).toBeNull();
      expect(q.pbis[0].ledger).toBe(
        path.join(fs.realpathSync(t.dir), '.agents', '11', 'progress.md')
      );
      expect(Date.parse(q.started)).not.toBeNaN();
      expect(Date.parse(q.ended)).not.toBeNaN();
      expect(r.stdout).toContain('Feature #10 is done.');
    });

    const epic = reg('epic', ['-Epic', '10'], fq(pbiRun(11), 'echo "Epic #10 is done."'));
    it('ends an Epic run on "Epic #<nr> is done."', () => {
      const { r, t } = got(epic);
      expect(r.status).toBe(0);
      expect(t.queue()).toMatchObject({ kind: 'Epic', state: 'done' });
      expect(t.calls()).toHaveLength(2);
    });

    const lc1 = reg('lower-done', F10, fq('echo "feature #10 is done."'));
    const lc2 = reg('mismatched-done', F10, fq('echo "Epic #10 is done."'));
    const lc3 = reg(
      'lower-gate',
      F10,
      fq('mkdir -p .agents/11; echo "Next PBI: #11 T"; echo "gate: lower case"')
    );
    it('does not accept a lower-case or mismatched done/gate line', () => {
      expect(got(lc1).r.status).toBe(1);
      expect(got(lc2).r.status).toBe(1);
      const { r, t } = got(lc3);
      expect(r.status).toBe(1);
      expect(t.outcomes()).toEqual([[11, 'failed']]);
    });

    const exit3 = reg('done-exit3', F10, fq('echo "Feature #10 is done."; exit 3'));
    it('requires exit code 0 for "is done."', () => {
      const { r, t } = got(exit3);
      expect(r.status).toBe(1);
      expect(t.queue().state).toBe('failed');
    });

    describe('state directory resolution (no hermetic .agents override)', () => {
      const step = (n: number, stateRoot: string) =>
        `mkdir -p "${stateRoot}/${n}"; echo "Next PBI: #${n} T"; echo "Ledger complete." >> "${stateRoot}/${n}/progress.md"`;

      const otherState = () => path.join(root, 'queue-state-other');
      const absState = reg(
        'state-absolute',
        F10,
        (t) => t.fakeQueue([step(11, otherState()), doneStep]),
        {
          env: () => ({ DROMOS_STATE_DIR: otherState() + '/' }),
        }
      );
      it('honours an absolute DROMOS_STATE_DIR with a trailing slash outside the repository', () => {
        const { r, t } = got(absState);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        const q = JSON.parse(fs.readFileSync(path.join(otherState(), 'queue-10.json'), 'utf8'));
        expect(q.pbis[0].ledger).toBe(path.join(otherState(), '11', 'progress.md'));
        expect(fs.existsSync(path.join(t.dir, '.agents'))).toBe(false);
      });

      const wtOf = (t: Tools) => path.join(t.dir, 'wt');
      const common = (t: Tools) => path.join(fs.realpathSync(t.dir), '.git', 'agents');
      const shared = reg(
        'state-worktree',
        F10,
        (t) => {
          gitIn(t.dir, 'init', '-q', '-b', 'main');
          gitIn(t.dir, 'commit', '-q', '--allow-empty', '-m', 'x');
          gitIn(t.dir, 'worktree', 'add', '-q', wtOf(t), '-b', 'side');
          t.fakeQueue([step(11, common(t)), doneStep]);
        },
        { cwd: wtOf, env: () => ({ DROMOS_STATE_DIR: null }) }
      );
      it('shares <git common dir>/agents between the main checkout and a linked worktree', () => {
        const { r, t } = got(shared);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(fs.existsSync(path.join(common(t), 'queue-10.json'))).toBe(true);
        expect(fs.existsSync(path.join(wtOf(t), '.agents'))).toBe(false);
        expect(fs.existsSync(path.join(wtOf(t), '.git', 'agents'))).toBe(false);
      });

      const noRepo = reg('state-no-repo', F10, fq(doneStep), {
        env: (t) => ({
          DROMOS_STATE_DIR: null,
          GIT_CEILING_DIRECTORIES: path.dirname(fs.realpathSync(t.dir)),
        }),
      });
      it('fails with the state directory error outside a git repository without an override', () => {
        const { r, t } = got(noRepo);
        expect(r.status).not.toBe(0);
        expect(r.stdout + r.stderr).toContain(
          'No state directory: not inside a git repository (set DROMOS_STATE_DIR)'
        );
        expect(t.calls()).toHaveLength(0);
      });
    });

    const ambient = reg('ambient-ledger', F10, fq(pbiRun(11), doneStep), {
      env: () => ({ AGENTS_LEDGER: '/ambient/progress.md' }),
    });
    it('clears AGENTS_LEDGER before every child, also an inherited value, and restores nothing into children', () => {
      const { r, t } = got(ambient);
      expect(r.status).toBe(0);
      expect(fs.readFileSync(path.join(t.dir, 'env.log'), 'utf8').trim().split('\n')).toEqual([
        '[1] unset',
        '[2] unset',
      ]);
    });

    const gateStop = reg(
      'gate-stop',
      ['-Epic', '10'],
      fq(
        pbiRun(11),
        `mkdir -p .agents/12; echo "Next PBI: #12 T"; echo "Gate: Approve the plan?" >> .agents/12/progress.md`,
        doneStep
      )
    );
    it('stops at a Gate: line with exit 2 and records the gate text', () => {
      const { r, t } = got(gateStop);
      expect(r.status).toBe(2);
      expect(t.calls()).toHaveLength(2);
      expect(t.queue().state).toBe('gate');
      expect(t.queue().pbis[1]).toMatchObject({
        number: 12,
        outcome: 'gate',
        gate: 'Gate: Approve the plan?',
      });
      expect(r.stdout).toContain('Approve the plan?');
    });

    describe('gate line in the output', () => {
      const gateRun = (i: number, kind: string, line: string) =>
        reg(
          `gate-${kind}-${i}`,
          F10,
          fq(`mkdir -p .agents/11; echo "Next PBI: #11 T"; printf '%s\\n' '${line}'`)
        );
      GATE_ACCEPT.forEach((line, i) => {
        const k = gateRun(i, 'accept', line);
        it(`accepts ${line}: exit 2, state gate, gate text recorded`, () => {
          const { r, t } = got(k);
          expect(r.status).toBe(2);
          expect(t.queue().pbis[0]).toMatchObject({ number: 11, outcome: 'gate', gate: line });
          expect(r.stdout).toContain(
            `Gate on Feature #10, queue stopped (answer it, then run the queue again): ${line}`
          );
        });
      });
      GATE_REJECT.forEach((line, i) => {
        const k = gateRun(i, 'reject', line);
        it(`rejects ${line}: exit 1, PBI failed`, () => {
          const { r, t } = got(k);
          expect(r.status).toBe(1);
          expect(t.outcomes()).toEqual([[11, 'failed']]);
          expect(r.stdout).not.toContain('Gate on Feature');
        });
      });
      const wrapped = reg('gate-wrapped-nopbi', F10, fq(`printf '%s\\n' '**Gate**: which PBI?'`));
      it('accepts a wrapped gate without a selected PBI', () => {
        const { r, t } = got(wrapped);
        expect(r.status).toBe(2);
        expect(t.queue().pbis[0]).toMatchObject({
          number: null,
          outcome: 'gate',
          gate: '**Gate**: which PBI?',
        });
      });
      const ledgerOnly = reg(
        'gate-ledger-only',
        F10,
        fq(
          `mkdir -p .agents/11; echo "Next PBI: #11 T"; echo '**Gate**: ledger only' >> .agents/11/progress.md`
        )
      );
      it('counts a wrapped gate written only to the PBI ledger', () => {
        const { r, t } = got(ledgerOnly);
        expect(r.status).toBe(2);
        expect(t.queue().pbis[0].gate).toBe('**Gate**: ledger only');
      });
    });

    const oldGate = reg('gate-old-ledger', F10, (t) => {
      t.ledger(12, 'Gate: old question', 'Phase read: complete');
      t.fakeQueue([
        'mkdir -p .agents/12; echo "Next PBI: #12 T"; echo "Gate: new question" >> .agents/12/progress.md',
      ]);
    });
    it('detects a gate that exists only in the ledger as a count increase, ignoring an old Gate: line', () => {
      const { r, t } = got(oldGate);
      expect(r.status).toBe(2);
      expect(t.queue().pbis[0].gate).toBe('Gate: new question');
    });

    const resumedFail = reg('resumed-fail', F10, (t) => {
      t.ledger(12, 'Gate: old question');
      t.fakeQueue(['echo "Next PBI: #12 T"']);
    });
    it('does not report an old ledger gate as a gate when the resumed run just fails', () => {
      const { r, t } = got(resumedFail);
      expect(r.status).toBe(1);
      expect(t.outcomes()).toEqual([[12, 'failed']]);
    });

    const ledgerWins = reg(
      'ledger-wins',
      F10,
      fq(pbiRun(11, { out: 'echo "Gate: stale"' }), doneStep)
    );
    it('lets a complete PBI ledger win over a Gate: line in the output (as in positional mode)', () => {
      const { r, t } = got(ledgerWins);
      expect(r.status).toBe(0);
      expect(t.outcomes()).toEqual([[11, 'done']]);
    });

    const failClosed = reg(
      'fail-closed',
      F10,
      fq(pbiRun(11), 'echo "Next PBI: #12 T"; echo boom >&2; exit 1', doneStep)
    );
    it('stops with exit 1 on a failed run, fail closed', () => {
      const { r, t } = got(failClosed);
      expect(r.status).toBe(1);
      expect(t.calls()).toHaveLength(2);
      expect(t.queue().state).toBe('failed');
      expect(t.outcomes()).toEqual([
        [11, 'done'],
        [12, 'failed'],
      ]);
    });

    const nothingUseful = reg('nothing-useful', F10, fq('echo "nothing useful"'));
    it('fails when the output names neither a PBI nor Feature done', () => {
      const { r, t } = got(nothingUseful);
      expect(r.status).toBe(1);
      expect(t.queue().pbis[0]).toMatchObject({ number: null, outcome: 'failed' });
    });

    const blocked = reg(
      'blocked',
      F10,
      fq('echo "Nothing selectable: Feature #10"; echo "#12 waiting for merge: PR #5"')
    );
    it('reports "Nothing selectable" as state blocked with exit 3, not as a failure', () => {
      const { r, t } = got(blocked);
      expect(r.status).toBe(3);
      expect(t.queue()).toMatchObject({ state: 'blocked', exitCode: 3 });
      expect(t.queue().pbis[0]).toMatchObject({ number: null, outcome: 'blocked' });
      expect(r.stdout).toContain('Nothing selectable in Feature #10');
    });

    const blockedFail = reg(
      'blocked-exit1',
      F10,
      fq('echo "Nothing selectable: Feature #10"; exit 1')
    );
    it('does not read "Nothing selectable" from a run that exited non-zero', () => {
      expect(got(blockedFail).r.status).toBe(1);
    });

    const twice = reg('twice', F10, fq(pbiRun(11), pbiRun(11), pbiRun(12), doneStep));
    it('stops when the same PBI is selected twice in a row', () => {
      const { r, t } = got(twice);
      expect(r.status).toBe(1);
      expect(t.calls()).toHaveLength(2);
      expect(t.queue().pbis[1].note).toContain('twice in a row');
    });

    const contA = reg(
      'continue-a',
      [...F10, '-ContinueOnError'],
      fq('echo "Next PBI: #11 T"; exit 1', pbiRun(12), doneStep)
    );
    const contB = reg(
      'continue-b',
      [...F10, '-ContinueOnError'],
      fq('echo "Next PBI: #11 T"; exit 1', 'echo "Next PBI: #11 T"; exit 1', doneStep)
    );
    it('with -ContinueOnError continues only when next picks a different PBI, and exits 1', () => {
      const a = got(contA);
      expect(a.r.status).toBe(1);
      expect(a.t.calls()).toHaveLength(3);
      expect(a.t.outcomes()).toEqual([
        [11, 'failed'],
        [12, 'done'],
      ]);
      const b = got(contB);
      expect(b.r.status).toBe(1);
      expect(b.t.calls()).toHaveLength(2);
    });

    const skipped = reg('skipped', F10, (t) => {
      t.ledger(11, 'Ledger complete.');
      t.fakeQueue([`echo "Next PBI: #11 T"`, doneStep]);
    });
    it('marks a selected PBI whose ledger was already complete as skipped', () => {
      const { r, t } = got(skipped);
      expect(r.status).toBe(0);
      expect(t.outcomes()).toEqual([[11, 'skipped']]);
    });

    const merged = reg(
      'merged-list',
      F10,
      fq('echo "Feature #10 is done — merged, closes at release: #5, #6"')
    );
    it('lists PBIs from "merged, closes at release" on the done line as merged', () => {
      const { r, t } = got(merged);
      expect(r.status).toBe(0);
      expect(t.outcomes()).toEqual([
        [5, 'merged'],
        [6, 'merged'],
      ]);
    });

    const bigPbi = reg(
      'big-pbi',
      F10,
      fq(
        'mkdir -p .agents/4294967299; echo "Next PBI: #4294967299 T"; echo "Ledger complete." >> .agents/4294967299/progress.md',
        doneStep
      )
    );
    it('handles a PBI number beyond int range', () => {
      const { r, t } = got(bigPbi);
      expect(r.status).toBe(0);
      expect(t.queue().pbis[0].number).toBe(4294967299);
    });

    const logs = reg(
      'logs',
      F10,
      fq(pbiRun(11, { out: 'echo "hello 11"; echo "err 11" >&2' }), doneStep)
    );
    it('writes queue-<nr>.log and appends each PBI output with the exit trailer to .agents/<pbi>/run.log', () => {
      const { t } = got(logs);
      const qlog = fs.readFileSync(path.join(t.dir, '.agents/queue-10.log'), 'utf8');
      expect(qlog).toContain('hello 11');
      expect(qlog.match(/=== exit code 0/g)).toHaveLength(2);
      const plog = fs.readFileSync(path.join(t.dir, '.agents/11/run.log'), 'utf8');
      expect(plog).toContain('hello 11');
      expect(plog).toContain('err 11');
      expect(plog).toContain('=== exit code 0');
    });

    const runnerErr = reg('runner-error', F10, (t) => {
      fs.mkdirSync(path.join(t.dir, 'elsewhere'));
      fs.mkdirSync(path.join(t.dir, '.agents'));
      fs.symlinkSync(path.join(t.dir, 'elsewhere'), path.join(t.dir, '.agents/11'));
      t.fakeQueue([pbiRun(11), doneStep]);
    });
    it('on an unexpected runner error writes the queue json as failed and exits non-zero', () => {
      const { r, t } = got(runnerErr);
      expect(r.status).not.toBe(0);
      expect(t.queue()).toMatchObject({ state: 'failed', exitCode: 1 });
      expect(t.queue().pbis.at(-1).note).toContain('runner error');
    });

    // run.log is a directory: Add-Content throws inside the loop, in the generic catch
    const runLogDir = reg(
      'runlog-dir',
      F10,
      fq('mkdir -p .agents/11/run.log; echo "Next PBI: #11 T"', doneStep)
    );
    it('ends in state failed (not running) when the runner throws without the symlink guard, and starts no further child', () => {
      const { r, t } = got(runLogDir);
      expect(r.status).not.toBe(0);
      expect(t.queue()).toMatchObject({ state: 'failed', exitCode: 1 });
      expect(t.queue().pbis.at(-1).note).toContain('runner error');
      expect(t.calls()).toHaveLength(1);
    });

    const commonDir = reg(
      'common-dir',
      F10,
      (t) => {
        gitIn(t.dir, 'init', '-q');
        t.fakeQueue([doneStep]);
      },
      { env: () => ({ DROMOS_STATE_DIR: null }) }
    );
    it('writes queue-<nr>.json and the log under <git common dir>/agents when DROMOS_STATE_DIR is unset', () => {
      const { r, t } = got(commonDir);
      expect(r.status).toBe(0);
      expect(
        JSON.parse(fs.readFileSync(path.join(t.dir, '.git', 'agents', 'queue-10.json'), 'utf8'))
          .queue
      ).toBe(10);
      expect(fs.existsSync(path.join(t.dir, '.git', 'agents', 'queue-10.log'))).toBe(true);
      expect(fs.existsSync(path.join(t.dir, '.agents'))).toBe(false);
    });

    const dangling = reg('symlink-dangling', F10, (t) => {
      fs.symlinkSync(path.join(t.dir, 'nowhere'), path.join(t.dir, '.agents'));
      t.fakeQueue([doneStep]);
    });
    it('refuses a dangling symlinked .agents/', () => {
      const { r } = got(dangling);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Refusing symlinked path');
    });

    const symlinked = reg('symlink', F10, (t) => {
      fs.mkdirSync(path.join(t.dir, 'elsewhere'));
      fs.symlinkSync(path.join(t.dir, 'elsewhere'), path.join(t.dir, '.agents'));
      t.fakeQueue([doneStep]);
    });
    it('refuses a symlinked .agents/', () => {
      const { r, t } = got(symlinked);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Refusing symlinked path');
      expect(t.calls()).toHaveLength(0);
    });

    describe('-MergeApproved', () => {
      const MA = [...F10, '-MergeApproved'];
      // every case starts from a copy of the template repository (origin has feat/11-x at oid)
      const mreg = (key: string, args: string[], setup: (t: Tools) => void) =>
        reg(key, args, setup, { repo: true });
      const pbiApprove = (pr = 101) => pbiRun(11, { pr, out: approve });

      const byDefault = mreg('no-merge-default', F10, (t) => {
        t.ghFake([defaultPr]);
        t.fakeQueue([pbiApprove(), doneStep]);
      });
      it('does not merge by default, even with an APPROVE verdict', () => {
        const { r, t } = got(byDefault);
        expect(r.status).toBe(0);
        expect(t.ghCalls()).toBe('');
        expect(t.outcomes()).toEqual([[11, 'done']]);
      });

      const absPath = mreg('ledger-path', MA, (t) => {
        t.ghFake([defaultPr]);
        t.fakeQueue([pbiApprove(), doneStep]);
      });
      it('exposes the PBI ledger as one absolute path to runner-side tools (no cwd prefix on an absolute state dir)', () => {
        const { r, t } = got(absPath);
        expect(r.status).toBe(0);
        const seen = [
          ...new Set(fs.readFileSync(path.join(t.dir, 'gh-env.log'), 'utf8').trim().split('\n')),
        ];
        expect(seen).toEqual([path.join(fs.realpathSync(t.dir), '.agents', '11', 'progress.md')]);
        expect(fs.existsSync(seen[0])).toBe(true);
      });

      const squash = mreg('squash', MA, (t) => {
        t.ghFake([defaultPr]);
        t.fakeQueue([pbiApprove(), doneStep]);
      });
      it('squash-merges the PBI PR pinned to its head commit', () => {
        const { r, t } = got(squash);
        expect(r.status).toBe(0);
        expect(t.lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
        expect(t.outcomes()).toEqual([[11, 'merged']]);
        expect(t.queue().pbis[0].pr).toBe(101);
        expect(t.queue().state).toBe('done');
        expect(t.calls()).toHaveLength(2);
      });

      const byBranch = mreg('find-by-branch', MA, (t) => {
        t.ghFake([defaultPr]);
        t.fakeQueue([pbiRun(11, { out: approve }), doneStep]);
      });
      it('finds the PR by the PBI head branch when the ledger has no PR line', () => {
        const { t } = got(byBranch);
        expect(t.lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
      });

      const noMergeRows: [string, string, object | null, string][] = [
        [
          'CHANGES_REQUESTED verdict',
          'echo "Verdict: CHANGES_REQUESTED"',
          defaultPr,
          'verdict is not a plain APPROVE',
        ],
        [
          'a later non-APPROVE verdict wins',
          'echo "Verdict: APPROVE"; echo "Verdict: CHANGES_REQUESTED"',
          defaultPr,
          'verdict is not a plain APPROVE',
        ],
        [
          'lower-case verdict',
          'echo "Verdict: approve"',
          defaultPr,
          'verdict is not a plain APPROVE',
        ],
        [
          'APPROVE with a suffix after a dash',
          'echo "Verdict: APPROVE - but 2 HIGH findings"',
          defaultPr,
          'verdict is not a plain APPROVE',
        ],
        [
          'APPROVE with a trailing comment',
          'echo "Verdict: APPROVE, see below"',
          defaultPr,
          'verdict is not a plain APPROVE',
        ],
        [
          'prose that mentions approve',
          'echo "I would APPROVE this"; echo "approve"',
          defaultPr,
          'no Verdict: line',
        ],
        ['no verdict at all', 'echo ok', defaultPr, 'no Verdict: line'],
        [
          'release head with a non-main base',
          approve,
          { ...defaultPr, headRefName: 'release/11-x', baseRefName: 'develop' },
          'release PR',
        ],
        [
          'main base with a non-release head',
          approve,
          { ...defaultPr, baseRefName: 'main' },
          'is not the integration branch',
        ],
        [
          'base that is not release/*',
          approve,
          { ...defaultPr, baseRefName: 'develop' },
          'is not the integration branch',
        ],
        ['a PR that is not open', approve, { ...defaultPr, state: 'MERGED' }, 'state MERGED'],
        [
          'a PR of another PBI branch',
          approve,
          { ...defaultPr, headRefName: 'feat/99-other' },
          'no single open PR of PBI #11',
        ],
        [
          'a cross-repository PR',
          approve,
          { ...defaultPr, isCrossRepository: true },
          'fork or cross-repository PR',
        ],
        [
          'unknown cross-repository status',
          approve,
          { ...defaultPr, isCrossRepository: undefined },
          'fork or cross-repository PR',
        ],
        [
          'a missing head commit',
          approve,
          { ...defaultPr, headRefOid: undefined },
          'head commit unknown',
        ],
        [
          'failing checks',
          approve,
          {
            ...defaultPr,
            statusCheckRollup: [{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }],
          },
          'checks are not green',
        ],
        [
          'pending checks',
          approve,
          { ...defaultPr, statusCheckRollup: [{ state: 'PENDING' }] },
          'checks are not green',
        ],
        [
          'an empty check list',
          approve,
          { ...defaultPr, statusCheckRollup: [] },
          'no checks reported',
        ],
        [
          'a missing check list',
          approve,
          { ...defaultPr, statusCheckRollup: undefined },
          'no checks reported',
        ],
        [
          'a PR that is not clean',
          approve,
          { ...defaultPr, mergeStateStatus: 'BLOCKED' },
          'not mergeable/clean (MERGEABLE/BLOCKED)',
        ],
        [
          'a conflicting PR',
          approve,
          { ...defaultPr, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' },
          'not mergeable/clean (CONFLICTING/DIRTY)',
        ],
        ['APPROVE without any PR', approve, null, 'no single open PR of PBI #11'],
      ];
      noMergeRows.forEach(([name, out, pr, note], i) => {
        const k = mreg(`no-merge-${i}`, MA, (t) => {
          t.ghFake(pr ? [pr] : []);
          t.fakeQueue([pbiRun(11, { pr: pr ? 101 : undefined, out }), doneStep]);
        });
        it(`does not merge: ${name}`, () => {
          const { r, t } = got(k);
          expect(r.status).toBe(0);
          expect(t.ghCalls()).not.toContain('pr merge');
          expect(t.outcomes()).toEqual([[11, 'done']]);
          expect(t.queue().state).toBe('done');
          expect(t.queue().pbis[0].note).toContain(note);
        });
      });

      describe('UNKNOWN mergeability right after PR creation', () => {
        const unknown = () => ({
          ...defaultPr,
          mergeable: 'UNKNOWN',
          mergeStateStatus: 'UNKNOWN',
          statusCheckRollup: [],
        });
        const polls = mreg('unknown-merges', MA, (t) => {
          t.ghFake([unknown()], {
            view: {
              mergeable: 'MERGEABLE',
              mergeStateStatus: 'CLEAN',
              statusCheckRollup: [{ conclusion: 'SUCCESS' }],
            },
          });
          t.fakeQueue([pbiApprove(), doneStep]);
        });
        it('polls gh pr view and merges once GitHub has computed MERGEABLE/CLEAN', () => {
          const { t } = got(polls);
          expect(t.lines()).toContain(
            'pr view 101 --json mergeable,mergeStateStatus,statusCheckRollup'
          );
          expect(t.lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
        });
        const stays = mreg('unknown-stays', MA, (t) => {
          t.ghFake([unknown()], {
            view: { mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN', statusCheckRollup: [] },
          });
          t.fakeQueue([pbiApprove(), doneStep]);
        });
        it('skips the merge after three polls that stay UNKNOWN', () => {
          const { r, t } = got(stays);
          expect(r.status).toBe(0);
          expect(t.lines().filter((l) => l.startsWith('pr view'))).toHaveLength(3);
          expect(t.ghCalls()).not.toContain('pr merge');
          expect(t.queue().pbis[0].note).toContain('mergeability still UNKNOWN after 3 polls');
        });
      });

      const childFail = mreg('child-nonzero', MA, (t) => {
        t.ghFake([defaultPr]);
        t.fakeQueue([pbiRun(11, { pr: 101, out: `${approve}; exit 1` }), doneStep]);
      });
      it('does not merge when the child exited non-zero even with a complete ledger and APPROVE', () => {
        const { r, t } = got(childFail);
        expect(t.ghCalls()).not.toContain('pr merge');
        expect(t.outcomes()).toEqual([[11, 'done']]);
        expect(t.queue().pbis[0].note).toContain('child exit code 1');
        expect(r.status).toBe(0); // ledger wins for the outcome, only the merge is withheld
      });

      const twoPrs = mreg('two-prs', MA, (t) => {
        t.ghFake([defaultPr, { ...defaultPr, number: 102, headRefName: 'fix/11-again' }]);
        t.fakeQueue([pbiRun(11, { out: approve }), doneStep]);
      });
      it('does not merge when two open PRs match the PBI branch and the ledger names none', () => {
        const { t } = got(twoPrs);
        expect(t.ghCalls()).not.toContain('pr merge');
        expect(t.queue().pbis[0].note).toContain('PBI #11');
      });

      const pbi1 = mreg('pbi-1', MA, (t) => {
        t.ghFake([defaultPr]);
        t.fakeQueue([pbiRun(1, { out: approve }), 'echo "Feature #10 is done."']);
      });
      it('does not let PBI 1 match a feat/11-x branch', () => {
        expect(got(pbi1).t.ghCalls()).not.toContain('pr merge');
      });

      const notJson = mreg('list-not-json', MA, (t) => {
        t.ghFake([defaultPr]);
        fs.writeFileSync(path.join(t.dir, 'gh-list.json'), 'not json at all');
        t.fakeQueue([pbiApprove(), doneStep]);
      });
      it('does not merge when gh pr list returns something that is not JSON', () => {
        const { t } = got(notJson);
        expect(t.ghCalls()).not.toContain('pr merge');
        expect(t.outcomes()).toEqual([[11, 'done']]);
      });

      describe('head verification', () => {
        const other = 'ffffffffffffffffffffffffffffffffffffffff';
        const sameTip = mreg('head-same', MA, (t) => {
          gitIn(t.dir, 'branch', 'feat/11-x');
          t.ghFake([{ ...defaultPr, headRefOid: oid }]);
          t.fakeQueue([pbiApprove(), doneStep]);
        });
        it('merges when the local branch tip equals the PR head', () => {
          expect(got(sameTip).t.ghCalls()).toContain(
            `pr merge 101 --squash --match-head-commit ${oid}`
          );
        });
        const localDiffers = mreg('head-local-differs', MA, (t) => {
          gitIn(t.dir, 'branch', 'feat/11-x');
          t.ghFake([{ ...defaultPr, headRefOid: other }]);
          t.fakeQueue([pbiApprove(), doneStep]);
        });
        it('skips the merge when the local branch tip differs from the PR head', () => {
          const { t } = got(localDiffers);
          expect(t.ghCalls().includes('pr merge')).toBe(false);
          expect(t.queue().pbis[0].note).toContain(`differs from local branch tip ${oid}`);
        });
        const originDiffers = mreg('head-origin-differs', MA, (t) => {
          t.ghFake([{ ...defaultPr, headRefOid: other }]);
          t.fakeQueue([pbiApprove(), doneStep]);
        });
        it('without a local branch, skips when the origin branch tip differs from the PR head', () => {
          const { t } = got(originDiffers);
          expect(t.ghCalls().includes('pr merge')).toBe(false);
          expect(t.queue().pbis[0].note).toContain(`differs from origin branch tip ${oid}`);
        });
        const noOrigin = mreg('head-no-origin', MA, (t) => {
          gitIn(t.dir, 'remote', 'remove', 'origin');
          t.ghFake([defaultPr]);
          t.fakeQueue([pbiApprove(), doneStep]);
        });
        it('without a local branch and without a reachable origin, skips because the head cannot be verified', () => {
          const { t } = got(noOrigin);
          expect(t.ghCalls().includes('pr merge')).toBe(false);
          expect(t.queue().pbis[0].note).toContain('cannot be verified');
        });
      });

      const notAmong = mreg('ledger-pr-not-open', MA, (t) => {
        t.ghFake([{ ...defaultPr, number: 555 }]);
        t.fakeQueue([pbiApprove(), doneStep]);
      });
      it('does not merge when the ledger PR is not among the open PRs of the PBI', () => {
        expect(got(notAmong).t.ghCalls()).not.toContain('pr merge');
      });

      const listFails = mreg('list-fails', MA, (t) => {
        t.ghFake([defaultPr], { listFails: true });
        t.fakeQueue([pbiApprove(), doneStep]);
      });
      it('does not merge when gh pr list fails', () => {
        const { r, t } = got(listFails);
        expect(r.status).toBe(0);
        expect(t.ghCalls()).not.toContain('pr merge');
        expect(t.queue().pbis[0].note).toContain('gh pr list failed');
      });

      const onGate = mreg('on-gate', MA, (t) => {
        t.ghFake([defaultPr]);
        t.fakeQueue([
          `mkdir -p .agents/11; echo "Next PBI: #11 T"; ${approve}; echo "Gate: ok?" >> .agents/11/progress.md`,
        ]);
      });
      it('does not merge on a gate', () => {
        const { r, t } = got(onGate);
        expect(r.status).toBe(2);
        expect(t.ghCalls()).not.toContain('pr merge');
      });

      const failedApprove = mreg('failed-approve', MA, (t) => {
        t.ghFake([defaultPr]);
        t.fakeQueue([`echo "Next PBI: #11 T"; ${approve}; exit 1`]);
      });
      it('does not merge a failed iteration that printed APPROVE', () => {
        const { r, t } = got(failedApprove);
        expect(r.status).toBe(1);
        expect(t.ghCalls()).not.toContain('pr merge');
      });

      const mergeFails = mreg('merge-fails', MA, (t) => {
        t.ghFake([defaultPr], { mergeExit: 1 });
        t.fakeQueue([pbiApprove(), doneStep]);
      });
      it('records failed and exits 1 when gh pr merge fails', () => {
        const { r, t } = got(mergeFails);
        expect(r.status).toBe(1);
        expect(t.ghCalls()).toContain('pr merge 101');
        expect(t.outcomes()).toEqual([[11, 'failed']]);
        expect(t.queue().pbis[0].note).toContain('merge');
        expect(t.queue().state).toBe('failed');
        expect(t.calls()).toHaveLength(1);
      });
    });
  });
});
