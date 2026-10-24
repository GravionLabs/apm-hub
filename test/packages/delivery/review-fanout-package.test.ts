import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SKILL = path.resolve(__dirname, '../../../packages/delivery/.apm/skills/review-fanout');
const SCRIPT = path.join(SKILL, 'scripts/Get-PackageSize.ps1');
const FILTER = fs.readFileSync(path.join(SKILL, 'references/package-filter.md'), 'utf8');
const MARKER = '=== DOCUMENTATION ===';
const DOC_PATTERNS = (
  /Patterns, one per line[^\n]*\n\n```text\n([\s\S]*?)\n```/.exec(FILTER)?.[1] ?? ''
)
  .split('\n')
  .filter(Boolean);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
const d = hasPwsh ? describe : describe.skip;

const git = (cwd: string, ...args: string[]): string => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};

const size = (file: string, ...extra: string[]) => {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Path', file, ...extra], {
    encoding: 'utf8',
  });
  expect(r.status).toBe(0);
  return JSON.parse(r.stdout);
};

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgsize-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

d('review package: documentation split (real git)', () => {
  it('code diff excludes documentation files, the Documentation diff has exactly those, -U3 context', () => {
    git(tmp, 'init', '-q', '-b', 'main');
    git(tmp, 'config', 'user.email', 't@t');
    git(tmp, 'config', 'user.name', 't');
    const w = (f: string, c: string) => {
      fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
      fs.writeFileSync(path.join(tmp, f), c);
    };
    const lines = (p: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${p}${i}`).join('\n') + '\n';
    const files = [
      'src/a.ts',
      'docs/top.md',
      'docs/sub/deep.md',
      'CHANGELOG.md',
      'README.md',
      'packages/x/README.md',
      'site/guide/a.md',
      'site/theme/x.ts',
    ];
    for (const f of files) w(f, lines('l', 20));
    git(tmp, 'add', '.');
    git(tmp, 'commit', '-qm', 'base');
    for (const f of files) w(f, lines('l', 20).replace('l10\n', 'CHANGED\n'));
    git(tmp, 'commit', '-qam', 'change');

    const exclude = DOC_PATTERNS.map((p) => `:(exclude,glob)${p}`);
    const include = DOC_PATTERNS.map((p) => `:(glob)${p}`);
    const code = git(tmp, 'diff', '-U3', 'HEAD~1..HEAD', '--', '.', ...exclude);
    const docs = git(tmp, 'diff', '-U3', 'HEAD~1..HEAD', '--', ...include);
    const names = (x: string) => [...x.matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1]).sort();
    expect(names(code)).toEqual(['site/theme/x.ts', 'src/a.ts']);
    expect(names(docs)).toEqual(
      [
        'CHANGELOG.md',
        'README.md',
        'docs/sub/deep.md',
        'docs/top.md',
        'packages/x/README.md',
        'site/guide/a.md',
      ].sort()
    );
    // -U3: three context lines each side of the change
    expect(code).toContain(' l7\n l8\n l9\n-l10\n+CHANGED\n l11');
    expect(code).not.toContain('\n l6\n');

    const pkg = path.join(tmp, 'pkg.diff');
    fs.writeFileSync(pkg, `${code}${MARKER}\n${docs}`);
    const r = size(pkg);
    expect(r.hunks).toBe(2);
    expect(r.docsHunks).toBe(6);
    expect(r.bytes).toBe(fs.statSync(pkg).size);
    expect(r.oversize).toBeUndefined();
  });
});

d('Get-PackageSize.ps1', () => {
  const sec = (file: string, body: string) =>
    `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n${body}\n`;

  it('estimates tokens as ceil(bytes / 4) and counts hunks per section', () => {
    const p = path.join(tmp, 'p.diff');
    fs.writeFileSync(p, `${sec('a', '+x')}@@ -5 +5 @@\n+y\n${MARKER}\n${sec('docs/d.md', '+z')}`);
    const r = size(p);
    expect(r.hunks).toBe(2);
    expect(r.docsHunks).toBe(1);
    expect(r.tokensEstimated).toBe(Math.ceil(r.bytes / 4));
    expect(r.tokensEstimated).toBeGreaterThan(0);
  });

  it('counts a heading-like "## Documentation" in issue text as ordinary content', () => {
    const p = path.join(tmp, 'p.diff');
    fs.writeFileSync(
      p,
      `${sec('a', '+x')}## Documentation\nissue text\n@@ not a hunk? yes it is\n`
    );
    const r = size(p);
    expect(r.hunks).toBe(2);
    expect(r.docsHunks).toBe(0);
  });

  it('stays quiet at exactly the threshold and adds oversize with the 3 largest files above it', () => {
    const p = path.join(tmp, 'p.diff');
    const pad = (n: number) => '+' + 'x'.repeat(n);
    fs.writeFileSync(
      p,
      sec('small.ts', pad(10)) +
        sec('big.ts', pad(6000)) +
        sec('mid.ts', pad(3000)) +
        sec('low.ts', pad(500)) +
        sec('tiny.ts', pad(5))
    );
    const bytes = fs.statSync(p).size;
    const tokens = Math.ceil(bytes / 4);
    expect(size(p, '-Threshold', String(tokens)).oversize).toBeUndefined();
    const r = size(p, '-Threshold', String(tokens - 1));
    expect(r.oversize.threshold).toBe(tokens - 1);
    expect(r.oversize.largest.map((x: any) => x.file)).toEqual(['big.ts', 'mid.ts', 'low.ts']);
    expect(r.oversize.largest[0].bytes).toBeGreaterThan(6000);
    expect(r.summary).toMatch(/^package ~\d+k tokens > \d+k — largest: big\.ts, mid\.ts, low\.ts$/);
  });

  it('uses 15000 as the default threshold', () => {
    const p = path.join(tmp, 'p.diff');
    fs.writeFileSync(p, sec('a.ts', '+' + 'x'.repeat(60100)));
    const r = size(p);
    expect(r.tokensEstimated).toBeGreaterThan(15000);
    expect(r.oversize.threshold).toBe(15000);
    expect(r.summary).toMatch(/> 15k —/);
  });
});
