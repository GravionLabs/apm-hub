import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PwshWorker } from '../../helpers/pwsh-worker';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-issue/scripts/Write-StatusTable.ps1'
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

// A gh that always fails: the Needs column then skips itself (one warning) and the legacy cases keep their exact output
// without calling the real GitHub.
const failingGhDir = fs.mkdtempSync(path.join(os.tmpdir(), 'statustable-gh-'));
if (process.platform !== 'win32') {
  fs.writeFileSync(path.join(failingGhDir, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
}
afterAll(() => fs.rmSync(failingGhDir, { recursive: true, force: true }));
const pathWith = (dirName: string) => `${dirName}${path.delimiter}${process.env.PATH ?? ''}`;

it('pwsh is installed in CI (the Write-StatusTable cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

describe.skipIf(!hasPwsh)('Write-StatusTable.ps1', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statustable-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const table = '#12 merged First\n#13 pr-open #40 Second\nNext PBI: #14 Third\n';
  const run = (args: string[], input?: string) =>
    spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], {
      cwd: dir,
      encoding: 'utf8',
      input,
      env: {
        ...process.env,
        PATH: pathWith(failingGhDir),
        DROMOS_STATE_DIR: path.join(dir, '.agents'),
      },
    });
  const target = (issue: string) => path.join(dir, '.agents', `status-${issue}.md`);
  const withFile = (content: string) => {
    const f = path.join(dir, 'in.md');
    fs.writeFileSync(f, content);
    return f;
  };

  it('writes the table from -Path and leaves no temp file', () => {
    const r = run(['-Issue', '248', '-Path', withFile(table)]);
    expect(r.status).toBe(0);
    expect(fs.readFileSync(target('248'), 'utf8')).toBe(table);
    expect(fs.readdirSync(path.join(dir, '.agents'))).toEqual(['status-248.md']);
  });

  it('writes the table from stdin', () => {
    expect(run(['-Issue', '7'], table).status).toBe(0);
    expect(fs.readFileSync(target('7'), 'utf8')).toBe(table);
  });

  it('overwrites an existing file instead of appending', () => {
    expect(run(['-Issue', '248', '-Path', withFile('old\n')]).status).toBe(0);
    expect(run(['-Issue', '248', '-Path', withFile('new\n')]).status).toBe(0);
    expect(fs.readFileSync(target('248'), 'utf8')).toBe(
      'new\nNeeds me: 0 planning, 0 decisions, 0 release review\n'
    );
    expect(fs.readdirSync(path.join(dir, '.agents'))).toEqual(['status-248.md']);
  });

  it.each(['0', '01', '../x', '-1', 'x', '5/..', '1;rm', '12345678901', '5\n'])(
    'rejects -Issue %j',
    (issue) => {
      const r = run(['-Issue', issue, '-Path', withFile(table)]);
      expect(r.status).not.toBe(0);
      expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
    }
  );

  it('fails without prompting when -Issue is missing', () => {
    const r = run(['-Path', withFile(table)]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Invalid -Issue');
  });

  it('fails on a missing -Path file and on empty stdin', () => {
    expect(run(['-Issue', '5', '-Path', path.join(dir, 'nope.md')]).status).not.toBe(0);
    expect(run(['-Issue', '5'], '').status).not.toBe(0);
    expect(fs.existsSync(target('5'))).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked .agents/', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
    try {
      fs.symlinkSync(outside, path.join(dir, '.agents'));
      const r = run(['-Issue', '5', '-Path', withFile(table)]);
      expect(r.status).not.toBe(0);
      expect(r.stderr + r.stdout).toMatch(/symlinked/);
      expect(fs.readdirSync(outside)).toEqual([]);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')(
    'refuses a symlinked target and leaves the link target untouched',
    () => {
      const secret = path.join(dir, 'secret.md');
      fs.writeFileSync(secret, 'secret\n');
      fs.mkdirSync(path.join(dir, '.agents'));
      fs.symlinkSync(secret, target('5'));
      const r = run(['-Issue', '5', '-Path', withFile(table)]);
      expect(r.status).not.toBe(0);
      expect(r.stderr + r.stdout).toMatch(/symlinked/);
      expect(fs.readFileSync(secret, 'utf8')).toBe('secret\n');
      expect(fs.readdirSync(path.join(dir, '.agents'))).toEqual(['status-5.md']);
    }
  );

  it.skipIf(process.platform === 'win32')('refuses a dangling symlinked .agents/', () => {
    const missing = path.join(os.tmpdir(), `missing-${process.pid}-${Date.now()}`);
    fs.symlinkSync(missing, path.join(dir, '.agents'));
    const r = run(['-Issue', '5', '-Path', withFile(table)]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(fs.existsSync(missing)).toBe(false);
  });

  it.skipIf(process.platform === 'win32')(
    'refuses a dangling symlinked target and does not create the link target',
    () => {
      const missing = path.join(dir, 'not-there.md');
      fs.mkdirSync(path.join(dir, '.agents'));
      fs.symlinkSync(missing, target('5'));
      const r = run(['-Issue', '5', '-Path', withFile(table)]);
      expect(r.status).not.toBe(0);
      expect(r.stderr + r.stdout).toMatch(/symlinked/);
      expect(fs.existsSync(missing)).toBe(false);
    }
  );

  it('strips escape sequences and control characters but keeps tabs and newlines', () => {
    const dirty =
      '#1 a\tb \x1b[31mred\x1b[0m\n#2 \x1b]0;pwn\x07x \x1b]8;;u\x1b\\y\x1bZ z\x01\x7f\x85\r\nNext PBI: #3\n';
    expect(run(['-Issue', '5', '-Path', withFile(dirty)]).status).toBe(0);
    expect(fs.readFileSync(target('5'), 'utf8')).toBe(
      '#1 a\tb red\n#2 x y z\nNext PBI: #3\nNeeds me: 0 planning, 0 decisions, 0 release review\n'
    );
  });

  it('keeps the following rows when one title has an unterminated OSC', () => {
    const dirty = '#1 \x1b]0;open title\n#2 second\n#3 third \x1b]0;t\x07end\n';
    expect(run(['-Issue', '6', '-Path', withFile(dirty)]).status).toBe(0);
    expect(fs.readFileSync(target('6'), 'utf8')).toBe(
      '#1 0;open title\n#2 second\n#3 third end\nNeeds me: 0 planning, 0 decisions, 0 release review\n'
    );
  });
});

describe.skipIf(!hasPwsh)('Write-StatusTable.ps1 state directory (#402)', () => {
  let root: string;
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'statustable-state-')));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = (cwd: string, env: Record<string, string | undefined>) => {
    fs.writeFileSync(path.join(cwd, 't'), '#1 merged A\n');
    const e = { ...process.env, PATH: pathWith(failingGhDir), ...env };
    for (const k of Object.keys(e)) if (k.startsWith('GIT_')) delete e[k];
    if (env.DROMOS_STATE_DIR === undefined) delete e.DROMOS_STATE_DIR;
    return spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Issue', '5', '-Path', 't'], {
      cwd,
      encoding: 'utf8',
      env: e,
    });
  };

  it('writes <git common dir>/agents/status-5.md from a linked worktree', () => {
    const main = path.join(root, 'main');
    fs.mkdirSync(main);
    const g = (cwd: string, ...a: string[]) =>
      spawnSync(
        'git',
        [
          '-C',
          cwd,
          '-c',
          'user.email=t@t',
          '-c',
          'user.name=t',
          '-c',
          'commit.gpgsign=false',
          ...a,
        ],
        { encoding: 'utf8' }
      );
    g(main, 'init', '-q');
    g(main, 'commit', '-q', '--allow-empty', '-m', 'init');
    const wt = path.join(root, 'wt');
    expect(g(main, 'worktree', 'add', '-q', '-b', 'feat/5-x', wt).status).toBe(0);
    expect(run(wt, {}).status).toBe(0);
    expect(fs.readFileSync(path.join(main, '.git', 'agents', 'status-5.md'), 'utf8')).toBe(
      '#1 merged A\n'
    );
  });

  it('honours DROMOS_STATE_DIR, also with a trailing slash', () => {
    const st = path.join(root, 'state');
    const r = run(root, { DROMOS_STATE_DIR: st + '/' });
    expect(r.status, r.stderr).toBe(0);
    expect(fs.readFileSync(path.join(st, 'status-5.md'), 'utf8')).toBe('#1 merged A\n');
  });

  it('exits 1 with a message outside a repository', () => {
    const r = run(root, {});
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/No state directory/);
  });

  it('refuses a symlinked state directory', () => {
    const real = path.join(root, 'real');
    fs.mkdirSync(real);
    fs.symlinkSync(real, path.join(root, 'link'));
    const r = run(root, { DROMOS_STATE_DIR: path.join(root, 'link') });
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
  });
});

describe.skipIf(!hasPwsh)('Write-StatusTable.ps1 live runners (#468)', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statustable-lease-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const state = () => path.join(dir, '.agents');
  const run = (args: string[], input?: string) =>
    spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], {
      cwd: dir,
      encoding: 'utf8',
      input,
      env: { ...process.env, PATH: pathWith(failingGhDir), DROMOS_STATE_DIR: state() },
    });
  const lease = (key: string, issue: number, minutesAgo: number) => {
    fs.mkdirSync(path.join(state(), 'leases'), { recursive: true });
    const beat = new Date(Date.now() - minutesAgo * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
    fs.writeFileSync(
      path.join(state(), 'leases', `${key}.json`),
      JSON.stringify({
        path: `/w/${key}`,
        issue,
        branch: `feat/${issue}-x`,
        host: 'h',
        started: beat,
        heartbeat: beat,
      }) + '\n'
    );
  };
  const table =
    '#12 merged First\n#13 open Second\n#14 in progress (Phase plan: complete) Third\n#15 open Fourth\n#16 pr-open #40 Fifth\n#17 blocked by #3 Sixth\nNext PBI: #13 Second\n';
  const out = () => fs.readFileSync(path.join(state(), 'status-9.md'), 'utf8');

  it('marks open and in-progress rows of a PBI with a live lease as in progress (runner); a stale lease does not count', () => {
    lease('aaaa', 13, 5);
    lease('bbbb', 14, 119);
    lease('cccc', 15, 121);
    expect(run(['-Issue', '9'], table).status).toBe(0);
    expect(out()).toBe(
      '#12 merged First\n#13 in progress (runner) Second\n#14 in progress (runner) Third\n#15 open Fourth\n#16 pr-open #40 Fifth\n#17 blocked by #3 Sixth\nNext PBI: #13 Second\n'
    );
  });

  it('keeps merged, pr-open and blocked rows even with a live lease, and never touches the title text', () => {
    lease('aaaa', 12, 1);
    lease('bbbb', 16, 1);
    lease('cccc', 17, 1);
    const t = table + '#18 open open #13 again\n';
    expect(run(['-Issue', '9'], t).status).toBe(0);
    expect(out()).toBe(t);
  });

  it('leaves the table unchanged with an unreadable lease', () => {
    fs.mkdirSync(path.join(state(), 'leases'), { recursive: true });
    fs.writeFileSync(path.join(state(), 'leases', 'bad.json'), '{not json');
    expect(run(['-Issue', '9'], table).status).toBe(0);
    expect(out()).toBe(table);
  });

  it('-Live prints the issues of the live leases only and writes no file', () => {
    lease('aaaa', 13, 5);
    lease('bbbb', 14, 300);
    lease('cccc', 15, 60);
    const r = run(['-Live']);
    expect(r.status).toBe(0);
    expect(r.stdout.split(/\r?\n/).filter(Boolean).sort()).toEqual(['13', '15']);
    expect(fs.existsSync(path.join(state(), 'status-9.md'))).toBe(false);
  });

  it('-Live prints nothing without a leases directory', () => {
    const r = run(['-Live']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });
});

describe.skipIf(!hasPwsh || process.platform === 'win32')(
  'Write-StatusTable.ps1 Needs column (#598)',
  () => {
    let dir: string;
    let worker: PwshWorker;
    beforeAll(() => {
      worker = new PwshWorker(SCRIPT);
    });
    afterAll(() => worker.close());
    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statustable-needs-'));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
    const state = () => path.join(dir, '.agents');
    const out = () => fs.readFileSync(path.join(state(), 'status-9.md'), 'utf8');
    const item = (number: number, over: Record<string, unknown> = {}) => ({
      number,
      state: 'OPEN',
      level: 'PBI',
      labels: [],
      status: 'Todo',
      blockedByOpen: 0,
      subIssueLevels: ['Task'],
      prHeads: [],
      ...over,
    });
    const run = (table: string, items: unknown[], extra: string[] = []) => {
      const sf = path.join(dir, 'state.json');
      fs.writeFileSync(sf, JSON.stringify({ items }));
      const tf = path.join(dir, 'table.md');
      fs.writeFileSync(tf, table);
      return worker.run(['-Issue', '9', '-Path', tf, '-StateFile', sf, ...extra], {
        cwd: dir,
        env: { ...process.env, DROMOS_STATE_DIR: state() },
      });
    };

    it('adds the Needs value of every rule outcome after the state and the Needs me line last', async () => {
      const table = [
        '#1 open Plan me',
        '#2 needs-decision Decide me',
        '#3 open Review me',
        '#4 blocked by #99 Blocked',
        '#5 merged Merged one',
        '#6 pr-open #50 In flight',
        '#7 open Ready one',
        '#8 open Done upstream',
        'Next PBI: #7 Ready one',
        '',
      ].join('\n');
      const r = await run(table, [
        item(1, { subIssueLevels: [] }),
        item(2, { labels: ['needs-decision'] }),
        item(3, { labels: ['needs-review'] }),
        item(4, { blockedByOpen: 1 }),
        item(5, { labels: ['merged'] }),
        item(6, { prHeads: ['feat/6-x'] }),
        item(7),
        item(8, { state: 'CLOSED' }),
      ]);
      expect(r.status, r.stderr).toBe(0);
      expect(out()).toBe(
        [
          '#1 open | Planning | Plan me',
          '#2 needs-decision | Decision | Decide me',
          '#3 open | Review | Review me',
          '#4 blocked by #99 | Blocked | Blocked',
          '#5 merged | Release review | Merged one',
          '#6 pr-open #50 | In progress | In flight',
          '#7 open | Ready | Ready one',
          '#8 open | - | Done upstream',
          'Next PBI: #7 Ready one',
          'Needs me: 1 planning, 1 decisions, 1 release review',
          '',
        ].join('\n')
      );
    });

    it('counts several planning, decision and release review rows', async () => {
      const r = await run('#1 open A\n#2 open B\n#3 open C\n#4 merged D\n#5 open E\n', [
        item(1, { subIssueLevels: [] }),
        item(2, { subIssueLevels: [] }),
        item(3, { labels: ['needs-decision'] }),
        item(4, { labels: ['merged'] }),
        item(5, { status: 'In release' }),
      ]);
      expect(r.status, r.stderr).toBe(0);
      expect(out().trimEnd().split('\n').pop()).toBe(
        'Needs me: 2 planning, 1 decisions, 2 release review'
      );
    });

    it('writes Needs me with zeros when no row needs anything, and shows - for a row without item', async () => {
      const r = await run('#1 open A\nNext PBI: #1 A\n', []);
      expect(r.status, r.stderr).toBe(0);
      expect(out()).toBe(
        '#1 open | - | A\nNext PBI: #1 A\nNeeds me: 0 planning, 0 decisions, 0 release review\n'
      );
    });

    it('keeps a row without title and leaves group headers alone', async () => {
      const r = await run('Feature #4 open F\n#1 open\n', [item(1)]);
      expect(r.status, r.stderr).toBe(0);
      expect(out()).toBe(
        'Feature #4 open F\n#1 open | Ready\nNeeds me: 0 planning, 0 decisions, 0 release review\n'
      );
    });

    it('shows In progress for a PBI with a live lease and the runner state', async () => {
      fs.mkdirSync(path.join(state(), 'leases'), { recursive: true });
      const beat = new Date().toISOString();
      fs.writeFileSync(
        path.join(state(), 'leases', 'a.json'),
        JSON.stringify({
          path: '/w',
          issue: 7,
          branch: 'b',
          host: 'h',
          started: beat,
          heartbeat: beat,
        })
      );
      const r = await run('#7 open A\n', [item(7)]);
      expect(r.status, r.stderr).toBe(0);
      expect(out()).toContain('#7 in progress (runner) | In progress | A\n');
    });

    it('reads GitHub with GET calls only and never writes the project', async () => {
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      const log = path.join(dir, 'gh.log');
      fs.writeFileSync(
        path.join(bin, 'gh'),
        `#!/bin/sh
echo "$*" >> "${log}"
case "$*" in
  *pulls*) echo '[]' ;;
  *sub_issues*) echo '[{"title":"[Task] t","type":{"name":"Task"}}]' ;;
  *blocked_by*) echo '[]' ;;
  *issues/7) echo '{"state":"open","title":"[PBI] x","labels":[{"name":"needs-decision"}],"type":{"name":"PBI"}}' ;;
  *) exit 1 ;;
esac
`,
        { mode: 0o755 }
      );
      const tf = path.join(dir, 'table.md');
      fs.writeFileSync(tf, '#7 needs-decision A\n');
      const r = await worker.run(['-Issue', '9', '-Path', tf], {
        cwd: dir,
        env: { ...process.env, PATH: pathWith(bin), DROMOS_STATE_DIR: state() },
      });
      expect(r.status, r.stderr).toBe(0);
      expect(out()).toBe(
        '#7 needs-decision | Decision | A\nNeeds me: 0 planning, 1 decisions, 0 release review\n'
      );
      const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) {
        expect(c).toMatch(/^api --method GET /);
        expect(c).not.toMatch(/graphql|--input|-X|-f |-F |PATCH|POST|PUT|DELETE/);
      }
    });

    it('warns once and keeps the rows when gh fails, exit 0', async () => {
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
      const tf = path.join(dir, 'table.md');
      fs.writeFileSync(tf, '#7 open A\n');
      const r = await worker.run(['-Issue', '9', '-Path', tf], {
        cwd: dir,
        env: { ...process.env, PATH: pathWith(bin), DROMOS_STATE_DIR: state() },
      });
      expect(r.status).toBe(0);
      expect(out()).toBe('#7 open A\n');
    });

    it('warns and keeps the rows when the module is missing, exit 0', () => {
      const copy = path.join(dir, 'copy');
      fs.mkdirSync(copy);
      fs.copyFileSync(SCRIPT, path.join(copy, 'Write-StatusTable.ps1'));
      const tf = path.join(dir, 'table.md');
      fs.writeFileSync(tf, '#7 open A\n');
      const r = spawnSync(
        'pwsh',
        [
          '-NoProfile',
          '-File',
          path.join(copy, 'Write-StatusTable.ps1'),
          '-Issue',
          '9',
          '-Path',
          tf,
        ],
        { cwd: dir, encoding: 'utf8', env: { ...process.env, DROMOS_STATE_DIR: state() } }
      );
      expect(r.status).toBe(0);
      expect(r.stderr).toContain('NeedsRules.psm1 not found');
      expect(out()).toBe('#7 open A\n');
    });
  }
);
