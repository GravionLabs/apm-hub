import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createFakeGh } from '../../helpers/fake-gh';
import { PwshWorker } from '../../helpers/pwsh-worker';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-pull-request/scripts/Merge-ApprovedPr.ps1'
);

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
const posix = process.platform !== 'win32';

it('pwsh is installed in CI (the Merge-ApprovedPr cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

const MERGE_SHA = 'f'.repeat(40);
const PR_URL = 'https://github.com/o/r/pull/101';

type Scenario = {
  prs?: object[];
  listFails?: boolean;
  /** raw stdout of gh pr list (e.g. not JSON) */
  listRaw?: string;
  /** mergeCommit answer of gh pr view after the merge (default: { oid: MERGE_SHA }) */
  mergeCommit?: object | null;
  editFails?: boolean;
  commentFails?: boolean;
  view?: object;
  mergeFails?: boolean;
  comments?: { body: string }[];
  labels?: { name: string }[];
};

// The fake gh answers from scenario.json; `gh issue comment --body-file` copies the body to comments.txt (the script deletes the file).
const HANDLER = `(call) => {
  const fs = require('fs');
  const s = JSON.parse(fs.readFileSync(dir + '/scenario.json', 'utf8'));
  const [a0, a1] = call.args;
  const json = call.args[call.args.indexOf('--json') + 1];
  if (a0 === 'pr' && a1 === 'list') {
    if (s.listFails) throw new Error('boom');
    if (s.listRaw !== undefined) { fs.writeSync(1, s.listRaw); process.exit(0); }
    return { rest: s.prs || [] };
  }
  if (a0 === 'pr' && a1 === 'view' && json === 'mergeCommit')
    return { rest: { mergeCommit: s.mergeCommit === undefined ? { oid: '${MERGE_SHA}' } : s.mergeCommit } };
  if (a0 === 'pr' && a1 === 'view') return { rest: s.view || {} };
  if (a0 === 'pr' && a1 === 'merge') { if (s.mergeFails) throw new Error('merge failed'); return { rest: '' }; }
  if (a0 === 'issue' && a1 === 'view' && json === 'comments') return { rest: { comments: s.comments || [] } };
  if (a0 === 'issue' && a1 === 'view' && json === 'labels') return { rest: { labels: s.labels || [] } };
  if (a0 === 'issue' && a1 === 'edit') { if (s.editFails) throw new Error('edit failed'); return { rest: '' }; }
  if (a0 === 'issue' && a1 === 'comment') {
    if (s.commentFails) throw new Error('comment failed');
    fs.appendFileSync(dir + '/comments.txt', fs.readFileSync(call.args[call.args.indexOf('--body-file') + 1], 'utf8') + '\\n');
    return { rest: '' };
  }
  throw new Error('unexpected: ' + call.args.join(' '));
}`;

describe.skipIf(!hasPwsh || !posix)('Merge-ApprovedPr.ps1', () => {
  let worker: PwshWorker;
  let root: string;
  let work: string;
  let oid: string;
  let originOid: string;
  let tmp: string;
  let gh: ReturnType<typeof createFakeGh>;

  const git = (cwd: string, ...a: string[]) =>
    execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
    // origin has feat/582-remote (not checked out locally); the work repo has feat/582-x at oid
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-approved-'));
    const origin = path.join(root, 'origin');
    work = path.join(root, 'work');
    for (const d of [origin, work]) {
      fs.mkdirSync(d);
      git(d, 'init', '-q', '-b', 'main');
      git(d, 'config', 'user.email', 't@example.com');
      git(d, 'config', 'user.name', 't');
      git(d, 'config', 'commit.gpgsign', 'false');
      git(d, 'commit', '-q', '--allow-empty', '-m', `init ${path.basename(d)}`);
    }
    git(origin, 'branch', 'feat/582-remote');
    originOid = git(origin, 'rev-parse', 'HEAD');
    git(work, 'branch', 'feat/582-x');
    oid = git(work, 'rev-parse', 'HEAD');
    git(work, 'remote', 'add', 'origin', origin);
  });
  afterAll(() => {
    worker.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-approved-case-'));
    gh = createFakeGh(tmp, HANDLER);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const pbiDir = () => path.join(tmp, 'state', '582');
  const ledgerFile = () => path.join(pbiDir(), 'progress.md');
  const setup = (
    s: Scenario,
    review: object | string | null = { verdict: 'APPROVE', incomplete: false },
    ledgerLines: string[] = ledgerFor(oid)
  ) => {
    fs.mkdirSync(pbiDir(), { recursive: true });
    fs.writeFileSync(ledgerFile(), ledgerLines.map((l) => `${l}\n`).join(''));
    if (review !== null)
      fs.writeFileSync(
        path.join(pbiDir(), 'review.json'),
        typeof review === 'string' ? review : JSON.stringify(review)
      );
    fs.writeFileSync(path.join(tmp, 'scenario.json'), JSON.stringify(s));
  };
  // real ledger lines carry an ISO-8601 prefix; the reviewed commit is recorded short
  const ledgerFor = (reviewed: string, url = PR_URL) => [
    `2026-10-27T04:00:00Z Phase review: complete — ${reviewed.slice(0, 8)} — package ~3k tokens`,
    `2026-10-27T04:10:00Z Phase pull-request: complete — ${url}`,
  ];
  const pr = (o: object = {}) => ({
    number: 101,
    url: PR_URL,
    state: 'OPEN',
    headRefName: 'feat/582-x',
    baseRefName: 'release/next',
    headRefOid: oid,
    isCrossRepository: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    statusCheckRollup: [{ conclusion: 'SUCCESS' }, { state: 'SUCCESS' }],
    ...o,
  });
  const run = (extra: string[] = [], env: NodeJS.ProcessEnv = {}) =>
    worker.run(['-Issue', '582', '-Ledger', ledgerFile(), ...extra], {
      cwd: work,
      env: gh.env({ ...process.env, QUEUE_POLL_SECONDS: '0', ...env }),
    });
  const lines = () => gh.calls().map((c) => c.args.join(' '));
  const merges = () => lines().filter((l) => l.startsWith('pr merge'));
  const mutating = () => lines().filter((l) => /^(pr merge|issue edit|issue comment)\b/.test(l));
  const comments = () =>
    fs.existsSync(path.join(tmp, 'comments.txt'))
      ? fs.readFileSync(path.join(tmp, 'comments.txt'), 'utf8').trim().split('\n')
      : [];

  describe('merged', () => {
    it('squash-merges pinned to the head commit and prints the merge commit', async () => {
      setup({ prs: [pr()] });
      const r = await run();
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe(`merged ${MERGE_SHA}`);
      expect(merges()).toEqual([`pr merge 101 --squash --match-head-commit ${oid}`]);
      expect(comments()).toEqual([]);
    });

    it('picks the ledger PR when two open PRs match the PBI branch', async () => {
      setup({ prs: [pr({ number: 102, headRefName: 'fix/582-again' }), pr()] });
      const r = await run();
      expect(r.stdout.trim()).toBe(`merged ${MERGE_SHA}`);
      expect(merges()).toEqual([`pr merge 101 --squash --match-head-commit ${oid}`]);
    });

    it('accepts ledger lines without the timestamp prefix', async () => {
      setup(
        { prs: [pr()] },
        undefined,
        ledgerFor(oid).map((l) => l.replace(/^\S+ /, ''))
      );
      const r = await run();
      expect(r.stdout.trim()).toBe(`merged ${MERGE_SHA}`);
    });

    it('verifies the head against origin when there is no local branch', async () => {
      setup(
        { prs: [pr({ headRefName: 'feat/582-remote', headRefOid: originOid })] },
        undefined,
        ledgerFor(originOid)
      );
      const r = await run();
      expect(r.stdout.trim()).toBe(`merged ${MERGE_SHA}`);
      expect(merges()).toEqual([`pr merge 101 --squash --match-head-commit ${originOid}`]);
    });

    it('removes needs-review when the label is set', async () => {
      setup({ prs: [pr()], labels: [{ name: 'bug' }, { name: 'needs-review' }] });
      await run();
      expect(lines()).toContain('issue edit 582 --remove-label needs-review');
    });

    it('leaves the labels alone when needs-review is not set', async () => {
      setup({ prs: [pr()], labels: [{ name: 'bug' }] });
      await run();
      expect(lines().filter((l) => l.startsWith('issue edit'))).toEqual([]);
    });

    it('polls UNKNOWN mergeability and merges once GitHub reports MERGEABLE/CLEAN', async () => {
      setup({
        prs: [pr({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN', statusCheckRollup: [] })],
        view: {
          mergeable: 'MERGEABLE',
          mergeStateStatus: 'CLEAN',
          statusCheckRollup: [{ conclusion: 'SUCCESS' }],
        },
      });
      const r = await run();
      expect(lines()).toContain('pr view 101 --json mergeable,mergeStateStatus,statusCheckRollup');
      expect(r.stdout.trim()).toBe(`merged ${MERGE_SHA}`);
    });

    it.each([
      ['no merge commit', null],
      ['a merge commit without a valid oid', { oid: 'not-a-sha' }],
    ])('prints the head commit when GitHub reports %s yet', async (_n, mergeCommit) => {
      setup({ prs: [pr()], mergeCommit });
      const r = await run();
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe(`merged ${oid}`);
    });

    it('reports a failed label removal on stderr and still exits 0', async () => {
      setup({ prs: [pr()], labels: [{ name: 'needs-review' }], editFails: true });
      const r = await run();
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe(`merged ${MERGE_SHA}`);
      expect(r.stderr).toContain('could not remove label needs-review from #582');
    });
  });

  describe('skipped', () => {
    const rows: [string, () => Scenario, object | string | null | undefined, string][] = [
      ['no review.json', () => ({ prs: [pr()] }), null, 'no review.json'],
      ['an unreadable review.json', () => ({ prs: [pr()] }), '{not json', 'no review.json'],
      [
        'CHANGES_REQUESTED',
        () => ({ prs: [pr()] }),
        { verdict: 'CHANGES_REQUESTED', incomplete: false },
        'verdict is not a plain APPROVE (CHANGES_REQUESTED)',
      ],
      [
        'a lower-case verdict',
        () => ({ prs: [pr()] }),
        { verdict: 'approve', incomplete: false },
        'verdict is not a plain APPROVE (approve)',
      ],
      [
        'APPROVE with incomplete: true',
        () => ({ prs: [pr()] }),
        { verdict: 'APPROVE', incomplete: true },
        'review is incomplete',
      ],
      [
        'APPROVE without an incomplete field',
        () => ({ prs: [pr()] }),
        { verdict: 'APPROVE' },
        'review is incomplete',
      ],
      ['gh pr list failing', () => ({ listFails: true }), undefined, 'gh pr list failed'],
      [
        'gh pr list printing no JSON',
        () => ({ listRaw: 'oops <html>' }),
        undefined,
        'gh pr list returned no JSON',
      ],
      [
        'no PR at all',
        () => ({ prs: [] }),
        undefined,
        'no single open PR of PBI #582 found (ledger PR: #101)',
      ],
      [
        'a ledger PR that is not among the open PRs',
        () => ({ prs: [pr({ number: 102 })] }),
        undefined,
        'no single open PR of PBI #582 found (ledger PR: #101)',
      ],
      [
        'a PR of another PBI branch',
        () => ({ prs: [pr({ headRefName: 'feat/99-other' })] }),
        undefined,
        'no single open PR of PBI #582 found',
      ],
      [
        'a PR that is not open',
        () => ({ prs: [pr({ state: 'MERGED' })] }),
        undefined,
        'PR #101: state MERGED',
      ],
      [
        'a release head',
        () => ({ prs: [pr({ headRefName: 'release/582-x' })] }),
        undefined,
        'PR #101: release PR',
      ],
      [
        'a base that is not release/*',
        () => ({ prs: [pr({ baseRefName: 'main' })] }),
        undefined,
        'PR #101: base main is not the integration branch (release/*)',
      ],
      [
        'a cross-repository PR',
        () => ({ prs: [pr({ isCrossRepository: true })] }),
        undefined,
        'PR #101: fork or cross-repository PR',
      ],
      [
        'unknown cross-repository status',
        () => ({ prs: [pr({ isCrossRepository: undefined })] }),
        undefined,
        'PR #101: fork or cross-repository PR',
      ],
      [
        'a missing head commit',
        () => ({ prs: [pr({ headRefOid: undefined })] }),
        undefined,
        'PR #101: head commit unknown',
      ],
      [
        'a conflicting PR',
        () => ({ prs: [pr({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })] }),
        undefined,
        'PR #101: not mergeable/clean (CONFLICTING/DIRTY)',
      ],
      [
        'an empty check list',
        () => ({ prs: [pr({ statusCheckRollup: [] })] }),
        undefined,
        'PR #101: no checks reported',
      ],
      [
        'pending checks',
        () => ({
          prs: [pr({ statusCheckRollup: [{ conclusion: 'SUCCESS' }, { state: 'PENDING' }] })],
        }),
        undefined,
        'PR #101: checks are not green',
      ],
      [
        'a head pushed after the review',
        () => ({ prs: [pr({ headRefOid: 'a'.repeat(40) })] }),
        undefined,
        `PR #101: head ${'a'.repeat(40)} is not the reviewed commit`,
      ],
    ];
    it.each(rows)('%s', async (_name, s, review, reason) => {
      setup(s(), review);
      const r = await run();
      expect(r.status).toBe(0);
      expect(r.stdout.trim().split('\n')).toHaveLength(1);
      expect(r.stdout.trim()).toMatch(/^skipped: /);
      expect(r.stdout.trim()).toContain(`skipped: ${reason}`);
      expect(merges()).toEqual([]);
    });

    it('never picks a PR by its branch name when the ledger names no PR', async () => {
      setup({ prs: [pr()] }, undefined, [ledgerFor(oid)[0]]);
      const r = await run();
      expect(r.stdout.trim()).toBe('skipped: no PR in the ledger (Phase pull-request: complete)');
      expect(merges()).toEqual([]);
    });

    it('does not merge without a reviewed commit in the ledger', async () => {
      setup({ prs: [pr()] }, undefined, [ledgerFor(oid)[1]]);
      const r = await run();
      expect(r.stdout.trim()).toBe(
        'skipped: no reviewed commit in the ledger (Phase review: complete)'
      );
      expect(lines().filter((l) => l.startsWith('pr '))).toEqual([]);
    });

    it('does not let PBI 58 match the branch of PBI 582', async () => {
      setup({ prs: [pr()] });
      const r = await worker.run(['-Issue', '58', '-Ledger', ledgerFile()], {
        cwd: work,
        env: gh.env({ ...process.env, QUEUE_POLL_SECONDS: '0' }),
      });
      expect(r.stdout.trim()).toBe('skipped: no single open PR of PBI #58 found (ledger PR: #101)');
      expect(merges()).toEqual([]);
    });

    it('stops polling UNKNOWN mergeability after three polls', async () => {
      setup({ prs: [pr({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' })], view: {} });
      const r = await run();
      expect(lines().filter((l) => l.startsWith('pr view'))).toHaveLength(3);
      expect(r.stdout.trim()).toBe('skipped: PR #101: mergeability still UNKNOWN after 3 polls');
      expect(merges()).toEqual([]);
    });

    it('does not merge a head that differs from the local branch tip', async () => {
      const other = 'b'.repeat(40);
      setup({ prs: [pr({ headRefOid: other })] }, undefined, ledgerFor(other));
      const r = await run();
      expect(r.stdout.trim()).toBe(
        `skipped: PR #101: head ${other} differs from local branch tip ${oid}`
      );
      expect(merges()).toEqual([]);
    });

    it('does not merge a head that differs from the origin branch tip', async () => {
      setup({ prs: [pr({ headRefName: 'feat/582-remote' })] });
      const r = await run();
      expect(r.stdout.trim()).toBe(
        `skipped: PR #101: head ${oid} differs from origin branch tip ${originOid}`
      );
      expect(merges()).toEqual([]);
    });

    it('reports failed label and comment calls on stderr and still exits 0', async () => {
      setup({ prs: [pr({ state: 'CLOSED' })], editFails: true, commentFails: true });
      const r = await run();
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('skipped: PR #101: state CLOSED');
      expect(r.stderr).toContain('could not add label needs-review to #582');
      expect(r.stderr).toContain('could not comment on #582');
    });

    it('reports an unverifiable head', async () => {
      setup({ prs: [pr({ headRefName: 'feat/582-gone' })] });
      const r = await run();
      expect(r.stdout.trim()).toBe(
        `skipped: PR #101: head ${oid} cannot be verified (no local branch, not found on origin)`
      );
    });

    it('labels needs-review and comments the reason with the PR URL', async () => {
      setup({ prs: [pr({ state: 'CLOSED' })] });
      await run();
      expect(lines()).toContain('issue edit 582 --add-label needs-review');
      expect(comments()).toEqual([`Merge skipped: PR #101: state CLOSED — ${PR_URL}`]);
    });

    it('does not repeat a comment identical to the newest one', async () => {
      setup({
        prs: [pr({ state: 'CLOSED' })],
        comments: [{ body: 'x' }, { body: `Merge skipped: PR #101: state CLOSED — ${PR_URL}` }],
      });
      await run();
      expect(lines()).toContain('issue edit 582 --add-label needs-review');
      expect(comments()).toEqual([]);
    });

    it('comments again when the newest comment carries another reason', async () => {
      setup({
        prs: [pr({ state: 'CLOSED' })],
        comments: [{ body: `Merge skipped: PR #101: state CLOSED — ${PR_URL}` }, { body: 'later' }],
      });
      await run();
      expect(comments()).toHaveLength(1);
    });

    it('neutralizes @ mentions and control characters from GitHub data in the comment', async () => {
      setup({ prs: [pr({ baseRefName: 'dev@owner\u0007x' })] });
      const r = await run();
      expect(r.stdout).not.toContain('\u0007');
      expect(comments()[0]).toContain('dev@​owner x');
    });

    it('names "no PR" in the comment when neither the ledger nor gh knows a URL', async () => {
      setup({ prs: [pr()] }, undefined, [ledgerFor(oid)[0]]);
      await run();
      expect(comments()).toEqual([
        'Merge skipped: no PR in the ledger (Phase pull-request: complete) — no PR',
      ]);
    });
  });

  describe('-NoMerge', () => {
    it('never merges, labels needs-review and comments with the ledger PR URL', async () => {
      setup({ prs: [pr()] });
      const r = await run(['-NoMerge']);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('skipped: merge disabled (--no-merge)');
      expect(merges()).toEqual([]);
      expect(lines()).toContain('issue edit 582 --add-label needs-review');
      expect(comments()).toEqual([`Merge skipped: merge disabled (--no-merge) — ${PR_URL}`]);
    });
  });

  describe('-WhatIf', () => {
    it('prints the merge line without any mutating gh call', async () => {
      setup({ prs: [pr()], labels: [{ name: 'needs-review' }] });
      const r = await run(['-WhatIf']);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe(`merged ${oid}`);
      expect(mutating()).toEqual([]);
    });

    it('prints the skip line without label or comment', async () => {
      setup({ prs: [pr({ state: 'CLOSED' })] });
      const r = await run(['-WhatIf']);
      expect(r.stdout.trim()).toBe('skipped: PR #101: state CLOSED');
      expect(mutating()).toEqual([]);
    });

    it('with -NoMerge prints the skip line only', async () => {
      setup({ prs: [pr()] });
      const r = await run(['-WhatIf', '-NoMerge']);
      expect(r.stdout.trim()).toBe('skipped: merge disabled (--no-merge)');
      expect(mutating()).toEqual([]);
    });
  });

  describe('errors', () => {
    it('exits 1 when gh pr merge fails and keeps needs-review', async () => {
      setup({ prs: [pr()], mergeFails: true, labels: [{ name: 'needs-review' }] });
      const r = await run();
      expect(r.status).toBe(1);
      expect(r.stdout.trim()).toBe('');
      expect(r.stderr).toContain('gh pr merge #101 failed');
      expect(lines()).not.toContain('issue edit 582 --remove-label needs-review');
    });

    it('exits 1 when gh is not on PATH', async () => {
      setup({ prs: [pr()] });
      const empty = path.join(tmp, 'empty');
      fs.mkdirSync(empty);
      const r = await worker.run(['-Issue', '582', '-Ledger', ledgerFile()], {
        cwd: work,
        env: { ...process.env, PATH: empty },
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("'gh' not found on PATH");
    });

    it('rejects a missing -Ledger', async () => {
      const r = await worker.run(['-Issue', '582'], { cwd: work, env: gh.env() });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Missing -Ledger');
      expect(gh.calls()).toEqual([]);
    });

    it('rejects an -Issue that is not a number', async () => {
      setup({ prs: [pr()] });
      const r = await worker.run(['-Issue', '58;2', '-Ledger', ledgerFile()], {
        cwd: work,
        env: gh.env(),
      });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("Invalid -Issue '58;2'");
      expect(gh.calls()).toEqual([]);
    });
  });
});
