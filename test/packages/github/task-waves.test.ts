import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Fixture, git, json, makeRepo, readLeases, run } from './worktree-test-helpers';

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const ROOT = path.resolve(__dirname, '../../..');
const REFS = path.join(ROOT, 'packages/github/.apm/skills/github-issue/references');
const waves = fs.readFileSync(path.join(REFS, 'task-waves.md'), 'utf8');

type Item = { id: string; issue: number | null; size?: string; blocked_by?: (string | number)[]; files?: string[] };
const item = (id: string, files: string[], o: Partial<Item> = {}): Item => ({ id, issue: null, size: 'S', blocked_by: [], files, ...o });

describe.skipIf(!hasPwsh)('Get-TaskWaves.ps1', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'waves-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const compute = (items: Item[], parallel: number, done: string[] = []) => {
    const plan = path.join(dir, 'plan.json');
    fs.writeFileSync(plan, JSON.stringify({ items }));
    const r = run('Get-TaskWaves.ps1', ['-Plan', plan, '-Parallel', String(parallel), ...(done.length ? ['-Done', done.join(',')] : [])], dir);
    return { status: r.status, out: r.status === 0 ? JSON.parse(r.stdout.trim()) : r.stderr };
  };

  it('puts independent Tasks with disjoint files into one wave, in plan order', () => {
    expect(compute([item('p1', ['a']), item('p2', ['b']), item('p3', ['c'])], 3).out).toEqual([['p1', 'p2', 'p3']]);
  });

  it('follows the blocked_by DAG: a blocked Task waits for the wave of its blocker', () => {
    const items = [item('p1', ['a']), item('p2', ['b'], { blocked_by: ['p1'] }), item('p3', ['c']), item('p4', ['d'], { blocked_by: ['p2', 'p3'] })];
    expect(compute(items, 3).out).toEqual([['p1', 'p3'], ['p2'], ['p4']]);
  });

  it('keeps Tasks with overlapping files (equal path or directory prefix) out of the same wave', () => {
    const items = [item('p1', ['src/a.ts']), item('p2', ['src/a.ts']), item('p3', ['src']), item('p4', ['docs/x.md'])];
    expect(compute(items, 4).out).toEqual([['p1', 'p4'], ['p2'], ['p3']]);
  });

  it('caps the wave at --parallel', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((f, i) => item(`p${i + 1}`, [f]));
    expect(compute(items, 2).out).toEqual([['p1', 'p2'], ['p3', 'p4'], ['p5']]);
    expect(compute(items, 1).out).toEqual([['p1'], ['p2'], ['p3'], ['p4'], ['p5']]);
    expect(compute(items, 4).out).toEqual([['p1', 'p2', 'p3', 'p4'], ['p5']]);
  });

  it('rejects a width outside 1-4', () => {
    expect(compute([item('p1', ['a'])], 5).status).not.toBe(0);
    expect(compute([item('p1', ['a'])], 0).status).not.toBe(0);
  });

  it('runs size L alone, also when it comes first or last', () => {
    const items = [item('p1', ['a']), item('p2', ['b'], { size: 'L' }), item('p3', ['c']), item('p4', ['d'], { size: 'L' })];
    expect(compute(items, 4).out).toEqual([['p1', 'p3'], ['p2'], ['p4']]);
    expect(compute([item('p1', ['a'], { size: 'L' }), item('p2', ['b'])], 3).out).toEqual([['p1'], ['p2']]);
  });

  it('runs a Task without files alone', () => {
    expect(compute([item('p1', []), item('p2', ['b']), item('p3', ['c'])], 3).out).toEqual([['p1'], ['p2', 'p3']]);
  });

  it('skips the done set (issue numbers with or without #, plan ids) and unblocks their dependents', () => {
    const items = [item('p1', ['a'], { issue: 11 }), item('p2', ['b'], { issue: 12, blocked_by: ['p1'] }), item('p3', ['c'], { issue: 13, blocked_by: [11] })];
    expect(compute(items, 3).out).toEqual([[11], [12, 13]]);
    expect(compute(items, 3, ['#11']).out).toEqual([[12, 13]]);
    expect(compute(items, 3, ['p1', '12']).out).toEqual([[13]]);
    expect(compute(items, 3, ['11', '12', '13']).out).toEqual([]);
  });

  it('uses the issue number as Task key when the plan item has one, the plan id otherwise', () => {
    expect(compute([item('p1', ['a'], { issue: 21 }), item('p2', ['b'])], 3).out).toEqual([[21, 'p2']]);
  });

  it('fails on a cycle', () => {
    const r = compute([item('p1', ['a'], { blocked_by: ['p2'] }), item('p2', ['b'], { blocked_by: ['p1'] })], 3);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/No unblocked Task left/);
  });

  it('fails on a missing plan file', () => {
    const r = run('Get-TaskWaves.ps1', ['-Plan', path.join(dir, 'none.json'), '-Parallel', '3'], dir);
    expect(r.status).not.toBe(0);
  });
});

describe.skipIf(!hasPwsh)('Task worktree and integration recipe of task-waves.md', () => {
  let f: Fixture;
  beforeEach(() => {
    f = makeRepo();
  });
  afterEach(() => fs.rmSync(f.root, { recursive: true, force: true }));

  const taskBranch = (pbi: string, t: string) => `feat/${pbi}-t${t}`;
  const enterTask = (pbi: string, t: string, from: string) =>
    run('Enter-Checkout.ps1', ['-Issue', `${pbi}-t${t}`, '-Branch', taskBranch(pbi, t), '-Base', 'main', '-From', from], f.repo);
  const commit = (cwd: string, file: string, content: string, msg: string) => {
    fs.writeFileSync(path.join(cwd, file), content);
    git(cwd, 'add', file);
    git(cwd, 'commit', '-q', '-m', msg);
  };

  it('Enter-Checkout -From: a worktree on the local PBI HEAD, never the main checkout, lease issue <pbi>-t<task>', () => {
    git(f.repo, 'checkout', '-q', '-b', 'feat/9');
    commit(f.repo, 'local.txt', 'unpushed\n', 'feat: local only (#9)');
    const head = git(f.repo, 'rev-parse', 'HEAD');
    const r = enterTask('9', '12', head);
    expect(r.status).toBe(0);
    const out = json(r);
    expect(out).toMatchObject({ path: path.join(f.repo, '.worktrees', '9-t12'), worktree: true, branch: 'feat/9-t12' });
    expect(git(out.path, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(f.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feat/9');
    expect(readLeases(f.state).map((l) => String(l.issue))).toEqual(['9-t12']);
    // resume: same path again
    expect(json(enterTask('9', '12', head)).path).toBe(out.path);
    // Exit-Checkout accepts the task key and removes the clean worktree
    const x = json(run('Exit-Checkout.ps1', ['-Issue', '9-t12'], f.repo));
    expect(x).toMatchObject({ released: true, worktree: true, removed: true });
    expect(readLeases(f.state)).toHaveLength(0);
  });

  it('New-Worktree -From rejects an unknown ref', () => {
    const r = run('New-Worktree.ps1', ['-Issue', '9-t12', '-Branch', 'feat/9-t12', '-Base', 'main', '-From', 'nope'], f.repo);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/Unknown -From ref/);
  });

  it('cherry-picks the task branches in plan order, then deletes the branches with update-ref', () => {
    git(f.repo, 'checkout', '-q', '-b', 'feat/9');
    const base = git(f.repo, 'rev-parse', 'HEAD');
    const w2 = json(enterTask('9', '2', base)).path;
    const w3 = json(enterTask('9', '3', base)).path;
    commit(f.repo, 'one.txt', '1\n', 'feat: one (#9)\n\nRefs #1');
    commit(w2, 'two.txt', '2\n', 'feat: two (#9)\n\nRefs #2');
    commit(w2, 'two-b.txt', '2b\n', 'feat: two b (#9)\n\nRefs #2');
    commit(w3, 'three.txt', '3\n', 'feat: three (#9)\n\nRefs #3');
    // wave base: the PBI HEAD before the wave; Task 1 already is on the PBI branch
    for (const t of ['2', '3']) git(f.repo, 'cherry-pick', `${base}..${taskBranch('9', t)}`);
    const subjects = git(f.repo, 'log', '--reverse', '--format=%s', `${base}..HEAD`).split('\n');
    expect(subjects).toEqual(['feat: one (#9)', 'feat: two (#9)', 'feat: two b (#9)', 'feat: three (#9)']);
    // resume rule: the Refs grep finds the task commit on the PBI branch
    expect(git(f.repo, 'log', '-E', '--grep', '^Refs #3$', '--format=%h', `${base}..HEAD`)).not.toBe('');
    for (const t of ['2', '3']) {
      expect(json(run('Exit-Checkout.ps1', ['-Issue', `9-t${t}`], f.repo)).removed).toBe(true);
      git(f.repo, 'update-ref', '-d', `refs/heads/${taskBranch('9', t)}`);
    }
    expect(git(f.repo, 'branch', '--list', 'feat/9-t*')).toBe('');
  });

  it('a conflicting pick is aborted and leaves the PBI branch as before the pick; conflicting files are listed', () => {
    git(f.repo, 'checkout', '-q', '-b', 'feat/9');
    const base = git(f.repo, 'rev-parse', 'HEAD');
    const w2 = json(enterTask('9', '2', base)).path;
    commit(f.repo, 'a.txt', 'from task 1\n', 'feat: one (#9)\n\nRefs #1');
    commit(w2, 'a.txt', 'from task 2\n', 'feat: two (#9)\n\nRefs #2');
    const before = git(f.repo, 'rev-parse', 'HEAD');
    const pick = spawnSync('git', ['cherry-pick', `${base}..${taskBranch('9', '2')}`], { cwd: f.repo, encoding: 'utf8' });
    expect(pick.status).not.toBe(0);
    expect(git(f.repo, 'diff', '--name-only', '--diff-filter=U')).toBe('a.txt');
    git(f.repo, 'cherry-pick', '--abort');
    expect(git(f.repo, 'rev-parse', 'HEAD')).toBe(before);
    expect(git(f.repo, 'status', '--porcelain', '--untracked-files=no')).toBe('');
    // resume: the unintegrated task branch is found by its Refs commit ahead of the PBI branch
    expect(git(f.repo, 'log', '-E', '--grep', '^Refs #2$', '--format=%h', `HEAD..${taskBranch('9', '2')}`)).not.toBe('');
  });
});

describe('task-waves.md text', () => {
  it('holds the defaults in one place', () => {
    expect(waves).toMatch(/default 3/);
    expect(waves).toMatch(/at most \*\*4 `implementer` subagents at once per repository\*\*/);
    expect(waves).toMatch(/`--parallel 1`/);
  });

  it('states the wave rule', () => {
    expect(waves).toMatch(/in plan order, at most `<n>`/);
    expect(waves).toMatch(/`size: L` or without `files` runs alone/);
    expect(waves).toMatch(/`BASE`.*once, before the first wave/);
  });

  it('dispatches all implementers in one message, first Task in the PBI checkout', () => {
    expect(waves).toMatch(/ONE message/);
    expect(waves).toMatch(/first Task of the wave works in the PBI checkout/);
    expect(waves).toMatch(/\.worktrees\/<pbi>-t<task>/);
    expect(waves).toMatch(/Refs #<task>/);
  });

  it('integrates by cherry-pick in plan order, then one verify-project, then Exit-Checkout and branch delete', () => {
    const i = (re: RegExp) => waves.search(re);
    expect(i(/git cherry-pick <WAVE_BASE>/)).toBeGreaterThan(0);
    expect(i(/in plan order:/)).toBeGreaterThan(0);
    expect(i(/git cherry-pick <WAVE_BASE>/)).toBeLessThan(i(/One `verify-project` on the integrated `HEAD`/));
    expect(i(/One `verify-project` on the integrated `HEAD`/)).toBeLessThan(i(/Exit-Checkout\.ps1 -Issue <pbi>-t<task>/));
    expect(waves).toMatch(/git update-ref -d refs\/heads\//);
  });

  it('falls back to a sequential run with the conflicting files and a Ruling line', () => {
    expect(waves).toMatch(/git cherry-pick --abort/);
    expect(waves).toMatch(/Ruling: cherry-pick conflict #<task>/);
    expect(waves).toMatch(/re-dispatch that Task \*\*sequentially on the PBI branch\*\*/);
    expect(waves).toMatch(/names the conflicting files/);
    expect(waves).toMatch(/existing gate/);
  });

  it('writes DONE only after integration and the Wave line with integrated sha or conflict', () => {
    expect(waves).toMatch(/Ledger, only now: `Task #<nr>: DONE/);
    expect(waves).toMatch(/Wave <w>: <task list> — integrated <sha>/);
    expect(waves).toMatch(/Wave <w>: <task list> — conflict #<task>/);
  });

  it('resumes by integrating an unintegrated task branch', () => {
    expect(waves).toMatch(/exists locally with a commit `Refs #<task>`/);
    expect(waves).toMatch(/integrate it .* instead of re-implementing/);
  });

  it('logs the worktree install time and installs the way verify-project expects', () => {
    expect(waves).toMatch(/pnpm install --frozen-lockfile/);
    expect(waves).toMatch(/Worktree #<task>: install <seconds>s/);
  });

  it('task-issues.md says task branches are local only and never pushed', () => {
    const t = fs.readFileSync(path.join(REFS, 'task-issues.md'), 'utf8');
    expect(t).toMatch(/task branches are local only and never pushed/);
  });
});
