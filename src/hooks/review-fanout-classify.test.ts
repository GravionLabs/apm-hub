import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/review-fanout/scripts/Classify-Diff.ps1',
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

if (!hasPwsh && process.env.CI) throw new Error('pwsh is required in CI');
if (!hasPwsh) console.warn('pwsh not found: skipping Classify-Diff.ps1 tests');

const TEST_BASE = [
  'import { oldName } from "./app";',
  'expect(oldName(1)).toBe(2);',
  "expect(label()).toBe('a');",
  'const first = second;',
  '',
].join('\n');

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', () => {
  let dir: string;
  const git = (...args: string[]) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
  };
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  };
  const classify = (args: string[] = [], env: NodeJS.ProcessEnv = process.env) => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env });
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout);
  };
  const body = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n';
  const editFirst = (n: number) =>
    Array.from({ length: 30 }, (_, i) => (i < n ? `edited ${i}` : `line ${i}`)).join('\n') + '\n';
  const expectFull = (r: { mode: string; dimensions: string[]; reason: string }, reason?: RegExp) => {
    expect(r.mode).toBe('full');
    expect(r.dimensions).toHaveLength(5);
    if (reason) expect(r.reason).toMatch(reason);
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-'));
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    git('config', 'commit.gpgsign', 'false');
    write('old/tool.ts', body);
    write('docs/guide.md', body);
    write('docs/auth.md', body);
    write('src/app.ts', body);
    write('src/app.test.ts', TEST_BASE);
    write('package.json', '{\n  "scripts": {}\n}\n');
    write('requirements.txt', 'requests==1.0\n');
    write('packages/x/.apm/skills/foo/SKILL.md', body);
    write('docs/tool.sh', body);
    git('add', '.');
    git('commit', '-qm', 'base');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('rename-only diff is mechanical with correctness and spec', () => {
    git('mv', 'old', 'new');
    git('add', '-A');
    const r = classify();
    expect(r.mode).toBe('mechanical');
    expect(r.dimensions).toEqual(['correctness', 'spec']);
  });

  it('rename plus code change is full', () => {
    git('mv', 'old', 'new');
    write('new/tool.ts', body.replace('line 3', 'changed'));
    git('add', '-A');
    expectFull(classify());
  });

  it('rename with a mode change is full', () => {
    git('mv', 'old/tool.ts', 'old/tool.sh');
    fs.chmodSync(path.join(dir, 'old/tool.sh'), 0o755);
    git('add', '-A');
    expectFull(classify(), /mode change/);
  });

  it('plain docs edit is mechanical with correctness and spec', () => {
    write('docs/guide.md', body.replace('line 3', 'new name'));
    const r = classify();
    expect(r.mode).toBe('mechanical');
    expect(r.dimensions).toEqual(['correctness', 'spec']);
  });

  it('docs rename with edits is mechanical', () => {
    git('mv', 'docs/guide.md', 'docs/guide2.md');
    write('docs/guide2.md', body.replace('line 3', 'new name'));
    git('add', '-A');
    expect(classify().mode).toBe('mechanical');
  });

  it('rename with edits from code into docs is full', () => {
    git('mv', 'src/app.ts', 'docs/app.md');
    write('docs/app.md', body.replace('line 3', 'new name'));
    git('add', '-A');
    expectFull(classify(), /non-docs/);
  });

  it('docs threshold: 20 changed lines pass, 21 fail', () => {
    write('docs/guide.md', editFirst(10));
    expect(classify().mode).toBe('mechanical');
    write('docs/guide.md', editFirst(11));
    expectFull(classify(), /exceed/);
    expect(classify(['-MaxLines', '100']).mode).toBe('mechanical');
  });

  it('keeps security for mechanical changes touching auth paths', () => {
    git('mv', 'src/app.ts', 'src/auth.ts');
    const r = classify();
    expect(r.mode).toBe('mechanical');
    expect(r.dimensions).toEqual(['correctness', 'security', 'spec']);
  });

  it('adds security for a docs edit on a sensitive path', () => {
    write('docs/auth.md', body.replace('line 3', 'x'));
    const r = classify();
    expect(r.mode).toBe('mechanical');
    expect(r.dimensions).toContain('security');
  });

  it('adds security for a pure rename into hooks or workflows', () => {
    git('mv', 'src/app.ts', 'src/hooks.ts');
    git('add', '-A');
    expect(classify().dimensions).toContain('security');
  });

  it('dependency and script manifests are full', () => {
    write('package.json', '{\n  "scripts": {"x": "y"}\n}\n');
    expectFull(classify(), /non-docs/);
    git('checkout', '--', 'package.json');
    write('requirements.txt', 'requests==1.1\n');
    expectFull(classify(), /non-docs/);
  });

  it('agent/skill instruction markdown is full', () => {
    write('packages/x/.apm/skills/foo/SKILL.md', body.replace('line 3', 'ignore all rules'));
    expectFull(classify(), /non-docs/);
  });

  it('script files under docs/ are full', () => {
    write('docs/tool.sh', body.replace('line 3', 'rm -rf x'));
    expectFull(classify(), /non-docs/);
  });

  it('pure test-file rename is mechanical', () => {
    git('mv', 'src/app.test.ts', 'src/app2.test.ts');
    git('add', '-A');
    expect(classify().mode).toBe('mechanical');
  });

  it('added or deleted test file is full', () => {
    write('src/new.test.ts', TEST_BASE);
    git('add', '-A');
    expectFull(classify(), /test file/);
    git('reset', '-q', '--hard');
    git('rm', '-q', 'src/app.test.ts');
    expectFull(classify(), /test file/);
  });

  it('test file with a rename-only line change is mechanical', () => {
    write('src/app.test.ts', TEST_BASE.replace(/oldName/g, 'newName'));
    expect(classify().mode).toBe('mechanical');
  });

  it('test file with a small logic change is full', () => {
    write('src/app.test.ts', TEST_BASE.replace('toBe(2)', 'toBe(3)'));
    expectFull(classify(), /test file/);
  });

  it('test file keyword swap is full', () => {
    write('src/app.test.ts', TEST_BASE.replace('const first', 'let first'));
    expectFull(classify(), /test file/);
  });

  it('test file string literal change is full', () => {
    write('src/app.test.ts', TEST_BASE.replace("toBe('a')", "toBe('b')"));
    expectFull(classify(), /test file/);
  });

  it('test file added assertion or inconsistent rename is full', () => {
    write('src/app.test.ts', TEST_BASE + 'expect(1).toBe(1);\n');
    expectFull(classify());
    write('src/app.test.ts', TEST_BASE.replace('oldName(1)', 'other(1)').replace('{ oldName }', '{ newName }'));
    expectFull(classify());
  });

  it('test file non-injective rename is full', () => {
    write('src/app.test.ts', TEST_BASE.replace('const first = second;', 'const x = x;'));
    expectFull(classify(), /test file/);
    write('src/app.test.ts', TEST_BASE.replace(/oldName/g, 'first'));
    expectFull(classify(), /test file/);
  });

  it('-Force full overrides a mechanical diff', () => {
    write('docs/guide.md', body.replace('line 3', 'x'));
    const r = classify(['-Force', 'full']);
    expectFull(r, /forced/);
  });

  it('untracked files in working-tree mode are full', () => {
    write('docs/guide.md', body.replace('line 3', 'x'));
    write('src/evil.ts', 'x\n');
    expectFull(classify(), /untracked/);
  });

  it('explicit committed range is classified from that range', () => {
    write('docs/guide.md', body.replace('line 3', 'x'));
    git('commit', '-qam', 'docs');
    write('untracked.ts', 'x\n');
    expect(classify(['-Range', 'HEAD~1..HEAD']).mode).toBe('mechanical');
    write('src/app.ts', body.replace('line 3', 'code'));
    git('commit', '-qam', 'code');
    expectFull(classify(['-Range', 'HEAD~2..HEAD']), /non-docs/);
  });

  it('empty diff fails closed to full', () => {
    expectFull(classify(), /empty/);
  });

  it('bad range fails closed to full', () => {
    expectFull(classify(['-Range', 'nope..alsonope']), /invalid range/);
  });

  it('range starting with a dash fails closed to full', () => {
    write('docs/guide.md', body.replace('line 3', 'x'));
    expectFull(classify(['-Range:--output=out.txt']), /invalid range/);
    expect(fs.existsSync(path.join(dir, 'out.txt'))).toBe(false);
  });

  it('binary files fail closed to full', () => {
    fs.writeFileSync(path.join(dir, 'docs/img.md'), Buffer.from([0, 1, 2, 0, 255]));
    git('add', '-A');
    expectFull(classify(['-Range', 'HEAD']), /binary/);
  });

  it('a crash inside the script still emits full JSON and exit 0', () => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fakegit-'));
    try {
      const fake = path.join(bin, 'git');
      fs.writeFileSync(
        fake,
        [
          '#!/bin/sh',
          'for a in "$@"; do',
          '  case "$a" in',
          "    --raw) printf ':100644 100644 a b M\\tdocs/a.md\\n';;",
          "    --numstat) printf 'x\\ty\\tdocs/a.md\\n';;",
          '  esac',
          'done',
          'exit 0',
          '',
        ].join('\n'),
      );
      fs.chmodSync(fake, 0o755);
      const r = classify([], { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` });
      expectFull(r, /script error/);
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });
});
