import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createFakeGh } from '../../helpers/fake-gh';
import { PwshWorker } from '../../helpers/pwsh-worker';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-issue/scripts/Get-ParkedRuling.ps1'
);

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

it('pwsh is installed in CI (the Get-ParkedRuling cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

const MARKER = '<!-- apm-hub:parked-gate -->';
const PARKED = `${MARKER}\n**Parked: PBI #581 waits for a decision.**\n\n> Which store?`;
const URL = 'https://github.com/o/r/issues/581#issuecomment-9';

type Comment = { body: string; login: string; url?: string };
type Scenario = {
  comments?: Comment[];
  commentsFail?: boolean;
  /** raw stdout of the comments call (one JSON array per page, or malformed text) */
  commentsRaw?: string;
  permissions?: Record<string, string>;
  editFail?: boolean;
};

// The fake gh reads the scenario of the current case from scenario.json: comments (as the --jq projection would return them),
// permission per login (missing login = 404, exit 1), and whether `gh issue edit` fails.
const HANDLER = `(call) => {
  const s = JSON.parse(require('fs').readFileSync(dir + '/scenario.json', 'utf8'));
  const [a0, a1] = call.args;
  if (a0 === 'api' && call.args.includes('--paginate')) {
    if (s.commentsFail) throw new Error('HTTP 500');
    if (s.commentsRaw !== undefined) { require('fs').writeSync(1, s.commentsRaw); process.exit(0); }
    return { rest: s.comments || [] };
  }
  if (a0 === 'api') {
    const m = /collaborators\\/(.+)\\/permission$/.exec(a1);
    const p = m && (s.permissions || {})[m[1]];
    if (!p) throw new Error('HTTP 404: Not Found');
    return { rest: p };
  }
  if (a0 === 'issue' && a1 === 'edit') {
    if (s.editFail) throw new Error('edit failed');
    return { rest: '' };
  }
  throw new Error('unexpected: ' + call.args.join(' '));
}`;

type Result = {
  issue: number;
  state: string;
  question: string | null;
  answer: string | null;
  author: string | null;
  url: string | null;
};

describe.skipIf(!hasPwsh)('Get-ParkedRuling.ps1', () => {
  let worker: PwshWorker;
  let tmp: string;
  let gh: ReturnType<typeof createFakeGh>;
  let state: string;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parked-ruling-'));
    gh = createFakeGh(tmp, HANDLER);
    state = path.join(tmp, 'state');
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const ledgerFile = () => path.join(state, '581', 'progress.md');
  const ledger = (...lines: string[]) => {
    fs.mkdirSync(path.dirname(ledgerFile()), { recursive: true });
    fs.writeFileSync(ledgerFile(), lines.map((l) => `${l}\n`).join(''));
  };
  const scenario = (s: Scenario) =>
    fs.writeFileSync(path.join(tmp, 'scenario.json'), JSON.stringify(s));
  const run = async (args: string[] = []) => {
    const r = await worker.run(['-Issue', '581', ...args], {
      cwd: tmp,
      env: gh.env({ ...process.env, DROMOS_STATE_DIR: state }),
    });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout.trim()) as Result;
  };
  const ruling = (body: string, login = 'alice'): Comment[] => [
    { body: 'first', login: 'bob', url: 'u1' },
    { body: PARKED, login: 'apm-bot', url: 'u2' },
    { body, login, url: URL },
  ];
  const permCalls = () => gh.calls().filter((c) => /permission$/.test(c.args[1] ?? ''));

  describe('answered', () => {
    it.each(['write', 'admin', 'maintain'])('by a collaborator with %s permission', async (p) => {
      ledger('# orchestrator ledger — issue #581', '2026-10-26T10:00:00Z Gate: Which store?');
      scenario({ comments: ruling('/ruling sqlite'), permissions: { alice: p } });
      expect(await run()).toEqual({
        issue: 581,
        state: 'answered',
        question: 'Which store?',
        answer: 'sqlite',
        author: 'alice',
        url: URL,
      });
      expect(fs.readFileSync(ledgerFile(), 'utf8')).not.toContain('Ruling:');
      expect(gh.calls().some((c) => c.args[0] === 'issue')).toBe(false);
    });

    it('passes an answer outside the options verbatim', async () => {
      ledger('Gate: Which store?');
      scenario({
        comments: ruling('/ruling neither, use postgres instead'),
        permissions: { alice: 'write' },
      });
      expect(await run()).toMatchObject({
        state: 'answered',
        answer: 'neither, use postgres instead',
      });
    });

    it('keeps control characters, @mentions, $(...) and newlines as one literal line', async () => {
      ledger('Gate: Which store?');
      scenario({
        comments: ruling('/ruling a\u0007b\u001b[31m @octocat $(rm -rf /)\nsecond\u200Bline\r\n'),
        permissions: { alice: 'write' },
      });
      const r = await run();
      expect(r.state).toBe('answered');
      expect(r.answer).toBe('a b [31m @octocat $(rm -rf /) second line');
    });

    it('accepts a [bot] login with push access', async () => {
      ledger('Gate: Which store?');
      scenario({
        comments: ruling('/ruling sqlite', 'renovate[bot]'),
        permissions: { 'renovate[bot]': 'write' },
      });
      expect(await run()).toMatchObject({ state: 'answered', author: 'renovate[bot]' });
      expect(permCalls().map((c) => c.args[1])).toEqual([
        'repos/{owner}/{repo}/collaborators/renovate[bot]/permission',
      ]);
    });

    it('reads every page and takes the newest comment after the last parked comment', async () => {
      ledger('Gate: Which store?');
      const page1 = [
        { body: PARKED, login: 'apm-bot', url: 'u1' },
        { body: '/ruling old', login: 'alice', url: 'u2' },
      ];
      const page2 = [
        { body: PARKED, login: 'apm-bot', url: 'u3' },
        { body: '/ruling new', login: 'alice', url: URL },
      ];
      scenario({
        commentsRaw: `${JSON.stringify(page1)}\n${JSON.stringify(page2)}\n`,
        permissions: { alice: 'write' },
      });
      expect(await run()).toMatchObject({ state: 'answered', answer: 'new', url: URL });
    });

    it('caps the answer at 500 characters', async () => {
      ledger('Gate: Which store?');
      scenario({ comments: ruling(`/ruling ${'x'.repeat(600)}`), permissions: { alice: 'write' } });
      expect((await run()).answer).toBe('x'.repeat(500));
    });

    it('takes the question of the last open gate after an answered one', async () => {
      ledger('Gate: Old?', 'Ruling: Old? - user - yes', 'Phase plan', 'Gate: New?');
      scenario({ comments: ruling('/ruling ok'), permissions: { alice: 'write' } });
      expect(await run()).toMatchObject({ state: 'answered', question: 'New?' });
    });
  });

  describe('ignored', () => {
    it('a non-collaborator (404) is ignored', async () => {
      ledger('Gate: Which store?');
      scenario({ comments: ruling('/ruling sqlite', 'mallory'), permissions: {} });
      expect(await run(['-Apply'])).toMatchObject({
        state: 'ignored',
        author: 'mallory',
        answer: 'sqlite',
      });
      expect(fs.readFileSync(ledgerFile(), 'utf8')).not.toContain('Ruling:');
      expect(gh.calls().some((c) => c.args[0] === 'issue')).toBe(false);
    });

    it.each(['read', 'triage', 'none'])('%s permission is ignored', async (p) => {
      ledger('Gate: Which store?');
      scenario({ comments: ruling('/ruling sqlite'), permissions: { alice: p } });
      expect((await run()).state).toBe('ignored');
    });

    it('an invalid login is rejected without a permission call', async () => {
      ledger('Gate: Which store?');
      scenario({
        comments: ruling('/ruling sqlite', 'alice/../../x'),
        permissions: { 'alice/../../x': 'admin' },
      });
      expect((await run()).state).toBe('ignored');
      expect(permCalls()).toEqual([]);
    });
  });

  describe('waiting', () => {
    it('no parked comment', async () => {
      ledger('Gate: Which store?');
      scenario({
        comments: [{ body: '/ruling sqlite', login: 'alice', url: URL }],
        permissions: { alice: 'write' },
      });
      expect((await run()).state).toBe('waiting');
      expect(permCalls()).toEqual([]);
    });

    it('a ruling before a newer parked comment does not count', async () => {
      ledger('Gate: Which store?');
      const page1 = [
        { body: PARKED, login: 'apm-bot', url: 'u1' },
        { body: '/ruling old', login: 'alice', url: 'u2' },
      ];
      scenario({
        commentsRaw: `${JSON.stringify(page1)}\n${JSON.stringify([{ body: PARKED, login: 'apm-bot', url: 'u3' }])}\n`,
        permissions: { alice: 'write' },
      });
      expect((await run()).state).toBe('waiting');
      expect(permCalls()).toEqual([]);
    });

    it('no comment after the parked comment', async () => {
      ledger('Gate: Which store?');
      scenario({
        comments: [
          { body: '/ruling sqlite', login: 'alice', url: 'u0' },
          { body: PARKED, login: 'apm-bot', url: 'u2' },
        ],
        permissions: { alice: 'write' },
      });
      expect((await run()).state).toBe('waiting');
    });

    it('the newest comment after the parked one is not a /ruling', async () => {
      ledger('Gate: Which store?');
      scenario({
        comments: [...ruling('/ruling sqlite'), { body: 'thanks', login: 'alice', url: 'u4' }],
        permissions: { alice: 'write' },
      });
      expect((await run()).state).toBe('waiting');
    });

    it.each([' /ruling sqlite', '/Ruling sqlite', '/rulings sqlite', '/ruling   ', 'x /ruling a'])(
      '%j is not a ruling',
      async (body) => {
        ledger('Gate: Which store?');
        scenario({ comments: ruling(body), permissions: { alice: 'write' } });
        expect((await run()).state).toBe('waiting');
      }
    );

    it('a failing comments call is reported', async () => {
      ledger('Gate: Which store?');
      scenario({ commentsFail: true });
      expect((await run()).state).toBe('failed:comments');
    });

    it('malformed comments output is failed:comments without a permission call', async () => {
      ledger('Gate: Which store?');
      scenario({
        commentsRaw: '[{"body": "/ruling x", "login": "alice"\n',
        permissions: { alice: 'write' },
      });
      expect(await run(['-Apply'])).toMatchObject({ state: 'failed:comments', answer: null });
      expect(permCalls()).toEqual([]);
      expect(gh.calls().some((c) => c.args[0] === 'issue')).toBe(false);
    });
  });

  describe('no-gate', () => {
    it('the gate already has a ruling', async () => {
      ledger('Gate: Which store?', '2026-10-26T10:00:00Z Ruling: Which store? - user - sqlite');
      scenario({ comments: ruling('/ruling files'), permissions: { alice: 'write' } });
      expect(await run(['-Apply'])).toMatchObject({ state: 'no-gate', question: null });
      expect(gh.calls()).toEqual([]);
    });

    it('a missing ledger', async () => {
      scenario({ comments: ruling('/ruling files'), permissions: { alice: 'write' } });
      expect((await run()).state).toBe('no-gate');
      expect(gh.calls()).toEqual([]);
    });

    it('a ledger without a gate', async () => {
      ledger('# orchestrator ledger — issue #581', 'Phase plan');
      scenario({});
      expect((await run()).state).toBe('no-gate');
    });
  });

  describe('-Apply', () => {
    it('writes the exact Ruling line, then removes needs-decision', async () => {
      ledger('Gate: Which store?');
      scenario({ comments: ruling('/ruling sqlite $(x)'), permissions: { alice: 'write' } });
      expect(await run(['-Apply'])).toMatchObject({ state: 'applied', answer: 'sqlite $(x)' });
      const last = fs.readFileSync(ledgerFile(), 'utf8').trim().split('\n').pop()!;
      expect(last).toMatch(
        new RegExp(
          `^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ Ruling: Which store\\? - user \\(comment ${URL.replace(/[.?]/g, '\\$&')}\\) - sqlite \\$\\(x\\)$`
        )
      );
      const calls = gh.calls().map((c) => c.args.join(' '));
      expect(calls[calls.length - 1]).toBe('issue edit 581 --remove-label needs-decision');
      expect(await run()).toMatchObject({ state: 'no-gate' });
    });

    it('a failing ledger write is failed:ledger and leaves the label', async () => {
      // Add-LedgerLine.ps1 refuses a symlinked progress.md; the gate is still read through the link
      const real = path.join(tmp, 'real-progress.md');
      fs.writeFileSync(real, 'Gate: Which store?\n');
      fs.mkdirSync(path.dirname(ledgerFile()), { recursive: true });
      fs.symlinkSync(real, ledgerFile());
      scenario({ comments: ruling('/ruling sqlite'), permissions: { alice: 'write' } });
      expect((await run(['-Apply'])).state).toBe('failed:ledger');
      expect(fs.readFileSync(real, 'utf8')).not.toContain('Ruling:');
      expect(gh.calls().some((c) => c.args[0] === 'issue')).toBe(false);
    });

    it('a failing label removal is failed:label with the ruling written', async () => {
      ledger('Gate: Which store?');
      scenario({
        comments: ruling('/ruling sqlite'),
        permissions: { alice: 'write' },
        editFail: true,
      });
      expect((await run(['-Apply'])).state).toBe('failed:label');
      expect(fs.readFileSync(ledgerFile(), 'utf8')).toContain(
        `Ruling: Which store? - user (comment ${URL}) - sqlite`
      );
    });
  });

  it('rejects an invalid issue', async () => {
    const r = await worker.run(['-Issue', '58;1'], {
      cwd: tmp,
      env: gh.env({ ...process.env, DROMOS_STATE_DIR: state }),
    });
    expect(r.status).not.toBe(0);
    expect(gh.calls()).toEqual([]);
  });
});
