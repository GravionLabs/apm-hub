import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';
import { PwshWorker } from '../../helpers/pwsh-worker';

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

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

it.runIf(!hasPwsh && !!process.env.CI)('has pwsh in CI', () => {
  expect(hasPwsh).toBe(true);
});

describe.skipIf(!hasPwsh || !posix)('Install-HubPackages.ps1', () => {
  // Shared per describe: one pwsh worker, the fake `apm` in one bin dir and one root for the case fixtures. The fake apm takes
  // its log file and its failure pattern from the environment of each run, so every case keeps its own log.
  let worker: PwshWorker;
  let root: string;
  let bin: string;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'apminst-'));
    bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(
      path.join(bin, 'apm'),
      `#!/bin/sh\necho "$@" >> "$APM_LOG"\necho "apm noise: $*"\ncase "$*" in *"\${APM_FAIL:-NEVER-MATCH}"*) exit 1;; esac\n`,
      { mode: 0o755 },
    );
  });
  afterAll(() => {
    worker.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  // a fresh home and project under the shared root (plain mkdirs; removed with the root in afterAll)
  type Fx = { dir: string; home: string; proj: string; log: string };
  let n = 0;
  const fx = (): Fx => {
    const dir = path.join(root, `c${++n}`);
    const f = {
      dir,
      home: path.join(dir, 'home'),
      proj: path.join(dir, 'proj'),
      log: path.join(dir, 'apm.log'),
    };
    for (const d of [f.home, f.proj]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(f.log, '');
    return f;
  };
  const apmCalls = (f: Fx) => {
    const text = fs.readFileSync(f.log, 'utf8').trim();
    return text ? text.split('\n') : [];
  };
  const detectDir = (base: string, client = '.claude/skills') => {
    const d = path.join(base, client, 'detect-techstack/scripts');
    fs.mkdirSync(d, { recursive: true });
    return path.join(d, 'Detect-TechStack.ps1');
  };
  // fake detect emitting the names the real script emits (ts, js, py, dotnet)
  const fakeDetect = (base: string, report: object, client = '.claude/skills') =>
    fs.writeFileSync(detectDir(base, client), `param($ProjectRoot)\n'${JSON.stringify(report)}'\n`);
  // a fake detect that leaves a marker file when it runs
  const markerDetect = (file: string, marker: string, langs: string[]) =>
    fs.writeFileSync(
      file,
      `param($ProjectRoot)\nSet-Content '${marker}' x\n'${JSON.stringify({ languages: langs, frameworks: [] })}'\n`,
    );
  const globalBase = (f: Fx, skills = ['detect-techstack', 'github-issue', 'planner']) => {
    for (const s of skills)
      fs.mkdirSync(path.join(f.home, '.claude/skills', s), { recursive: true });
  };
  const manifest = (dir: string, text: string) => fs.writeFileSync(path.join(dir, 'apm.yml'), text);
  const env = (f: Fx, fail = '', pathEnv = `${bin}:${process.env.PATH}`) => ({
    ...process.env,
    HOME: f.home,
    PATH: pathEnv,
    APM_LOG: f.log,
    APM_FAIL: fail,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type R = { status: number | null; stdout: string; stderr: string; json: any };
  // stdout must be pure JSON (apm output goes to stderr)
  const withJson = (r: { status: number | null; stdout: string; stderr: string }): R => ({
    ...r,
    json: r.stdout.trim() ? JSON.parse(r.stdout) : null,
  });
  const run = async (f: Fx, args: string[], fail = '') =>
    withJson(await worker.run(args, { cwd: f.proj, env: env(f, fail) }));
  // own process: the script writes its errors and the apm output with [Console]::Error, which the worker cannot capture
  const spawnRun = (f: Fx, args: string[], pathEnv?: string) =>
    withJson(
      spawnSync(pwshPath, ['-NoProfile', '-File', SCRIPT, ...args], {
        encoding: 'utf8',
        cwd: f.proj,
        env: env(f, '', pathEnv),
      }),
    );
  const notes = (r: R) => r.json.notes.join(' | ');

  // detection: one row maps every alias plus the angular framework, one covers the other aliases and an unknown language
  it.each([
    [
      { languages: ['ts', 'js', 'py', 'dotnet', 'rust', 'go'], frameworks: ['angular', 'tauri'] },
      ['ts', 'py', 'dotnet', 'rust', 'go', 'ng'],
    ],
    [{ languages: ['typescript', 'csharp', 'java'], frameworks: [] }, ['ts', 'dotnet']],
  ])('maps detect report %j to %j', async (report, expected) => {
    const f = fx();
    fakeDetect(f.home, report);
    globalBase(f);
    expect((await run(f, ['-DryRun'])).json.wouldInstall).toEqual(expected);
  });

  it('maps a project through the real Detect-TechStack.ps1', async () => {
    const f = fx();
    fs.copyFileSync(REAL_DETECT, detectDir(f.home));
    fs.writeFileSync(
      path.join(f.proj, 'package.json'),
      '{"dependencies":{"@angular/core":"19.0.0"},"devDependencies":{"typescript":"5.0.0"}}',
    );
    fs.writeFileSync(path.join(f.proj, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(f.proj, 'angular.json'), '{}');
    globalBase(f);
    expect((await run(f, ['-DryRun'])).json.wouldInstall).toEqual(['ts', 'ng']);
  });

  it('finds detect-techstack under another client directory and adds the missing base packages', async () => {
    const f = fx();
    // the home detect-techstack proves `shared` is already there
    fakeDetect(f.home, { languages: ['py'], frameworks: [] }, '.config/opencode/skills');
    expect((await run(f, ['-DryRun'])).json.wouldInstall).toEqual(['py', 'github', 'delivery']);
  });

  it('does not run a project-local detect-techstack without -TrustProject', async () => {
    const f = fx();
    globalBase(f);
    const marker = path.join(f.dir, 'ran');
    markerDetect(detectDir(f.proj), marker, ['py']);
    const r = await run(f, ['-DryRun']);
    expect(fs.existsSync(marker)).toBe(false);
    expect(r.json.wouldInstall).toEqual([]);
    expect(notes(r)).toContain('-TrustProject');
    expect((await run(f, ['-DryRun', '-TrustProject'])).json.wouldInstall).toEqual(['py']);
    expect(fs.existsSync(marker)).toBe(true);
  });

  it('prefers the home detect-techstack over a project-local one', async () => {
    const f = fx();
    globalBase(f);
    fakeDetect(f.home, { languages: ['py'], frameworks: [] });
    fakeDetect(f.proj, { languages: ['ts'], frameworks: [] });
    expect((await run(f, ['-DryRun', '-TrustProject'])).json.wouldInstall).toEqual(['py']);
  });

  it.each([
    ['exits non-zero', 'param($ProjectRoot)\nexit 3\n'],
    ['prints invalid JSON', "param($ProjectRoot)\n'not json'\n"],
  ])('falls back to base packages with a note when detect %s', async (_n, script) => {
    const f = fx();
    fs.writeFileSync(detectDir(f.home), script);
    const r = await run(f, ['-DryRun']);
    expect(r.status).toBe(0);
    expect(r.json.wouldInstall).toEqual(['github', 'delivery']);
    expect(notes(r)).toContain('detect-techstack failed');
    expect(r.stderr).not.toContain('at <ScriptBlock>');
  });

  it('falls back to base packages with a note when detect-techstack is missing', async () => {
    const f = fx();
    const r = await run(f, ['-DryRun']);
    expect(r.json.wouldInstall).toEqual(['shared', 'github', 'delivery']);
    expect(notes(r)).toContain('detect-techstack not installed');
  });

  it('installs, reports installed and keeps apm output off stdout', async () => {
    const f = fx();
    const r = spawnRun(f, ['-Packages', 'ts,py']);
    expect(r.status).toBe(0);
    expect(r.json).toMatchObject({
      dryRun: false,
      installed: ['ts', 'py'],
      failed: null,
      notAttempted: [],
    });
    expect(r.json.wouldInstall).toBeUndefined();
    expect(apmCalls(f)).toEqual([
      'install GravionLabs/apm-hub/packages/ts',
      'install GravionLabs/apm-hub/packages/py',
    ]);
    expect(notes(r)).toContain('apm install creates it');
    expect(r.stdout).not.toContain('apm noise');
    expect(r.stderr).toContain('apm noise');
  });

  it('-DryRun trims -Packages, lists commands, provides and dependencies and runs nothing', async () => {
    const f = fx();
    const r = await run(f, ['-Packages', ' ng, dotnet,,', '-DryRun']);
    expect(r.status).toBe(0);
    expect(r.json.dryRun).toBe(true);
    expect(r.json.installed).toBeUndefined();
    expect(r.json.wouldInstall).toEqual(['ng', 'dotnet']);
    expect(r.json.commands).toEqual([
      'apm install GravionLabs/apm-hub/packages/ng',
      'apm install GravionLabs/apm-hub/packages/dotnet',
    ]);
    expect(Object.keys(r.json.provides)).toEqual(['ng', 'dotnet']);
    expect(r.json.provides.ng).toContain('ng-implementation');
    expect(r.json.dependencies).toEqual([
      'angular/skills (angular-developer)',
      'dotnet/skills (dotnet plugin)',
    ]);
    expect(apmCalls(f)).toEqual([]);
    expect((await run(f, ['-Packages', 'ts', '-DryRun'])).json.dependencies).toEqual([]);
  });

  it('does not install members next to a requested core or all', async () => {
    const f = fx();
    const core = await run(f, ['-Packages', 'core,shared,ts', '-DryRun']);
    expect(core.json.wouldInstall).toEqual(['core', 'ts']);
    expect(notes(core)).toContain('shared is covered by core');
    const all = await run(f, ['-Packages', 'ts,all,core,rust', '-DryRun']);
    expect(all.json.wouldInstall).toEqual(['all']);
    expect(notes(all)).toContain('rust is covered by all');
    expect(all.json.dependencies.sort()).toEqual([
      'angular/skills (angular-developer)',
      'dotnet/skills (dotnet plugin)',
    ]);
  });

  it('recognises every manifest form, ignores comments and does not match look-alikes', async () => {
    const f = fx();
    manifest(
      f.proj,
      [
        'dependencies:',
        '  apm:',
        '    - GravionLabs/apm-hub/packages/py',
        '    # - GravionLabs/apm-hub/packages/ts',
        '    - ng@apm-hub',
        '    - "GravionLabs/apm-hub/packages/dotnet#v1" # pinned',
        '    - https://github.com/GravionLabs/apm-hub/packages/rust.git',
        '    - git@github.com:GravionLabs/apm-hub/packages/go/',
        '    - GravionLabs/apm-hub/packages/statusline.git#v1',
        '    - GravionLabs/apm-hub/packages/ts-extra',
        '    - GravionLabs/apm-hub/packages/tsx',
        '    - other/repo/packages/shared',
        '    - https://evil.example/GravionLabs/apm-hub/packages/github',
        '    - xGravionLabs/apm-hub/packages/delivery',
        '',
      ].join('\n'),
    );
    const r = await run(f, [
      '-Packages',
      'py,ng,dotnet,rust,go,statusline,ts,shared,github,delivery',
      '-DryRun',
    ]);
    expect(r.json.skipped).toEqual(['py', 'ng', 'dotnet', 'rust', 'go', 'statusline']);
    expect(r.json.wouldInstall).toEqual(['ts', 'shared', 'github', 'delivery']);
  });

  it('treats apm_modules entries and an installed core or all as covering their members', async () => {
    const f = fx();
    manifest(f.proj, '  apm:\n    - GravionLabs/apm-hub/packages/core\n');
    fs.mkdirSync(path.join(f.proj, 'apm_modules/GravionLabs/apm-hub/packages/ts'), {
      recursive: true,
    });
    const core = await run(f, ['-Packages', 'shared,statusline,ts,py', '-DryRun']);
    expect(core.json.skipped).toEqual(['shared', 'statusline', 'ts']);
    expect(core.json.wouldInstall).toEqual(['py']);
    manifest(f.proj, '  apm:\n    - all@apm-hub\n');
    expect((await run(f, ['-Packages', 'py,dotnet', '-DryRun'])).json.skipped).toEqual([
      'py',
      'dotnet',
    ]);
  });

  it.each([
    ['node_modules\n.agents\n', true],
    ['.agents/*\n!.agents/config.json\n', false],
    ['.agents/skills/\n', false],
  ])('gitignore %j: notice about .agents/config.json is %s', async (gi, expected) => {
    const f = fx();
    fs.writeFileSync(path.join(f.proj, '.gitignore'), gi);
    const r = await run(f, ['-Packages', 'ts', '-DryRun']);
    expect(r.status).toBe(0);
    if (expected) {
      expect(notes(r)).toContain('!.agents/config.json');
      expect(notes(r)).toContain('.agents/*');
    } else {
      expect(notes(r)).not.toContain('.agents/config.json');
    }
  });

  it('-Global reads the home manifest and apm_modules, ignores the project apm.yml and uses -g', async () => {
    const f = fx();
    manifest(f.proj, '  apm:\n    - GravionLabs/apm-hub/packages/py\n');
    fs.mkdirSync(path.join(f.home, '.apm/apm_modules/GravionLabs/apm-hub/packages/ng'), {
      recursive: true,
    });
    manifest(path.join(f.home, '.apm'), '  apm:\n    - GravionLabs/apm-hub/packages/ts\n');
    const r = await run(f, ['-Packages', 'ts,py,ng', '-Global']);
    expect(r.json.skipped).toEqual(['ts', 'ng']);
    expect(r.json.installed).toEqual(['py']);
    expect(apmCalls(f)).toEqual(['install GravionLabs/apm-hub/packages/py -g']);
  });

  it('-Global without -Packages proposes only the missing base packages, without detection', async () => {
    const f = fx();
    globalBase(f, ['github-issue']);
    const r = await run(f, ['-Global', '-DryRun']);
    expect(r.json.wouldInstall).toEqual(['shared', 'delivery']);
    expect(r.json.commands[0]).toBe('apm install GravionLabs/apm-hub/packages/shared -g');
    const marker = path.join(f.dir, 'ran');
    markerDetect(detectDir(f.home), marker, ['ts']);
    globalBase(f, ['planner']);
    const none = await run(f, ['-Global', '-DryRun']);
    expect(none.json.wouldInstall).toEqual([]);
    expect(notes(none)).toContain('already installed globally');
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('reports the failed package, skips installed ones and leaves the rest not attempted', async () => {
    const f = fx();
    manifest(f.proj, '  apm:\n    - GravionLabs/apm-hub/packages/dotnet\n');
    const r = await run(f, ['-Packages', 'ts,py,dotnet,ng'], 'packages/py');
    expect(r.status).toBe(1);
    expect(r.json.installed).toEqual(['ts']);
    expect(r.json.failed).toBe('py');
    expect(r.json.skipped).toEqual(['dotnet']);
    expect(r.json.notAttempted).toEqual(['ng']);
    expect(notes(r)).toContain('apm install failed for py');
    expect(apmCalls(f)).toHaveLength(2);
  });

  it('appends -Ref to the package spec', async () => {
    const f = fx();
    const r = await run(f, ['-Packages', 'ts', '-Ref', 'v2.3.0']);
    expect(r.json.commands).toEqual(['apm install GravionLabs/apm-hub/packages/ts#v2.3.0']);
    expect(apmCalls(f)).toEqual(['install GravionLabs/apm-hub/packages/ts#v2.3.0']);
  });

  it.each([
    ['an empty -Packages list', ['-Packages', ' , '], '-Packages is empty'],
    ['an invalid package name', ['-Packages', 'nope'], 'Invalid package'],
    ['an unsafe -Ref', ['-Packages', 'ts', '-Ref', 'x; rm -rf /'], 'Invalid -Ref'],
    ['apm missing from PATH', ['-Packages', 'ts'], 'apm not found', true],
  ])('exits 1 for %s', (_n, args, message, noApm = false) => {
    const f = fx();
    const r = spawnRun(f, args as string[], noApm ? f.dir : undefined);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(message);
    expect(apmCalls(f)).toEqual([]);
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

  describe('dromos removal (#828)', () => {
    const ref = fs.readFileSync(
      path.join(path.dirname(skillPath), 'references/after-install.md'),
      'utf8',
    );

    it('runs no dromos step and writes no .dromos/config.json', () => {
      expect(text).not.toMatch(/dromos/i);
      expect(text.split('\n').some((l) => l.startsWith('5. '))).toBe(false);
    });

    it('after-install.md names decision 004 and points to deliver', () => {
      expect(ref).toContain('decision 004');
      expect(ref).toContain('/deliver <nr>');
      expect(ref).not.toContain('dromos init');
      expect(ref).not.toContain('dromos config');
    });

    it('after-install.md proposes the deliver allowlist per harness (#862)', () => {
      for (const f of [
        '`.claude/settings.json` (`permissions.allow`)',
        '`opencode.json` (`permission.bash`)',
        "`--allow-tool 'shell(…)'`",
        "verify commands of the repository's `AGENTS.md`",
        '`permissions.md` in the references of the `deliver` skill',
      ])
        expect(ref).toContain(f);
      expect(text).toContain('allowlist file of the harness');
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
