import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/shared/.apm/skills/detect-techstack/scripts/Enable-Worktrees.ps1'
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
const SNIPPET = "exclude: [...configDefaults.exclude, '**/.worktrees/**']";

interface Result {
  root: string;
  changed: string[];
  hints: { file: string; message: string; snippet: string }[];
  ok: boolean;
}
interface Step {
  code: number;
  out: Result;
}

describe.skipIf(!hasPwsh || process.platform === 'win32')('Enable-Worktrees.ps1', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enable-wt-'));
    spawnSync('git', ['init', '-q'], { cwd: dir });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (rel: string, content = '', mode?: number) => {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
    if (mode) fs.chmodSync(f, mode);
  };
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');
  const fakeBin = (name: string, body: string) =>
    write(`node_modules/.bin/${name}`, `#!/bin/sh\n${body}\n`, 0o755);
  // fake vitest: lists every *.test.ts, or only src/ when the config has a scoped include
  const fakeVitest = () =>
    fakeBin(
      'vitest',
      `if grep -q 'src/\\*\\*' vitest.config.ts 2>/dev/null; then find src -name '*.test.ts' 2>/dev/null; else find . -name '*.test.ts' -not -path './node_modules/*' | sed 's|^\\./||'; fi`
    );
  const fakeBiome = () => fakeBin('biome', 'echo "$@" > biome.ran');

  /** One pwsh process runs all steps ('apply' | 'check') in order. */
  const run = (steps: ('apply' | 'check')[], stack: object = { vitest: true }): Step[] => {
    const stackFile = path.join(os.tmpdir(), `${path.basename(dir)}-stack.json`);
    fs.writeFileSync(stackFile, JSON.stringify(stack));
    const calls = steps
      .map(
        (s) =>
          `$o = & '${SCRIPT}' -Root '${dir}' -TechStack '${stackFile}' ${s === 'check' ? '-Check' : ''} | Out-String; [pscustomobject]@{ code = $LASTEXITCODE; out = ($o | ConvertFrom-Json) }`
      )
      .join('\n');
    const r = spawnSync(
      'pwsh',
      ['-NoProfile', '-Command', `@(\n${calls}\n) | ConvertTo-Json -Depth 8 -AsArray`],
      { encoding: 'utf8' }
    );
    fs.rmSync(stackFile, { force: true });
    expect(r.stderr).toBe('');
    return JSON.parse(r.stdout);
  };
  const snapshot = () => {
    const out: Record<string, string> = {};
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === '.git') continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else out[path.relative(dir, p)] = fs.readFileSync(p, 'utf8');
      }
    };
    walk(dir);
    return out;
  };

  it('creates .gitignore when missing and is idempotent', () => {
    const [first, second] = run(['apply', 'apply'], {});
    expect(first.out.changed).toEqual(['.gitignore']);
    expect(first.out.ok).toBe(true);
    expect(read('.gitignore')).toBe('.worktrees/\n');
    expect(second.out.changed).toEqual([]);
  });

  it('appends to an existing .gitignore without trailing newline', () => {
    write('.gitignore', 'node_modules');
    run(['apply'], {});
    expect(read('.gitignore')).toBe('node_modules\n.worktrees/\n');
  });

  it('leaves a repository alone that already ignores .worktrees dir', () => {
    write('.gitignore', '.worktrees/\n');
    const [r] = run(['apply'], {});
    expect(r.out.changed).toEqual([]);
    expect(read('.gitignore')).toBe('.worktrees/\n');
  });

  it('sets the biome vcs block and formats through node_modules/.bin', () => {
    write('.gitignore', '.worktrees/\n');
    write(
      'biome.json',
      JSON.stringify({
        formatter: { indentStyle: 'space' },
        vcs: { enabled: false, defaultBranch: 'main' },
      })
    );
    fakeBiome();
    const [first, second] = run(['apply', 'apply'], {});
    expect(first.out.changed).toEqual(['biome.json']);
    expect(first.out.hints).toEqual([]);
    const cfg = JSON.parse(read('biome.json'));
    expect(cfg.vcs).toEqual({
      enabled: true,
      clientKind: 'git',
      useIgnoreFile: true,
      defaultBranch: 'main',
    });
    expect(cfg.formatter).toEqual({ indentStyle: 'space' });
    expect(read('biome.ran').trim()).toBe('format --write biome.json');
    expect(second.out.changed).toEqual([]);
  });

  it('hints when the biome binary is missing', () => {
    write('.gitignore', '.worktrees/\n');
    write('biome.json', '{}');
    const [r] = run(['apply'], {});
    expect(r.out.changed).toEqual(['biome.json']);
    expect(r.out.hints.map((h) => h.file)).toEqual(['biome.json']);
    expect(JSON.parse(read('biome.json')).vcs.useIgnoreFile).toBe(true);
  });

  it('appends to .dockerignore when present', () => {
    write('.gitignore', '.worktrees/\n');
    write('.dockerignore', 'node_modules');
    const [first, second] = run(['apply', 'apply'], {});
    expect(first.out.changed).toEqual(['.dockerignore']);
    expect(read('.dockerignore')).toBe('node_modules\n.worktrees/\n');
    expect(second.out.changed).toEqual([]);
  });

  it('hints for an unscoped Vitest include and removes the probe', () => {
    write('.gitignore', '.worktrees/\n');
    write('vitest.config.ts', 'export default {};\n');
    write('src/a.test.ts');
    fakeVitest();
    const [r] = run(['apply']);
    expect(r.out.hints).toHaveLength(1);
    expect(r.out.hints[0].snippet).toBe(SNIPPET);
    expect(r.out.ok).toBe(false);
    expect(fs.existsSync(path.join(dir, '.worktrees'))).toBe(false);
    expect(read('vitest.config.ts')).toBe('export default {};\n');
  });

  it('reports no hint for a scoped Vitest include', () => {
    write('.gitignore', '.worktrees/\n');
    write('vitest.config.ts', "export default { test: { include: ['src/**/*.test.ts'] } };\n");
    write('src/a.test.ts');
    fakeVitest();
    const [r] = run(['apply']);
    expect(r.out.hints).toEqual([]);
    expect(r.out.ok).toBe(true);
  });

  it('removes the probe even when vitest list fails', () => {
    write('.gitignore', '.worktrees/\n');
    write('.worktrees/keep.txt', 'x');
    fakeBin('vitest', 'exit 1');
    const [r] = run(['apply']);
    expect(r.code).toBe(0);
    expect(r.out.hints).toEqual([]);
    expect(fs.existsSync(path.join(dir, '.worktrees/__probe__'))).toBe(false);
    expect(fs.existsSync(path.join(dir, '.worktrees/keep.txt'))).toBe(true);
  });

  it('skips the probe when the stack has no vitest', () => {
    write('.gitignore', '.worktrees/\n');
    write('src/a.test.ts');
    fakeVitest();
    const [r] = run(['apply'], { languages: ['ts'] });
    expect(r.out.hints).toEqual([]);
  });

  it('hints for eslint.config.*', () => {
    write('.gitignore', '.worktrees/\n');
    write('eslint.config.mjs', 'export default [];\n');
    const [r] = run(['apply'], {});
    expect(r.out.hints.map((h) => h.file)).toEqual(['eslint.config.mjs']);
  });

  it('-Check exits 1 and writes nothing on drift', () => {
    write('.dockerignore', 'node_modules\n');
    write('biome.json', '{}');
    write('eslint.config.js', '');
    fakeBiome();
    const before = snapshot();
    const [r] = run(['check'], {});
    expect(r.code).toBe(1);
    expect(r.out.ok).toBe(false);
    expect(r.out.changed).toEqual(['.gitignore', '.dockerignore', 'biome.json']);
    expect(snapshot()).toEqual(before);
  });

  it('-Check exits 0 on a clean repository and after apply', () => {
    write('.dockerignore', 'node_modules\n');
    write('biome.json', '{}');
    fakeBiome();
    const [apply, check] = run(['apply', 'check'], {});
    expect(apply.code).toBe(0);
    expect(check.code).toBe(0);
    expect(check.out).toMatchObject({ changed: [], hints: [], ok: true });
  });

  it('-Check leaves no probe behind and still reports the Vitest hint', () => {
    write('.gitignore', '.worktrees/\n');
    fakeVitest();
    write('src/a.test.ts');
    const [r] = run(['check']);
    expect(r.code).toBe(1);
    expect(r.out.hints[0].snippet).toBe(SNIPPET);
    expect(fs.existsSync(path.join(dir, '.worktrees'))).toBe(false);
  });
});
