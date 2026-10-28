import { execFile, spawnSync } from 'child_process';
import { AsyncLocalStorage } from 'async_hooks';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';

const REAL_DETECT = path.resolve(
  __dirname,
  '../../../packages/shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1',
);
const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/delivery/.apm/skills/apm-install/scripts/Install-HubPackages.ps1',
);
const pwshProbe = spawnSync('sh', ['-c', 'command -v pwsh'], { encoding: 'utf8' });
const hasPwsh =
  pwshProbe.status === 0 && spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
const posix = process.platform !== 'win32';
const pwshPath = pwshProbe.stdout.trim();

// Safety net: the cases of the Install-HubPackages describe run concurrently, so a pwsh start can take longer on a loaded machine.
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

it.runIf(!hasPwsh && !!process.env.CI)('has pwsh in CI', () => {
  expect(hasPwsh).toBe(true);
});

describe.skipIf(!hasPwsh || !posix)('Install-HubPackages.ps1', () => {
  // Shared per describe: the fake `apm` in one bin dir. It takes its log file and its failure pattern from the environment of
  // each run, so every case keeps its own log (a file in its own dir) and nobody writes into the shared bin dir. The cases are independent (own dir, home and project), so they run concurrently:
  // `tc`/`tc.each` give every case its context (S.dir, S.home, S.proj, S.log, S.fail) through AsyncLocalStorage, and `run` is async.
  let shared: string;
  let bin: string;
  beforeAll(() => {
    shared = fs.mkdtempSync(path.join(os.tmpdir(), 'apminst-shared-'));
    bin = path.join(shared, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(
      path.join(bin, 'apm'),
      `#!/bin/sh\necho "$@" >> "$APM_LOG"\necho "apm noise: $*"\ncase "$*" in *"\${APM_FAIL:-NEVER-MATCH}"*) exit 1;; esac\n`,
      { mode: 0o755 },
    );
  });
  afterAll(() => fs.rmSync(shared, { recursive: true, force: true }));

  type Ctx = { dir: string; home: string; proj: string; log: string; fail: string };
  const store = new AsyncLocalStorage<Ctx>();
  const S = {
    get dir() {
      return store.getStore()!.dir;
    },
    get home() {
      return store.getStore()!.home;
    },
    get proj() {
      return store.getStore()!.proj;
    },
    get log() {
      return store.getStore()!.log;
    },
    set fail(v: string) {
      store.getStore()!.fail = v;
    },
  };
  const inCtx = async (fn: () => Promise<void>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apminst-'));
    const ctx: Ctx = {
      dir,
      home: path.join(dir, 'home'),
      proj: path.join(dir, 'proj'),
      log: path.join(dir, 'apm.log'),
      fail: '',
    };
    [ctx.home, ctx.proj].forEach((d) => fs.mkdirSync(d));
    fs.writeFileSync(ctx.log, '');
    try {
      await store.run(ctx, fn);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
  // a test of this describe: concurrent, with its own context; the pwsh runs of the cases overlap instead of queueing
  const tc = Object.assign(
    (name: string, fn: () => Promise<void>) => it.concurrent(name, () => inCtx(fn)),
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      each: (table: readonly any[]) => (name: string, fn: (...a: any[]) => Promise<void>) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        it.concurrent.each(table)(name, (...a: any[]) => inCtx(() => fn(...a))),
    },
  );

  // the fake apm is always in `bin`; the argument only sets which apm calls fail
  const fakeApm = (exitFor = '') => {
    S.fail = exitFor;
  };
  const apmCalls = () => {
    const text = fs.readFileSync(S.log, 'utf8').trim();
    return text ? text.split('\n') : [];
  };
  const detectDir = (root: string, client = '.claude/skills') => {
    const d = path.join(root, client, 'detect-techstack/scripts');
    fs.mkdirSync(d, { recursive: true });
    return path.join(d, 'Detect-TechStack.ps1');
  };
  // fake detect emitting the names the real script emits (ts, js, py, dotnet)
  const fakeDetect = (report: object, root = S.home, client = '.claude/skills') =>
    fs.writeFileSync(detectDir(root, client), `param($ProjectRoot)\n'${JSON.stringify(report)}'\n`);
  const globalBase = (skills = ['detect-techstack', 'github-issue', 'planner']) =>
    skills.forEach((n) =>
      fs.mkdirSync(path.join(S.home, '.claude/skills', n), { recursive: true }),
    );
  const manifest = (text: string, root = S.proj) =>
    fs.writeFileSync(path.join(root, 'apm.yml'), text);

  const run = (args: string[], pathEnv = `${bin}:${process.env.PATH}`) => {
    const c = store.getStore()!;
    return new Promise<{ status: number | null; stdout: string; stderr: string; json: any }>(
      (resolve, reject) => {
        execFile(
          pwshPath,
          ['-NoProfile', '-File', SCRIPT, ...args],
          {
            encoding: 'utf8',
            cwd: c.proj,
            env: { ...process.env, HOME: c.home, PATH: pathEnv, APM_LOG: c.log, APM_FAIL: c.fail },
          },
          (err, stdout, stderr) => {
            const status = err ? (typeof err.code === 'number' ? err.code : null) : 0;
            try {
              // stdout must be pure JSON (apm output goes to stderr)
              resolve({ status, stdout, stderr, json: stdout.trim() ? JSON.parse(stdout) : null });
            } catch (e) {
              reject(e);
            }
          },
        );
      },
    );
  };
  const notes = (r: { json: { notes: string[] } }) => r.json.notes.join(' | ');

  tc.each([
    [{ languages: ['ts'], frameworks: [] }, ['ts']],
    [{ languages: ['js'], frameworks: [] }, ['ts']],
    [{ languages: ['py'], frameworks: [] }, ['py']],
    [{ languages: ['dotnet'], frameworks: ['dotnet'] }, ['dotnet']],
    [{ languages: ['ts'], frameworks: ['angular'] }, ['ts', 'ng']],
    [{ languages: ['ts', 'py', 'dotnet'], frameworks: [] }, ['ts', 'py', 'dotnet']],
    [{ languages: ['rust'], frameworks: [] }, ['rust']],
    [{ languages: ['ts', 'rust'], frameworks: ['tauri'] }, ['ts', 'rust']],
    [{ languages: ['typescript'], frameworks: [] }, ['ts']],
    [{ languages: ['csharp'], frameworks: [] }, ['dotnet']],
    [{ languages: ['go'], frameworks: [] }, ['go']],
    [{ languages: ['java'], frameworks: [] }, []],
  ])('maps detect report %j to %j', async (report, expected) => {
    fakeApm();
    fakeDetect(report);
    globalBase();
    expect((await run(['-DryRun'])).json.wouldInstall).toEqual(expected);
  });

  tc('maps a project through the real Detect-TechStack.ps1', async () => {
    fakeApm();
    fs.copyFileSync(REAL_DETECT, detectDir(S.home));
    fs.writeFileSync(
      path.join(S.proj, 'package.json'),
      '{"dependencies":{"@angular/core":"19.0.0"},"devDependencies":{"typescript":"5.0.0"}}',
    );
    fs.writeFileSync(path.join(S.proj, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(S.proj, 'angular.json'), '{}');
    globalBase();
    const r = await run(['-DryRun']);
    expect(r.json.wouldInstall).toEqual(['ts', 'ng']);
  });

  tc('adds the base packages unless a global core is present', async () => {
    fakeApm();
    fakeDetect({ languages: ['ts'], frameworks: ['angular'] });
    // the home detect-techstack proves `shared` is already there
    expect((await run(['-DryRun'])).json.wouldInstall).toEqual(['ts', 'ng', 'github', 'delivery']);
    globalBase();
    expect((await run(['-DryRun'])).json.wouldInstall).toEqual(['ts', 'ng']);
  });

  tc('finds detect-techstack under other client directories in HOME', async () => {
    fakeApm();
    fakeDetect({ languages: ['py'], frameworks: [] }, S.home, '.config/opencode/skills');
    globalBase();
    expect((await run(['-DryRun'])).json.wouldInstall).toEqual(['py']);
  });

  tc('does not run a project-local detect-techstack without -TrustProject', async () => {
    fakeApm();
    globalBase();
    const marker = path.join(S.dir, 'ran');
    fs.writeFileSync(
      detectDir(S.proj),
      `param($ProjectRoot)\nSet-Content '${marker}' x\n'{"languages":["py"],"frameworks":[]}'\n`,
    );
    const r = await run(['-DryRun']);
    expect(fs.existsSync(marker)).toBe(false);
    expect(r.json.wouldInstall).toEqual([]);
    expect(notes(r)).toContain('-TrustProject');
    expect((await run(['-DryRun', '-TrustProject'])).json.wouldInstall).toEqual(['py']);
    expect(fs.existsSync(marker)).toBe(true);
  });

  tc('prefers the home detect-techstack over a project-local one', async () => {
    fakeApm();
    globalBase();
    fakeDetect({ languages: ['py'], frameworks: [] });
    fakeDetect({ languages: ['ts'], frameworks: [] }, S.proj);
    expect((await run(['-DryRun', '-TrustProject'])).json.wouldInstall).toEqual(['py']);
  });

  tc.each([
    ['exits non-zero', 'param($ProjectRoot)\nexit 3\n'],
    ['prints invalid JSON', "param($ProjectRoot)\n'not json'\n"],
    ['throws', "param($ProjectRoot)\nthrow 'boom'\n"],
  ])('falls back to base packages with a note when detect %s', async (_n, script) => {
    fakeApm();
    fs.writeFileSync(detectDir(S.home), script);
    const r = await run(['-DryRun']);
    expect(r.status).toBe(0);
    expect(r.json.wouldInstall).toEqual(['github', 'delivery']);
    expect(notes(r)).toContain('detect-techstack failed');
    expect(r.stderr).not.toContain('at <ScriptBlock>');
  });

  tc('falls back to base packages with a note when detect-techstack is missing', async () => {
    fakeApm();
    const r = await run(['-DryRun']);
    expect(r.json.wouldInstall).toEqual(['shared', 'github', 'delivery']);
    expect(notes(r)).toContain('detect-techstack not installed');
  });

  tc('installs and reports installed (not wouldInstall) without -DryRun', async () => {
    fakeApm();
    const r = await run(['-Packages', 'ts,py']);
    expect(r.json.installed).toEqual(['ts', 'py']);
    expect(r.json.wouldInstall).toBeUndefined();
    expect(r.json.dryRun).toBe(false);
    expect(apmCalls()).toEqual([
      'install GravionLabs/apm-hub/packages/ts',
      'install GravionLabs/apm-hub/packages/py',
    ]);
  });

  tc('-DryRun lists the commands, reports wouldInstall, and runs nothing', async () => {
    fakeApm();
    const r = await run(['-Packages', 'ts,ng', '-DryRun']);
    expect(r.status).toBe(0);
    expect(r.json.dryRun).toBe(true);
    expect(r.json.installed).toBeUndefined();
    expect(r.json.wouldInstall).toEqual(['ts', 'ng']);
    expect(r.json.commands).toEqual([
      'apm install GravionLabs/apm-hub/packages/ts',
      'apm install GravionLabs/apm-hub/packages/ng',
    ]);
    expect(apmCalls()).toEqual([]);
  });

  tc('accepts -Packages rust and lets all and core cover members', async () => {
    fakeApm();
    expect((await run(['-Packages', 'rust', '-DryRun'])).json.wouldInstall).toContain('rust');
    const r = await run(['-Packages', 'all,rust', '-DryRun']);
    expect(r.json.wouldInstall).not.toContain('rust');
    expect(notes(r)).toContain('rust is covered by all');
  });

  tc(
    'skips packages listed in apm.yml, ignoring comments, and accepts the @apm-hub form',
    async () => {
      fakeApm();
      globalBase();
      manifest(
        'dependencies:\n  apm:\n    - GravionLabs/apm-hub/packages/py\n    # - GravionLabs/apm-hub/packages/ts\n    - ng@apm-hub\n    - "GravionLabs/apm-hub/packages/dotnet#v1" # pinned\n',
      );
      const r = await run(['-Packages', 'py,ts,ng,dotnet']);
      expect(r.json.skipped).toEqual(['py', 'ng', 'dotnet']);
      expect(r.json.installed).toEqual(['ts']);
    },
  );

  tc('does not treat a longer name or another repository as installed', async () => {
    fakeApm();
    manifest(
      '  apm:\n    - GravionLabs/apm-hub/packages/ts-extra\n    - GravionLabs/apm-hub/packages/tsx\n    - other/repo/packages/py\n',
    );
    const r = await run(['-Packages', 'ts,py']);
    expect(r.json.installed).toEqual(['ts', 'py']);
    expect(r.json.skipped).toEqual([]);
  });

  tc('treats core and all as covering their members', async () => {
    fakeApm();
    manifest('  apm:\n    - GravionLabs/apm-hub/packages/core\n');
    const core = await run(['-Packages', 'shared,statusline,ts']);
    expect(core.json.skipped).toEqual(['shared', 'statusline']);
    expect(core.json.installed).toEqual(['ts']);
    manifest('  apm:\n    - all@apm-hub\n');
    expect((await run(['-Packages', 'ts,dotnet'])).json.skipped).toEqual(['ts', 'dotnet']);
  });

  tc('treats packages present in apm_modules as installed', async () => {
    fakeApm();
    fs.mkdirSync(path.join(S.proj, 'apm_modules/GravionLabs/apm-hub/packages/ts'), {
      recursive: true,
    });
    const r = await run(['-Packages', 'ts,py']);
    expect(r.json.skipped).toEqual(['ts']);
    expect(r.json.installed).toEqual(['py']);
  });

  tc.each([
    ['.agents/\n', true],
    ['node_modules\n.agents\n', true],
    ['.agents/*\n', true],
    ['.agents/*\n!.agents/config.json\n', false],
    ['.agents/skills/\n', false],
    ['dist/\n', false],
  ])('gitignore %j: notice about .agents/config.json is %s', async (gi, expected) => {
    fakeApm();
    fs.writeFileSync(path.join(S.proj, '.gitignore'), gi);
    const r = await run(['-Packages', 'ts']);
    expect(r.status).toBe(0);
    if (expected) {
      expect(notes(r)).toContain('!.agents/config.json');
      expect(notes(r)).toContain('.agents/*');
    } else {
      expect(notes(r)).not.toContain('.agents/config.json');
    }
  });

  tc('installs without an apm.yml and notes that apm creates it', async () => {
    fakeApm();
    const r = await run(['-Packages', 'ts']);
    expect(r.status).toBe(0);
    expect(r.json.installed).toEqual(['ts']);
    expect(notes(r)).toContain('apm install creates it');
  });

  tc(
    'reads the home manifest and apm_modules for -Global and ignores the project apm.yml',
    async () => {
      fakeApm();
      manifest('  apm:\n    - GravionLabs/apm-hub/packages/py\n');
      fs.mkdirSync(path.join(S.home, '.apm'));
      manifest('  apm:\n    - GravionLabs/apm-hub/packages/ts\n', path.join(S.home, '.apm'));
      fs.mkdirSync(path.join(S.home, '.apm/apm_modules/GravionLabs/apm-hub/packages/ng'), {
        recursive: true,
      });
      const r = await run(['-Packages', 'ts,py,ng', '-Global']);
      expect(r.json.skipped).toEqual(['ts', 'ng']);
      expect(r.json.installed).toEqual(['py']);
      expect(apmCalls()).toEqual(['install GravionLabs/apm-hub/packages/py -g']);
    },
  );

  tc('-Global without -Packages proposes the base packages only, without detection', async () => {
    fakeApm();
    const marker = path.join(S.dir, 'ran');
    fs.writeFileSync(
      detectDir(S.home),
      `param($ProjectRoot)\nSet-Content '${marker}' x\n'{"languages":["ts"],"frameworks":[]}'\n`,
    );
    const r = await run(['-Global', '-DryRun']);
    expect(r.json.wouldInstall).toEqual(['github', 'delivery']);
    expect(r.json.commands[0]).toBe('apm install GravionLabs/apm-hub/packages/github -g');
    expect(fs.existsSync(marker)).toBe(false);
    globalBase();
    expect((await run(['-Global', '-DryRun'])).json.wouldInstall).toEqual([]);
  });

  tc('reports the failed package and the not-attempted remainder when apm fails', async () => {
    fakeApm('packages/py');
    const r = await run(['-Packages', 'ts,py,ng,dotnet']);
    expect(r.status).toBe(1);
    expect(r.json.installed).toEqual(['ts']);
    expect(r.json.failed).toBe('py');
    expect(r.json.notAttempted).toEqual(['ng', 'dotnet']);
    expect(notes(r)).toContain('apm install failed for py');
    expect(apmCalls()).toHaveLength(2);
  });

  tc('names what was installed and the external dependencies', async () => {
    fakeApm();
    const r = await run(['-Packages', 'ng,dotnet', '-DryRun']);
    expect(Object.keys(r.json.provides)).toEqual(['ng', 'dotnet']);
    expect(r.json.provides.ng).toContain('ng-implementation');
    expect(r.json.dependencies).toEqual([
      'angular/skills (angular-developer)',
      'dotnet/skills (dotnet plugin)',
    ]);
    expect((await run(['-Packages', 'all', '-DryRun'])).json.dependencies.sort()).toEqual([
      'angular/skills (angular-developer)',
      'dotnet/skills (dotnet plugin)',
    ]);
    expect((await run(['-Packages', 'ts', '-DryRun'])).json.dependencies).toEqual([]);
  });

  tc('checks each base package separately and proposes only the missing ones', async () => {
    fakeApm();
    globalBase(['github-issue']);
    expect((await run(['-Global', '-DryRun'])).json.wouldInstall).toEqual(['shared', 'delivery']);
    globalBase(['detect-techstack', 'planner']);
    const r = await run(['-Global', '-DryRun']);
    expect(r.json.wouldInstall).toEqual([]);
    expect(notes(r)).toContain('already installed globally');
  });

  tc(
    'puts installed packages in skipped, not notAttempted, after a failure; same shape in a dry run',
    async () => {
      fakeApm('packages/py');
      manifest('  apm:\n    - GravionLabs/apm-hub/packages/dotnet\n');
      const r = await run(['-Packages', 'ts,py,dotnet,ng']);
      expect(r.json.installed).toEqual(['ts']);
      expect(r.json.failed).toBe('py');
      expect(r.json.skipped).toEqual(['dotnet']);
      expect(r.json.notAttempted).toEqual(['ng']);
      const dry = await run(['-Packages', 'ts,py,dotnet,ng', '-DryRun']);
      expect(dry.json.skipped).toEqual(['dotnet']);
      expect(dry.json.failed).toBeNull();
      expect(dry.json.notAttempted).toEqual([]);
    },
  );

  tc('reports a first-package failure with everything else not attempted', async () => {
    fakeApm('packages/ts');
    const r = await run(['-Packages', 'ts,py']);
    expect(r.status).toBe(1);
    expect(r.json.installed).toEqual([]);
    expect(r.json.failed).toBe('ts');
    expect(r.json.notAttempted).toEqual(['py']);
  });

  tc('has failed null and no notAttempted on success', async () => {
    fakeApm();
    const r = await run(['-Packages', 'ts']);
    expect(r.json.failed).toBeNull();
    expect(r.json.notAttempted).toEqual([]);
  });

  tc.each([
    'https://github.com/GravionLabs/apm-hub/packages/ts.git',
    'git@github.com:GravionLabs/apm-hub/packages/ts/',
    'GravionLabs/apm-hub/packages/ts.git#v1',
  ])('recognises the manifest form %s', async (entry) => {
    fakeApm();
    manifest(`  apm:\n    - ${entry}\n`);
    expect((await run(['-Packages', 'ts'])).json.skipped).toEqual(['ts']);
  });

  tc('does not match a look-alike host or owner in the manifest', async () => {
    fakeApm();
    manifest(
      '  apm:\n    - https://evil.example/GravionLabs/apm-hub/packages/ts\n    - xGravionLabs/apm-hub/packages/py\n',
    );
    expect((await run(['-Packages', 'ts,py'])).json.installed).toEqual(['ts', 'py']);
  });

  tc('trims whitespace and ignores empty entries in -Packages', async () => {
    fakeApm();
    expect((await run(['-Packages', 'ts, py,,', '-DryRun'])).json.wouldInstall).toEqual([
      'ts',
      'py',
    ]);
  });

  tc('exits 1 for an empty -Packages list instead of detecting', async () => {
    fakeApm();
    const r = await run(['-Packages', ' , ']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('-Packages is empty');
    expect(apmCalls()).toEqual([]);
  });

  tc('does not install members next to a requested core or all', async () => {
    fakeApm();
    const core = await run(['-Packages', 'core,shared,ts', '-DryRun']);
    expect(core.json.wouldInstall).toEqual(['core', 'ts']);
    expect(notes(core)).toContain('shared is covered by core');
    expect((await run(['-Packages', 'ts,all,core', '-DryRun'])).json.wouldInstall).toEqual(['all']);
  });

  tc('keeps apm output off stdout so it stays pure JSON', async () => {
    fakeApm();
    const r = await run(['-Packages', 'ts']);
    expect(r.stdout).not.toContain('apm noise');
    expect(r.stderr).toContain('apm noise');
  });

  tc('appends -Ref to the package spec and rejects an unsafe ref', async () => {
    fakeApm();
    const r = await run(['-Packages', 'ts', '-Ref', 'v2.3.0']);
    expect(r.json.commands).toEqual(['apm install GravionLabs/apm-hub/packages/ts#v2.3.0']);
    expect(apmCalls()).toEqual(['install GravionLabs/apm-hub/packages/ts#v2.3.0']);
    const bad = await run(['-Packages', 'ts', '-Ref', 'x; rm -rf /']);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Invalid -Ref');
  });

  tc('exits 1 when apm is not on PATH', async () => {
    const r = await run(['-Packages', 'ts'], S.dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('apm not found');
  });

  tc('rejects an invalid package name', async () => {
    fakeApm();
    const r = await run(['-Packages', 'nope']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Invalid package');
    expect(apmCalls()).toEqual([]);
  });

  tc('-Global uses the -g form', async () => {
    fakeApm();
    await run(['-Packages', 'core', '-Global']);
    expect(apmCalls()).toEqual(['install GravionLabs/apm-hub/packages/core -g']);
  });
});

describe('apm-install SKILL.md', () => {
  const skillPath = path.resolve(
    __dirname,
    '../../../packages/delivery/.apm/skills/apm-install/SKILL.md',
  );
  const text = fs.readFileSync(skillPath, 'utf-8');
  const fm = parse(text.split(/^---$/m)[1]);

  it('is a gated skill without a user-invocable key', () => {
    expect(fm.name).toBe('apm-install');
    expect(fm['disable-model-invocation']).toBe(true);
    expect(fm['user-invocable']).toBeUndefined();
    expect(fm.metadata['opencode/autoinvoke']).toBe('false');
  });

  it('documents the slash usage', () => {
    expect(text).toContain('`/apm-install`');
    expect(text).toContain('/apm-install core -g');
    expect(text).toContain('/apm-install dry-run');
  });

  it('links references that exist', () => {
    const dir = path.dirname(skillPath);
    for (const m of text.matchAll(/\]\((references\/[^)]+)\)/g)) {
      expect(fs.existsSync(path.join(dir, m[1]))).toBe(true);
    }
  });

  it('stays within 50 lines and keeps only inputs, output fields, -TrustProject and -Ref', () => {
    expect(text.split('\n').length).toBeLessThanOrEqual(50);
    expect(text).not.toContain('## Behavior of the script');
    expect(text).not.toContain('Hardening beyond the original task');
    for (const k of ['-TrustProject', '-Ref', 'wouldInstall', 'notAttempted', 'dependencies']) {
      expect(text).toContain(k);
    }
  });

  it('creates or updates .dromos/config.json via dromos init (#804)', () => {
    expect(text).toContain('dromos init --dry-run --format json --stack');
    expect(text).toContain('never with `-g`');
    expect(text).toContain('updated, never overwritten');
    expect(text).toContain('npm i -g @gravionlabs/dromos');
    expect(text).toContain('only after the user agrees');
  });

  it('names the --stack values dromos init accepts and handles invalid and older dromos', () => {
    // dromos src/runner/init.ts STACKS; go is not one of them, so the step omits --stack for other stacks
    expect(text).toContain(
      '`--stack` accepts `ts`, `py`, `dotnet`, `rust`, `ng`, omit it for any other stack',
    );
    // the JSON of `init --dry-run --format json` is {path, action, added, kept}
    for (const k of ['`action`', '`added`', '`kept`', '`unchanged`']) expect(text).toContain(k);
    expect(text).toContain('Exit 1 (`valid: false`, `errors`)');
    expect(text).toContain('do not write');
    expect(text).toContain('exit 2 (a dromos without `init`)');
  });

  describe('after-install.md', () => {
    const ref = fs.readFileSync(
      path.join(path.dirname(skillPath), 'references/after-install.md'),
      'utf8',
    );

    it('uses dromos init and dromos config check', () => {
      expect(ref).toContain('dromos init --dry-run --format json --stack ts');
      expect(ref).toContain('dromos config check');
      expect(ref).toContain('dromos config schema');
    });

    it('shows the keys dromos init writes, not a hand-written full config', () => {
      const block = /```json\n([\s\S]+?)```/.exec(ref.slice(ref.indexOf('## Runner')))![1];
      expect(JSON.parse(block)).toEqual({
        harness: 'claude',
        test: { full: 'pnpm test' },
        parallel: 3,
      });
      expect(ref).toContain('`harness`, `test.full`');
      expect(ref).toContain('left untouched');
    });
  });

  it('lists exactly the packages the script accepts ($valid)', () => {
    const script = fs.readFileSync(
      path.join(path.dirname(skillPath), 'scripts/Install-HubPackages.ps1'),
      'utf-8',
    );
    const valid = /^\$valid = (.+)$/m
      .exec(script)![1]
      .match(/'([^']+)'/g)!
      .map((x) => x.slice(1, -1));
    const line = /Valid packages: (.+?); anything else/s.exec(text)![1];
    const documented = [...line.matchAll(/`([a-z]+)`/g)].map((m) => m[1]);
    expect(documented).toEqual(valid);
    expect(valid).toContain('statusline');
  });

  it('moved the behavior details into the script help', () => {
    const script = fs.readFileSync(
      path.join(path.dirname(skillPath), 'scripts/Install-HubPackages.ps1'),
      'utf-8',
    );
    const help = script.slice(0, script.indexOf('param('));
    expect(help).toContain('Behavior in detail');
    expect(help.replace(/\s+/g, ' ')).toContain('hardening beyond the original task');
  });
});

describe('upgrade note for v2 installs (#773)', () => {
  const root = path.resolve(__dirname, '../../..');
  const note = fs.readFileSync(
    path.join(root, 'packages/delivery/.apm/skills/apm-install/references/after-install.md'),
    'utf-8',
  );
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');

  it('names both options, the leftover agents and skills and the paths', () => {
    expect(note).toContain('## Upgrading from 2.x');
    expect(note).toContain('`#v2.5.4`');
    expect(note).toContain('apm uninstall -g GravionLabs/apm-hub/packages/agents');
    for (const a of [
      'orchestrator',
      'pbi-runner',
      'implementer',
      'issue-reader',
      'explorer',
      'planner',
      'pr-writer',
      'review-lead',
      'reviewer',
    ]) {
      expect(note).toContain(`\`${a}\``);
    }
    for (const sk of [
      'review-fanout',
      'queue',
      'handoff',
      'orch-pipeline',
      'orch',
      'verify-project',
    ]) {
      expect(note).toContain(`\`${sk}\``);
    }
    expect(note).toContain('~/.claude/agents/<name>.md');
    expect(note).toContain('~/.copilot/agents/<name>.agent.md');
  });

  it('documents what apm cleans itself', () => {
    expect(note).toMatch(/apm\.lock\.yaml/);
    expect(note).toMatch(/Cleaned \d+ files from packages no longer in apm\.yml/);
  });

  it('README points to the upgrade note', () => {
    expect(readme).toContain('## Upgrading from 2.x');
    expect(readme).toContain('references/after-install.md');
    expect(readme).toContain('#v2.5.4');
    for (const n of [
      'verify-project',
      'review-fanout',
      'orch-pipeline',
      'pbi-runner',
      'reviewer',
    ]) {
      expect(readme).toContain(`\`${n}\``);
    }
  });
});
