import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ALWAYS_FULL, REFERENCE } from './classify-reference';

export { ALWAYS_FULL, REFERENCE };

const SKILL = path.resolve(__dirname, '../../packages/delivery/.apm/skills/review-fanout');
export const SCRIPT = path.join(SKILL, 'scripts/Classify-Diff.ps1');
export const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

// Path triggers of $sensitive (reference "Dimensions"), each placed in an added docs file.
export const SENSITIVE = [
  ...[
    'auth',
    'crypt',
    'password',
    'secret',
    'token',
    'oauth',
    'login',
    'http',
    'network',
    'socket',
    'sql',
    'query',
  ],
  ...[
    'database',
    'jwt',
    'session',
    'cookie',
    'permission',
    'rbac',
    'acl',
    'cert',
    'tls',
    'ssl',
    'cors',
    'csrf',
  ],
  ...['hash', 'apikey', 'api_key', 'hook', 'migration'],
]
  .map((w) => `docs/${w}-notes.md`)
  .concat(['docs/my-dockerfile.md', 'docs/prod.env-notes.md', 'docs/public/notes.md']);

export const AGENT = [
  '---',
  'name: a',
  'description: Agent a',
  "tools: ['read', 'search']",
  'metadata:',
  '  claude:',
  '    permission: ask',
  '---',
  'Body line 1',
  'Body line 2',
  '',
].join('\n');

export type Result = {
  mode: string;
  dimensions: string[];
  reason: string;
  size: string;
  signals: string[];
  skippedDimensions: Array<{ dimension: string; reason: string }>;
};
export const ALL_DIMS = ['correctness', 'security', 'conventions', 'tests', 'spec'];

export const hermetic = (home: string): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  for (const k of Object.keys(env))
    if (k.startsWith('GIT_') || k === 'XDG_CONFIG_HOME') delete env[k];
  return { ...env, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
};

// A full diff reviews the five dimensions, or fewer when it is small: reviewed + skipped stay the five.
export const expectFull = (r: Result, reason?: RegExp) => {
  expect(r.mode).toBe('full');
  const rest = ALL_DIMS.filter((d) => !r.dimensions.includes(d));
  expect(r.skippedDimensions.map((s) => s.dimension)).toEqual(rest);
  // Small diffs: correctness, tests, spec, security on risky/sensitive, conventions on source.
  const keep = r.size === 'large' ? ALL_DIMS : ['correctness', 'tests', 'spec'];
  if (r.size === 'small') {
    if (r.signals.includes('risky') || r.signals.includes('sensitive')) keep.push('security');
    if (r.signals.includes('source')) keep.push('conventions');
  }
  expect(r.dimensions).toEqual(ALL_DIMS.filter((d) => keep.includes(d)));
  if (reason) expect(r.reason).toMatch(reason);
};
// Full with all five dimensions, size large and nothing skipped (forced or unmeasurable).
export const expectFullAll = (r: Result, reason?: RegExp) => {
  expect(r.mode).toBe('full');
  expect(r.dimensions).toEqual(ALL_DIMS);
  expect(r.size).toBe('large');
  expect(r.skippedDimensions).toEqual([]);
  expect(r.signals).toEqual([]);
  if (reason) expect(r.reason).toMatch(reason);
};
export const expectMech = (r: Result) => {
  expect(r.mode).toBe('mechanical');
  expect(r.dimensions).toEqual(['correctness', 'spec']);
  expect(r.reason).toMatch(/^only same-class renames/);
};
export const expectMode = (r: Result, mode: string, dimensions: string[]) => {
  expect(r.mode).toBe(mode);
  expect(r.dimensions).toEqual(dimensions);
};
export const expectDocs = (r: Result) => expectMode(r, 'docs', ['conventions', 'spec']);
export const expectSkillText = (r: Result) =>
  expectMode(r, 'text', ['correctness', 'conventions', 'spec']);
export const expectTests = (r: Result) => expectMode(r, 'text', ['correctness', 'tests', 'spec']);
export const expectSec = (r: Result) => {
  expect(r.mode).toBe('mechanical');
  expect(r.dimensions).toEqual(['correctness', 'security', 'spec']);
};

export const TEST_BASE = [
  'const oldName = (n: number) => n + 1;',
  'expect(oldName(1)).toBe(2);',
  "expect(label()).toBe('a');",
  'const first = second;',
  '',
].join('\n');

/**
 * Uses Vitest globals (describe hooks) and must be called inside a describe. Registers the shared Classify-Diff fixture (one repository tagged `base`, hooks included) in the
 * calling describe and returns the helpers. All state is per call, so every test file gets its own
 * repository and, with it, its own Vitest worker. `batched()` runs all cases of a describe in one
 * pwsh process.
 */
export const createClassifyFixture = () => {
  let dir: string;
  let home: string;
  let runner: string;
  let caseNo = 0;
  // `dirty`: the working tree or repository may differ from `base`; only then does beforeEach reset it.
  let dirty = false;
  let gitCalls = 0;
  let commitCalls = 0;
  const run = (cmd: string, args: string[]) => {
    dirty = true;
    gitCalls++;
    if (args[0] === 'commit') commitCalls++;
    const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', env: hermetic(home) });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout;
  };
  const git = (...args: string[]) => run('git', args);
  const write = (rel: string, content: string) => {
    dirty = true;
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  };
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');
  const mv = (from: string, to: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true });
    git('mv', from, to);
  };
  const classify = (
    args: string[] = [],
    env: NodeJS.ProcessEnv = hermetic(home),
    cwd = dir
  ): Result => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], {
      cwd,
      encoding: 'utf8',
      env,
    });
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
    dirty = false;
  };

  // Batched cases avoid git: the working tree is snapshotted with fs and restored from the base
  // snapshot, and all case commits are created by ONE `git fast-import` (parent: `base`, or HEAD
  // when the setup made its own prep commit). A case costs git calls only for what its setup does.
  type Entry = { mode: string; data: Buffer };
  const walk = (rel = ''): Array<[string, Entry]> =>
    fs
      .readdirSync(path.join(dir, rel), { withFileTypes: true })
      .flatMap((e): Array<[string, Entry]> => {
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (p === '.git') return [];
        const abs = path.join(dir, p);
        if (e.isDirectory()) return walk(p);
        if (e.isSymbolicLink())
          return [[p, { mode: '120000', data: Buffer.from(fs.readlinkSync(abs)) }]];
        return [
          [
            p,
            {
              mode: fs.statSync(abs).mode & 0o111 ? '100755' : '100644',
              data: fs.readFileSync(abs),
            },
          ],
        ];
      });
  let baseTree: Array<[string, Entry]> = [];
  const restoreBase = () => {
    for (const e of fs.readdirSync(dir))
      if (e !== '.git') fs.rmSync(path.join(dir, e), { recursive: true, force: true });
    for (const [rel, e] of baseTree) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), e.data, { mode: e.mode === '100755' ? 0o755 : 0o644 });
    }
  };
  // fast-import wants C-style quoting for tab, newline, quote and backslash in paths.
  const quote = (p: string) =>
    /[\t\n"\\]/.test(p)
      ? `"${p.replace(/[\\"]/g, '\\$&').replace(/\t/g, '\\t').replace(/\n/g, '\\n')}"`
      : p;
  const commitStream = (branch: string, parent: string, tree: Array<[string, Entry]>) => {
    const msg = Buffer.from(branch);
    const parts = [
      Buffer.from(`commit refs/heads/${branch}\ncommitter t <t@t> 0 +0000\ndata ${msg.length}\n`),
      msg,
      Buffer.from(`\nfrom ${parent}\ndeleteall\n`),
    ];
    for (const [rel, e] of tree)
      parts.push(
        Buffer.from(`M ${e.mode} inline ${quote(rel)}\ndata ${e.data.length}\n`),
        e.data,
        Buffer.from('\n')
      );
    return Buffer.concat(parts);
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
      const stream: Buffer[] = [];
      const ranges = setups.map((setup, i) => {
        const branch = `case-${++caseNo}`;
        gitCalls = 0;
        commitCalls = 0;
        try {
          setup();
          const parent = commitCalls > 0 ? git('rev-parse', 'HEAD').trim() : 'refs/tags/base';
          stream.push(commitStream(branch, parent, walk()));
        } catch (e) {
          setupErrors[i] = e; // reported by this case's own test, not by the shared hook
        }
        if (gitCalls > 0) reset();
        else restoreBase();
        return `${branch}~1..${branch}`;
      });
      const imp = spawnSync('git', ['fast-import', '--quiet'], {
        cwd: dir,
        input: Buffer.concat(stream),
        env: hermetic(home),
      });
      if (imp.status !== 0) throw new Error(String(imp.stderr));
      dirty = false;
      const r = spawnSync('pwsh', ['-NoProfile', '-File', runner, SCRIPT, ...ranges], {
        cwd: dir,
        encoding: 'utf8',
        env: hermetic(home),
      });
      expect(r.status).toBe(0);
      outs = r.stdout
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Out);
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
    fs.writeFileSync(
      runner,
      [
        'param([string]$Script)',
        '$ranges = @($args)',
        '# The classifier is I/O bound (git calls): four runspaces cut the batch time; results are re-sorted.',
        '$res = 0..($ranges.Count - 1) | ForEach-Object -ThrottleLimit 4 -Parallel {',
        '  $global:LASTEXITCODE = $null',
        '  $err = @(); $o = & $using:Script -Range ($using:ranges)[$_] 2>&1 | ForEach-Object { if ($_ -is [System.Management.Automation.ErrorRecord]) { $err += "$_" } else { $_ } }',
        '  [pscustomobject]@{ i = $_; json = (@{ exit = $LASTEXITCODE; stderr = ($err -join "`n"); out = (@($o) -join "`n") } | ConvertTo-Json -Compress) }',
        '}',
        '$res | Sort-Object i | ForEach-Object { $_.json }',
        '',
      ].join('\n')
    );
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
    write('packages/x/.apm/agents/a.agent.md', AGENT);
    write('packages/x/.apm/prompts/p.prompt.md', '---\nname: p\ntools: [read]\n---\nprompt body\n');
    write('packages/x/.apm/skills/foo/templates/t.md', 'template\n');
    write('packages/x/.apm/skills/foo/assets/a.md', 'asset\n');
    write('packages/x/.apm/skills/foo/scripts/Run-Foo.ps1', 'Write-Output "foo"\n');
    write('test/helpers/h.ts', 'export const h = 1;\n');
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
    baseTree = walk();
    dirty = false;
  }, 60000);
  afterAll(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    if (home) fs.rmSync(home, { recursive: true, force: true });
  });
  beforeEach(() => {
    if (dirty) reset();
  });
  return {
    get dir() {
      return dir;
    },
    get home() {
      return home;
    },
    run,
    git,
    write,
    read,
    mv,
    classify,
    reset,
    batched,
    body,
    editFirst,
  };
};
