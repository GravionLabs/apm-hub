import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SCRIPT, hasPwsh, posix, queueHelpers } from './queue.helpers';

describe.skipIf(!hasPwsh)('Invoke-OrchestratorQueue.ps1', () => {
  let dir: string;
  let bin: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-'));
    bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { ledger, readLedger, run, fakeClaude, calls } = queueHelpers(
    () => dir,
    () => bin,
  );

  describe.skipIf(!posix)('Feature and Epic queue mode', () => {
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
        { mode: 0o755 },
      );
    };
    const PR_URL = 'https://github.com/o/r/pull/101';
    // a finished PBI run: announces the PBI, writes its ledger (optionally with the PR line) and prints extra output
    const pbiRun = (n: number, o: { pr?: number; out?: string } = {}) =>
      `mkdir -p .agents/${n}; echo "Next PBI: #${n} Title ${n}"; ` +
      (o.pr ? `echo "Phase pull-request: complete — https://github.com/o/r/pull/${o.pr}" >> .agents/${n}/progress.md; ` : '') +
      `echo "Ledger complete." >> .agents/${n}/progress.md; ${o.out ?? ''}`;
    const doneStep = 'echo "Feature #10 is done."; echo "Ledger complete. Start the next issue in a new session."';
    const queue = (nr = 10) => JSON.parse(fs.readFileSync(path.join(dir, '.agents', `queue-${nr}.json`), 'utf8'));
    type Pbi = { number: number | null; outcome: string; pr: number | null; note: string | null; gate: string | null };
    const outcomes = () => (queue().pbis as Pbi[]).map((p) => [p.number, p.outcome]);

    const defaultPr = { number: 101, state: 'OPEN', headRefName: 'feat/11-x', baseRefName: 'release/next', headRefOid: 'abc123', isCrossRepository: false, mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ conclusion: 'SUCCESS' }] };
    // fake gh: `pr list` prints the given PRs (or fails), `pr merge` exits with mergeExit
    const ghFake = (prs: object[] = [defaultPr], o: { listFails?: boolean; mergeExit?: number; view?: object } = {}) => {
      fs.writeFileSync(path.join(dir, 'gh-list.json'), JSON.stringify(prs));
      fs.writeFileSync(path.join(dir, 'gh-view.json'), JSON.stringify(o.view ?? {}));
      fs.writeFileSync(
        path.join(bin, 'gh'),
        `#!/bin/sh
echo "$@" >> "${dir}/gh.log"
case "$1 $2" in
  "pr list") ${o.listFails ? 'echo "boom" >&2; exit 1' : `cat "${dir}/gh-list.json"`} ;;
  "pr view") cat "${dir}/gh-view.json" ;;
  "pr merge") exit ${o.mergeExit ?? 0} ;;
esac
exit 0
`,
        { mode: 0o755 },
      );
    };
    const ghCalls = () => (fs.existsSync(path.join(dir, 'gh.log')) ? fs.readFileSync(path.join(dir, 'gh.log'), 'utf8') : '');
    const approve = 'echo "Verdict: APPROVE"';

    it('loops in fresh processes until the Feature is done and writes the queue json', () => {
      fakeQueue([pbiRun(11, { pr: 101 }), pbiRun(12), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(calls()).toHaveLength(3);
      expect(calls()[0]).toContain('-p next 10');
      const q = queue();
      expect(q).toMatchObject({ queue: 10, kind: 'Feature', state: 'done', exitCode: 0, mergeApproved: false });
      expect(outcomes()).toEqual([[11, 'done'], [12, 'done']]);
      expect(q.pbis[0].pr).toBe(101);
      expect(q.pbis[1].pr).toBeNull();
      expect(q.pbis[0].ledger).toBe('.agents/11/progress.md');
      expect(Date.parse(q.started)).not.toBeNaN();
      expect(Date.parse(q.ended)).not.toBeNaN();
      expect(r.stdout).toContain('Feature #10 is done.');
    });

    it('ends an Epic run on "Epic #<nr> is done."', () => {
      fakeQueue([pbiRun(11), 'echo "Epic #10 is done."']);
      const r = run(['-Epic', '10'], true);
      expect(r.status).toBe(0);
      expect(queue()).toMatchObject({ kind: 'Epic', state: 'done' });
      expect(calls()).toHaveLength(2);
    });

    it('does not accept a lower-case or mismatched done/gate line', () => {
      fakeQueue(['echo "feature #10 is done."']);
      expect(run(['-Feature', '10'], true).status).toBe(1);
      fakeQueue(['echo "Epic #10 is done."']);
      expect(run(['-Feature', '10'], true).status).toBe(1);
      fakeQueue(['mkdir -p .agents/11; echo "Next PBI: #11 T"; echo "gate: lower case"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(outcomes()).toEqual([[11, 'failed']]);
    });

    it('requires exit code 0 for "is done."', () => {
      fakeQueue(['echo "Feature #10 is done."; exit 3']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(queue().state).toBe('failed');
    });

    it('clears AGENTS_LEDGER before every child, also an inherited value, and restores nothing into children', () => {
      fakeQueue([pbiRun(11), doneStep]);
      const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Feature', '10'], {
        encoding: 'utf8', cwd: dir, env: { ...process.env, AGENTS_LEDGER: '/ambient/progress.md', PATH: `${bin}${path.delimiter}${process.env.PATH}` },
      });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(path.join(dir, 'env.log'), 'utf8').trim().split('\n')).toEqual(['[1] unset', '[2] unset']);
    });

    it('stops at a Gate: line with exit 2 and records the gate text', () => {
      fakeQueue([pbiRun(11), `mkdir -p .agents/12; echo "Next PBI: #12 T"; echo "Gate: Approve the plan?" >> .agents/12/progress.md`, doneStep]);
      const r = run(['-Epic', '10'], true);
      expect(r.status).toBe(2);
      expect(calls()).toHaveLength(2);
      expect(queue().state).toBe('gate');
      expect(queue().pbis[1]).toMatchObject({ number: 12, outcome: 'gate', gate: 'Gate: Approve the plan?' });
      expect(r.stdout).toContain('Approve the plan?');
    });

    it('detects a gate that exists only in the ledger as a count increase, ignoring an old Gate: line', () => {
      ledger(12, 'Gate: old question', 'Phase read: complete');
      fakeQueue(['mkdir -p .agents/12; echo "Next PBI: #12 T"; echo "Gate: new question" >> .agents/12/progress.md']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(2);
      expect(queue().pbis[0].gate).toBe('Gate: new question');
    });

    it('does not report an old ledger gate as a gate when the resumed run just fails', () => {
      ledger(12, 'Gate: old question');
      fakeQueue(['echo "Next PBI: #12 T"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(outcomes()).toEqual([[12, 'failed']]);
    });

    it('lets a complete PBI ledger win over a Gate: line in the output (as in positional mode)', () => {
      fakeQueue([pbiRun(11, { out: 'echo "Gate: stale"' }), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(outcomes()).toEqual([[11, 'done']]);
    });

    it('stops with exit 1 on a failed run, fail closed', () => {
      fakeQueue([pbiRun(11), 'echo "Next PBI: #12 T"; echo boom >&2; exit 1', doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(2);
      expect(queue().state).toBe('failed');
      expect(outcomes()).toEqual([[11, 'done'], [12, 'failed']]);
    });

    it('fails when the output names neither a PBI nor Feature done', () => {
      fakeQueue(['echo "nothing useful"']);
      expect(run(['-Feature', '10'], true).status).toBe(1);
      expect(queue().pbis[0]).toMatchObject({ number: null, outcome: 'failed' });
    });

    it('reports "Nothing selectable" as state blocked with exit 3, not as a failure', () => {
      fakeQueue(['echo "Nothing selectable: Feature #10"; echo "#12 waiting for merge: PR #5"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(3);
      expect(queue()).toMatchObject({ state: 'blocked', exitCode: 3 });
      expect(queue().pbis[0]).toMatchObject({ number: null, outcome: 'blocked' });
      expect(r.stdout).toContain('Nothing selectable in Feature #10');
    });

    it('does not read "Nothing selectable" from a run that exited non-zero', () => {
      fakeQueue(['echo "Nothing selectable: Feature #10"; exit 1']);
      expect(run(['-Feature', '10'], true).status).toBe(1);
    });

    it('stops when the same PBI is selected twice in a row', () => {
      fakeQueue([pbiRun(11), pbiRun(11), pbiRun(12), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(2);
      expect(queue().pbis[1].note).toContain('twice in a row');
    });

    it('with -ContinueOnError continues only when next picks a different PBI, and exits 1', () => {
      fakeQueue(['echo "Next PBI: #11 T"; exit 1', pbiRun(12), doneStep]);
      const r = run(['-Feature', '10', '-ContinueOnError'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(3);
      expect(outcomes()).toEqual([[11, 'failed'], [12, 'done']]);
      fakeQueue(['echo "Next PBI: #11 T"; exit 1', 'echo "Next PBI: #11 T"; exit 1', doneStep]);
      expect(run(['-Feature', '10', '-ContinueOnError'], true).status).toBe(1);
      expect(calls()).toHaveLength(5);
    });

    it('marks a selected PBI whose ledger was already complete as skipped', () => {
      ledger(11, 'Ledger complete.');
      fakeQueue([`echo "Next PBI: #11 T"`, doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(outcomes()).toEqual([[11, 'skipped']]);
    });

    it('lists PBIs from "merged, closes at release" on the done line as merged', () => {
      fakeQueue(['echo "Feature #10 is done — merged, closes at release: #5, #6"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(outcomes()).toEqual([[5, 'merged'], [6, 'merged']]);
    });

    it('handles a PBI number beyond int range', () => {
      fakeQueue(['mkdir -p .agents/4294967299; echo "Next PBI: #4294967299 T"; echo "Ledger complete." >> .agents/4294967299/progress.md', doneStep]);
      expect(run(['-Feature', '10'], true).status).toBe(0);
      expect(queue().pbis[0].number).toBe(4294967299);
    });

    it('writes queue-<nr>.log and appends each PBI output with the exit trailer to .agents/<pbi>/run.log', () => {
      fakeQueue([pbiRun(11, { out: 'echo "hello 11"; echo "err 11" >&2' }), doneStep]);
      run(['-Feature', '10'], true);
      const qlog = fs.readFileSync(path.join(dir, '.agents/queue-10.log'), 'utf8');
      expect(qlog).toContain('hello 11');
      expect(qlog.match(/=== exit code 0/g)).toHaveLength(2);
      const plog = fs.readFileSync(path.join(dir, '.agents/11/run.log'), 'utf8');
      expect(plog).toContain('hello 11');
      expect(plog).toContain('err 11');
      expect(plog).toContain('=== exit code 0');
    });

    it('on an unexpected runner error writes the queue json as failed and exits non-zero', () => {
      fs.mkdirSync(path.join(dir, 'elsewhere'));
      fs.mkdirSync(path.join(dir, '.agents'));
      fs.symlinkSync(path.join(dir, 'elsewhere'), path.join(dir, '.agents/11'));
      fakeQueue([pbiRun(11), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).not.toBe(0);
      expect(queue()).toMatchObject({ state: 'failed', exitCode: 1 });
      expect(queue().pbis.at(-1).note).toContain('runner error');
    });

    it('ends in state failed (not running) when the runner throws without the symlink guard, and starts no further child', () => {
      // run.log is a directory: Add-Content throws inside the loop, in the generic catch
      fakeQueue(['mkdir -p .agents/11/run.log; echo "Next PBI: #11 T"', doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).not.toBe(0);
      expect(queue()).toMatchObject({ state: 'failed', exitCode: 1 });
      expect(queue().pbis.at(-1).note).toContain('runner error');
      expect(calls()).toHaveLength(1);
    });

    it('refuses a dangling symlinked .agents/', () => {
      fs.symlinkSync(path.join(dir, 'nowhere'), path.join(dir, '.agents'));
      fakeQueue([doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Refusing symlinked path');
    });

    it('refuses a symlinked .agents/', () => {
      fs.mkdirSync(path.join(dir, 'elsewhere'));
      fs.symlinkSync(path.join(dir, 'elsewhere'), path.join(dir, '.agents'));
      fakeQueue([doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Refusing symlinked path');
      expect(calls()).toHaveLength(0);
    });

    describe('-MergeApproved', () => {
      const lines = () => ghCalls().trim().split('\n').filter(Boolean);
      // isolated git: no user/system config, no signing, fixed identity; every call must succeed
      const git = (...a: string[]) => {
        const r = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
          cwd: dir,
          encoding: 'utf8',
          env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
        });
        expect(r.status, `git ${a.join(' ')}: ${r.stderr}`).toBe(0);
        return r.stdout.trim();
      };
      let oid: string;
      // a repo whose origin has feat/11-x at oid; there is no local feat/11-x branch unless a test creates it
      beforeEach(() => {
        git('init', '-q', '-b', 'main');
        git('commit', '-q', '--allow-empty', '-m', 'x');
        oid = git('rev-parse', 'HEAD');
        expect(oid).toMatch(/^[0-9a-f]{40,64}$/);
        git('init', '-q', '--bare', path.join(dir, 'upstream-store'));
        git('remote', 'add', 'origin', path.join(dir, 'upstream-store'));
        git('push', '-q', 'origin', 'HEAD:refs/heads/feat/11-x');
        defaultPr.headRefOid = oid;
      });

      it('does not merge by default, even with an APPROVE verdict', () => {
        ghFake();
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        expect(run(['-Feature', '10'], true).status).toBe(0);
        expect(ghCalls()).toBe('');
        expect(outcomes()).toEqual([[11, 'done']]);
      });

      it('squash-merges the PBI PR pinned to its head commit', () => {
        ghFake();
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(0);
        expect(lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
        expect(outcomes()).toEqual([[11, 'merged']]);
        expect(queue().pbis[0].pr).toBe(101);
        expect(queue().state).toBe('done');
        expect(calls()).toHaveLength(2);
      });

      it('finds the PR by the PBI head branch when the ledger has no PR line', () => {
        ghFake();
        fakeQueue([pbiRun(11, { out: approve }), doneStep]);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
      });

      it.each([
        ['CHANGES_REQUESTED verdict', 'echo "Verdict: CHANGES_REQUESTED"', defaultPr, 'verdict is not a plain APPROVE'],
        ['a later non-APPROVE verdict wins', 'echo "Verdict: APPROVE"; echo "Verdict: CHANGES_REQUESTED"', defaultPr, 'verdict is not a plain APPROVE'],
        ['lower-case verdict', 'echo "Verdict: approve"', defaultPr, 'verdict is not a plain APPROVE'],
        ['APPROVE with a suffix after a dash', 'echo "Verdict: APPROVE - but 2 HIGH findings"', defaultPr, 'verdict is not a plain APPROVE'],
        ['APPROVE with a trailing comment', 'echo "Verdict: APPROVE, see below"', defaultPr, 'verdict is not a plain APPROVE'],
        ['prose that mentions approve', 'echo "I would APPROVE this"; echo "approve"', defaultPr, 'no Verdict: line'],
        ['no verdict at all', 'echo ok', defaultPr, 'no Verdict: line'],
        ['release head with a non-main base', approve, { ...defaultPr, headRefName: 'release/11-x', baseRefName: 'develop' }, 'release PR'],
        ['main base with a non-release head', approve, { ...defaultPr, baseRefName: 'main' }, 'is not the integration branch'],
        ['base that is not release/*', approve, { ...defaultPr, baseRefName: 'develop' }, 'is not the integration branch'],
        ['a PR that is not open', approve, { ...defaultPr, state: 'MERGED' }, 'state MERGED'],
        ['a PR of another PBI branch', approve, { ...defaultPr, headRefName: 'feat/99-other' }, 'no single open PR of PBI #11'],
        ['a cross-repository PR', approve, { ...defaultPr, isCrossRepository: true }, 'fork or cross-repository PR'],
        ['unknown cross-repository status', approve, { ...defaultPr, isCrossRepository: undefined }, 'fork or cross-repository PR'],
        ['a missing head commit', approve, { ...defaultPr, headRefOid: undefined }, 'head commit unknown'],
        ['failing checks', approve, { ...defaultPr, statusCheckRollup: [{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }] }, 'checks are not green'],
        ['pending checks', approve, { ...defaultPr, statusCheckRollup: [{ state: 'PENDING' }] }, 'checks are not green'],
        ['an empty check list', approve, { ...defaultPr, statusCheckRollup: [] }, 'no checks reported'],
        ['a missing check list', approve, { ...defaultPr, statusCheckRollup: undefined }, 'no checks reported'],
        ['a PR that is not clean', approve, { ...defaultPr, mergeStateStatus: 'BLOCKED' }, 'not mergeable/clean (MERGEABLE/BLOCKED)'],
        ['a conflicting PR', approve, { ...defaultPr, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }, 'not mergeable/clean (CONFLICTING/DIRTY)'],
        ['APPROVE without any PR', approve, null, 'no single open PR of PBI #11'],
      ])('does not merge: %s', (_name, out, pr, note) => {
        ghFake(pr ? [pr] : []);
        fakeQueue([pbiRun(11, { pr: pr ? 101 : undefined, out }), doneStep]);
        const r = run(['-Feature', '10', '-MergeApproved'], true);
        expect(r.status).toBe(0);
        expect(ghCalls()).not.toContain('pr merge');
        expect(outcomes()).toEqual([[11, 'done']]);
        expect(queue().state).toBe('done');
        expect(queue().pbis[0].note).toContain(note);
      });

      describe('UNKNOWN mergeability right after PR creation', () => {
        const unknown = () => ({ ...defaultPr, mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN', statusCheckRollup: [] });
        it('polls gh pr view and merges once GitHub has computed MERGEABLE/CLEAN', () => {
          ghFake([unknown()], { view: { mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ conclusion: 'SUCCESS' }] } });
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(lines()).toContain('pr view 101 --json mergeable,mergeStateStatus,statusCheckRollup');
          expect(lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
        });
        it('skips the merge after three polls that stay UNKNOWN', () => {
          ghFake([unknown()], { view: { mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN', statusCheckRollup: [] } });
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(0);
          expect(lines().filter((l) => l.startsWith('pr view'))).toHaveLength(3);
          expect(ghCalls()).not.toContain('pr merge');
          expect(queue().pbis[0].note).toContain('mergeability still UNKNOWN after 3 polls');
        });
      });

      it('does not merge when the child exited non-zero even with a complete ledger and APPROVE', () => {
        ghFake();
        fakeQueue([pbiRun(11, { pr: 101, out: `${approve}; exit 1` }), doneStep]);
        const r = run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
        expect(outcomes()).toEqual([[11, 'done']]);
        expect(queue().pbis[0].note).toContain('child exit code 1');
        expect(r.status).toBe(0); // ledger wins for the outcome, only the merge is withheld
      });

      it('does not merge when two open PRs match the PBI branch and the ledger names none', () => {
        ghFake([defaultPr, { ...defaultPr, number: 102, headRefName: 'fix/11-again' }]);
        fakeQueue([pbiRun(11, { out: approve }), doneStep]);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
        expect(queue().pbis[0].note).toContain('PBI #11');
      });

      it('does not let PBI 1 match a feat/11-x branch', () => {
        ghFake();
        fakeQueue([pbiRun(1, { out: approve }), 'echo "Feature #10 is done."']);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
      });

      it('does not merge when gh pr list returns something that is not JSON', () => {
        ghFake();
        fs.writeFileSync(path.join(dir, 'gh-list.json'), 'not json at all');
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
        expect(outcomes()).toEqual([[11, 'done']]);
      });

      describe('head verification', () => {
        const merged = () => ghCalls().includes('pr merge');
        const other = 'ffffffffffffffffffffffffffffffffffffffff';
        it('merges when the local branch tip equals the PR head', () => {
          git('branch', 'feat/11-x');
          ghFake([{ ...defaultPr, headRefOid: oid }]);
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(ghCalls()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
        });
        it('skips the merge when the local branch tip differs from the PR head', () => {
          git('branch', 'feat/11-x');
          ghFake([{ ...defaultPr, headRefOid: other }]);
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(merged()).toBe(false);
          expect(queue().pbis[0].note).toContain(`differs from local branch tip ${oid}`);
        });
        it('without a local branch, skips when the origin branch tip differs from the PR head', () => {
          ghFake([{ ...defaultPr, headRefOid: other }]);
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(merged()).toBe(false);
          expect(queue().pbis[0].note).toContain(`differs from origin branch tip ${oid}`);
        });
        it('without a local branch and without a reachable origin, skips because the head cannot be verified', () => {
          git('remote', 'remove', 'origin');
          ghFake();
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(merged()).toBe(false);
          expect(queue().pbis[0].note).toContain('cannot be verified');
        });
      });

      it('does not merge when the ledger PR is not among the open PRs of the PBI', () => {
        ghFake([{ ...defaultPr, number: 555 }]);
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
      });

      it('does not merge when gh pr list fails', () => {
        ghFake([defaultPr], { listFails: true });
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(0);
        expect(ghCalls()).not.toContain('pr merge');
        expect(queue().pbis[0].note).toContain('gh pr list failed');
      });

      it('does not merge on a gate', () => {
        ghFake();
        fakeQueue([`mkdir -p .agents/11; echo "Next PBI: #11 T"; ${approve}; echo "Gate: ok?" >> .agents/11/progress.md`]);
        expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(2);
        expect(ghCalls()).not.toContain('pr merge');
      });

      it('does not merge a failed iteration that printed APPROVE', () => {
        ghFake();
        fakeQueue([`echo "Next PBI: #11 T"; ${approve}; exit 1`]);
        expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(1);
        expect(ghCalls()).not.toContain('pr merge');
      });

      it('records failed and exits 1 when gh pr merge fails', () => {
        ghFake([defaultPr], { mergeExit: 1 });
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        const r = run(['-Feature', '10', '-MergeApproved'], true);
        expect(r.status).toBe(1);
        expect(ghCalls()).toContain('pr merge 101');
        expect(outcomes()).toEqual([[11, 'failed']]);
        expect(queue().pbis[0].note).toContain('merge');
        expect(queue().state).toBe('failed');
        expect(calls()).toHaveLength(1);
      });
    });
  });
});
