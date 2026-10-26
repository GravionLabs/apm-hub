import { execFile, spawnSync } from 'child_process';
import { AsyncLocalStorage } from 'async_hooks';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';

const REAL_DETECT = path.resolve(
  __dirname,
  '../../../packages/shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1'
);
const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/delivery/.apm/skills/apm-install/scripts/Install-HubPackages.ps1'
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
  // each run, so every case keeps its own log (a file in its own dir) and nobody writes into the shared bin dir (the apmw
  // case below uses a private copy). The cases are independent (own dir, home and project), so they run concurrently:
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
      { mode: 0o755 }
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
    }
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
  const globalBase = (skills = ['detect-techstack', 'github-issue', 'review-fanout']) =>
    skills.forEach((n) =>
      fs.mkdirSync(path.join(S.home, '.claude/skills', n), { recursive: true })
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
          }
        );
      }
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
    [{ languages: ['go'], frameworks: [] }, []],
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
      '{"dependencies":{"@angular/core":"19.0.0"},"devDependencies":{"typescript":"5.0.0"}}'
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
      `param($ProjectRoot)\nSet-Content '${marker}' x\n'{"languages":["py"],"frameworks":[]}'\n`
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
      'pwsh <skills dir>/detect-techstack/scripts/Enable-Worktrees.ps1',
    ]);
    expect(notes(r)).toContain('Enable-Worktrees.ps1');
    expect(apmCalls()).toEqual([]);
  });

  describe('Enable-Worktrees.ps1 after the install (#445)', () => {
    // fake onboarding script in the home skills dir: records that it ran and prints the JSON the real one prints
    const fakeEnable = (body: string) => {
      const dir = path.dirname(detectDir(S.home));
      fs.writeFileSync(
        path.join(dir, 'Enable-Worktrees.ps1'),
        `param($Root, $TechStack, [switch]$Check)\nSet-Content '${path.join(S.dir, 'enable.ran')}' "$Root|$Check"\n${body}\n`
      );
    };
    const ran = () =>
      fs.existsSync(path.join(S.dir, 'enable.ran'))
        ? fs.readFileSync(path.join(S.dir, 'enable.ran'), 'utf8').trim()
        : null;

    tc('runs it in apply mode after a project install and lists the changed files', async () => {
      fakeApm();
      fakeEnable(
        `'{"root":"x","changed":[".gitignore","biome.json"],"hints":[{"file":"vitest.config","message":"exclude it","snippet":"s"}],"ok":false}'`
      );
      const r = await run(['-Packages', 'ts']);
      expect(r.status).toBe(0);
      expect(ran()).toMatch(/\|False$/);
      expect(r.json.worktrees.changed).toEqual(['.gitignore', 'biome.json']);
      expect(notes(r)).toContain('.gitignore, biome.json');
      expect(notes(r)).toContain('exclude it');
      expect(r.json.commands.at(-1)).toContain('Enable-Worktrees.ps1');
    });

    tc('does not run it on a dry run, with -Global or when nothing was installed', async () => {
      fakeApm();
      fakeEnable(`'{"changed":[],"hints":[],"ok":true}'`);
      await run(['-Packages', 'ts', '-DryRun']);
      await run(['-Packages', 'ts', '-Global']);
      manifest('dependencies:\n  apm:\n    - GravionLabs/apm-hub/packages/ts\n');
      await run(['-Packages', 'ts']);
      expect(ran()).toBeNull();
    });

    tc('a failing script is a note, not a failed install', async () => {
      fakeApm();
      fakeEnable('exit 3');
      const r = await run(['-Packages', 'ts']);
      expect(r.status).toBe(0);
      expect(r.json.installed).toEqual(['ts']);
      expect(notes(r)).toContain('Enable-Worktrees.ps1 failed');
    });

    tc('a missing script is a note', async () => {
      fakeApm();
      const r = await run(['-Packages', 'ts']);
      expect(r.status).toBe(0);
      expect(notes(r)).toContain('Enable-Worktrees.ps1 not found');
    });

    tc(
      'a project-local copy is not run without -TrustProject unless this run installed shared',
      async () => {
        fakeApm();
        const d = path.dirname(detectDir(S.proj));
        fs.writeFileSync(
          path.join(d, 'Enable-Worktrees.ps1'),
          `Set-Content '${path.join(S.dir, 'enable.ran')}' x\n'{"changed":[],"hints":[],"ok":true}'\n`
        );
        await run(['-Packages', 'ts']);
        expect(ran()).toBeNull();
        await run(['-Packages', 'shared']);
        expect(ran()).toBe('x');
      }
    );
  });

  tc('phrases install-only notes as future steps in a dry run', async () => {
    fakeApm();
    const dry = await run(['-Packages', 'core', '-DryRun']);
    expect(notes(dry)).toContain('After install: apmw sanitize -p <client> runs');
    expect(notes(dry)).toContain('After install: OpenCode: copy');
    const real = await run(['-Packages', 'core']);
    expect(notes(real)).not.toContain('After install');
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
        'dependencies:\n  apm:\n    - GravionLabs/apm-hub/packages/py\n    # - GravionLabs/apm-hub/packages/ts\n    - ng@apm-hub\n    - "GravionLabs/apm-hub/packages/dotnet#v1" # pinned\n'
      );
      const r = await run(['-Packages', 'py,ts,ng,dotnet']);
      expect(r.json.skipped).toEqual(['py', 'ng', 'dotnet']);
      expect(r.json.installed).toEqual(['ts']);
    }
  );

  tc('does not treat a longer name or another repository as installed', async () => {
    fakeApm();
    manifest(
      '  apm:\n    - GravionLabs/apm-hub/packages/ts-extra\n    - GravionLabs/apm-hub/packages/tsx\n    - other/repo/packages/py\n'
    );
    const r = await run(['-Packages', 'ts,py']);
    expect(r.json.installed).toEqual(['ts', 'py']);
    expect(r.json.skipped).toEqual([]);
  });

  tc('treats core and all as covering their members', async () => {
    fakeApm();
    manifest('  apm:\n    - GravionLabs/apm-hub/packages/core\n');
    const core = await run(['-Packages', 'shared,hooks,ts']);
    expect(core.json.skipped).toEqual(['shared', 'hooks']);
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
    }
  );

  tc('-Global without -Packages proposes the base packages only, without detection', async () => {
    fakeApm();
    const marker = path.join(S.dir, 'ran');
    fs.writeFileSync(
      detectDir(S.home),
      `param($ProjectRoot)\nSet-Content '${marker}' x\n'{"languages":["ts"],"frameworks":[]}'\n`
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
    const r = await run(['-Packages', 'ng,dotnet,agents', '-DryRun']);
    expect(Object.keys(r.json.provides)).toEqual(['ng', 'dotnet', 'agents']);
    expect(r.json.provides.agents).toContain('orchestrator');
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
    globalBase(['detect-techstack', 'review-fanout']);
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
    }
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
      '  apm:\n    - https://evil.example/GravionLabs/apm-hub/packages/ts\n    - xGravionLabs/apm-hub/packages/py\n'
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

  tc('notes the OpenCode plugin copy for hooks, core and all', async () => {
    fakeApm();
    for (const p of ['hooks', 'core', 'all']) {
      expect(notes(await run(['-Packages', p, '-DryRun']))).toContain('apm-hub-hooks.ts');
    }
    expect(notes(await run(['-Packages', 'ts', '-DryRun']))).not.toContain('apm-hub-hooks.ts');
  });

  tc('warns when apmw is missing and an agent package is selected, without failing', async () => {
    fakeApm();
    // PATH without apmw: bin (fake apm) plus the directory of pwsh only if it holds no apmw
    const lean = fs.mkdtempSync(path.join(S.dir, 'lean-'));
    fs.symlinkSync(pwshPath, path.join(lean, 'pwsh'));
    const own = path.join(S.dir, 'own-bin'); // private copy: this case adds apmw to its bin dir
    fs.mkdirSync(own);
    fs.copyFileSync(path.join(bin, 'apm'), path.join(own, 'apm'));
    const missing = await run(['-Packages', 'agents', '-DryRun'], `${own}:${lean}`);
    expect(missing.status).toBe(0);
    expect(notes(missing)).toContain('apmw not found');
    fs.writeFileSync(path.join(own, 'apmw'), '#!/bin/sh\n', { mode: 0o755 });
    const present = await run(['-Packages', 'agents', '-DryRun'], `${own}:${lean}`);
    expect(notes(present)).not.toContain('apmw not found');
    expect(notes(present)).toContain('apmw sanitize');
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

  tc('-Global uses the -g form and notes apmw sanitize -g for agents', async () => {
    fakeApm();
    const r = await run(['-Packages', 'core', '-Global']);
    expect(apmCalls()).toEqual(['install GravionLabs/apm-hub/packages/core -g']);
    expect(notes(r)).toContain('apmw sanitize -g');
  });

  describe('apmw sanitize after an agent install', () => {
    // private bin per case: the fake apm plus a fake apmw that logs `apmw: <args>` into the same log (exit code per `body`)
    const ownBin = (body = 'exit 0') => {
      const own = path.join(S.dir, 'own-bin');
      fs.mkdirSync(own, { recursive: true });
      fs.copyFileSync(path.join(bin, 'apm'), path.join(own, 'apm'));
      fs.writeFileSync(
        path.join(own, 'apmw'),
        `#!/bin/sh\necho "apmw: $*" >> "$APM_LOG"\n${body}\n`,
        {
          mode: 0o755,
        }
      );
      return `${own}:${process.env.PATH}`;
    };
    const apmwCalls = () => apmCalls().filter((l) => l.startsWith('apmw: '));
    const agentsDir = (root: string, client: string) =>
      fs.mkdirSync(path.join(root, client, 'agents'), { recursive: true });

    tc('runs it for every client with a project agents directory, in order', async () => {
      fakeApm();
      agentsDir(S.proj, '.claude');
      agentsDir(S.proj, '.opencode');
      const r = await run(['-Packages', 'agents'], ownBin());
      expect(r.status).toBe(0);
      expect(apmwCalls()).toEqual(['apmw: sanitize -p claude', 'apmw: sanitize -p opencode']);
      expect(r.json.sanitized).toEqual(['claude', 'opencode']);
      expect(r.json.commands).toContain('apmw sanitize -p claude');
      expect(r.json.commands).not.toContain('apmw sanitize -p copilot');
      expect(notes(r)).toContain('apmw sanitize ran for: claude, opencode');
    });

    tc('uses -g and the home directories under -Global', async () => {
      fakeApm();
      agentsDir(S.home, '.claude');
      agentsDir(S.home, '.copilot');
      agentsDir(S.proj, '.claude'); // project directory must not count under -Global
      const r = await run(['-Packages', 'core', '-Global'], ownBin());
      expect(apmwCalls()).toEqual(['apmw: sanitize -g -p claude', 'apmw: sanitize -g -p copilot']);
      expect(r.json.sanitized).toEqual(['claude', 'copilot']);
    });

    tc('does not run it for packages without agents or when the install failed', async () => {
      fakeApm();
      agentsDir(S.proj, '.claude');
      await run(['-Packages', 'ts,shared'], ownBin());
      expect(apmwCalls()).toEqual([]);
      fakeApm('packages/agents');
      const r = await run(['-Packages', 'agents'], ownBin());
      expect(r.status).toBe(1);
      expect(apmwCalls()).toEqual([]);
    });

    tc('a failing apmw is a note and the install still counts', async () => {
      fakeApm();
      agentsDir(S.proj, '.claude');
      const r = await run(['-Packages', 'agents'], ownBin('exit 2'));
      expect(r.status).toBe(0);
      expect(r.json.installed).toEqual(['agents']);
      expect(r.json.sanitized).toEqual([]);
      expect(notes(r)).toContain('apmw sanitize -p claude failed (exit 2)');
    });

    tc('a missing apmw leaves the agents in the source format and says so', async () => {
      fakeApm();
      agentsDir(S.proj, '.claude');
      const lean = fs.mkdtempSync(path.join(S.dir, 'lean-'));
      fs.symlinkSync(pwshPath, path.join(lean, 'pwsh'));
      const own = path.join(S.dir, 'own-bin');
      fs.mkdirSync(own);
      fs.copyFileSync(path.join(bin, 'apm'), path.join(own, 'apm'));
      const r = await run(['-Packages', 'agents'], `${own}:${lean}`);
      expect(r.status).toBe(0);
      expect(r.json.sanitized).toEqual([]);
      expect(r.json.commands).toContain('apmw sanitize -p claude');
      expect(notes(r)).toContain('apmw not found: the agents are still in the source format');
      expect(notes(r)).toContain('uv tool install apmw');
    });

    tc('without any client agents directory it notes the command to run later', async () => {
      fakeApm();
      const r = await run(['-Packages', 'agents'], ownBin());
      expect(apmwCalls()).toEqual([]);
      expect(notes(r)).toContain('no client agents directory found');
    });

    tc('a dry run lists the three sanitize commands and runs nothing', async () => {
      fakeApm();
      const r = await run(['-Packages', 'agents', '-DryRun'], ownBin());
      expect(apmwCalls()).toEqual([]);
      expect(r.json.commands.filter((c: string) => c.startsWith('apmw '))).toEqual([
        'apmw sanitize -p claude',
        'apmw sanitize -p copilot',
        'apmw sanitize -p opencode',
      ]);
      expect(r.json.sanitized).toEqual([]);
    });
  });
});

describe('apm-install SKILL.md', () => {
  const skillPath = path.resolve(
    __dirname,
    '../../../packages/delivery/.apm/skills/apm-install/SKILL.md'
  );
  const text = fs.readFileSync(skillPath, 'utf-8');
  const fm = parse(text.split(/^---$/m)[1]);

  it('is a gated, user-invocable skill', () => {
    expect(fm.name).toBe('apm-install');
    expect(fm['disable-model-invocation']).toBe(true);
    expect(fm['user-invocable']).toBe(true);
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
});
