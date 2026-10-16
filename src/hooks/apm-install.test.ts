import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';

const REAL_DETECT = path.resolve(
  __dirname,
  '../../packages/shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1',
);
const SCRIPT = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/apm-install/scripts/Install-HubPackages.ps1',
);
const pwshProbe = spawnSync('sh', ['-c', 'command -v pwsh'], { encoding: 'utf8' });
const hasPwsh = pwshProbe.status === 0 && spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
const posix = process.platform !== 'win32';
const pwshPath = pwshProbe.stdout.trim();

it.runIf(!hasPwsh && !!process.env.CI)('has pwsh in CI', () => {
  expect(hasPwsh).toBe(true);
});

describe.skipIf(!hasPwsh || !posix)('Install-HubPackages.ps1', () => {
  let dir: string;
  let home: string;
  let proj: string;
  let bin: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apminst-'));
    home = path.join(dir, 'home');
    proj = path.join(dir, 'proj');
    bin = path.join(dir, 'bin');
    [home, proj, bin].forEach((d) => fs.mkdirSync(d));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const fakeApm = (exitFor = '') =>
    fs.writeFileSync(
      path.join(bin, 'apm'),
      `#!/bin/sh\necho "$@" >> "${dir}/apm.log"\ncase "$*" in *"${exitFor || 'NEVER-MATCH'}"*) exit 1;; esac\n`,
      { mode: 0o755 },
    );
  const apmCalls = () =>
    fs.existsSync(path.join(dir, 'apm.log')) ? fs.readFileSync(path.join(dir, 'apm.log'), 'utf8').trim().split('\n') : [];
  const detectDir = (root: string, client = '.claude/skills') => {
    const d = path.join(root, client, 'detect-techstack/scripts');
    fs.mkdirSync(d, { recursive: true });
    return path.join(d, 'Detect-TechStack.ps1');
  };
  // fake detect emitting the names the real script emits (ts, js, py, dotnet)
  const fakeDetect = (report: object, root = home, client = '.claude/skills') =>
    fs.writeFileSync(detectDir(root, client), `param($ProjectRoot)\n'${JSON.stringify(report)}'\n`);
  const globalBase = () => fs.mkdirSync(path.join(home, '.claude/skills/github-issue'), { recursive: true });
  const manifest = (text: string, root = proj) => fs.writeFileSync(path.join(root, 'apm.yml'), text);

  const run = (args: string[], pathEnv = `${bin}:${process.env.PATH}`) => {
    const r = spawnSync(pwshPath, ['-NoProfile', '-File', SCRIPT, ...args], {
      encoding: 'utf8',
      cwd: proj,
      env: { ...process.env, HOME: home, PATH: pathEnv },
    });
    return { ...r, json: r.stdout.trim().startsWith('{') ? JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))) : null };
  };
  const notes = (r: { json: { notes: string[] } }) => r.json.notes.join(' | ');

  it.each([
    [{ languages: ['ts'], frameworks: [] }, ['ts']],
    [{ languages: ['js'], frameworks: [] }, ['ts']],
    [{ languages: ['py'], frameworks: [] }, ['py']],
    [{ languages: ['dotnet'], frameworks: ['dotnet'] }, ['dotnet']],
    [{ languages: ['ts'], frameworks: ['angular'] }, ['ts', 'ng']],
    [{ languages: ['ts', 'py', 'dotnet'], frameworks: [] }, ['ts', 'py', 'dotnet']],
    [{ languages: ['typescript'], frameworks: [] }, ['ts']],
    [{ languages: ['csharp'], frameworks: [] }, ['dotnet']],
    [{ languages: ['go'], frameworks: [] }, []],
  ])('maps detect report %j to %j', (report, expected) => {
    fakeApm();
    fakeDetect(report);
    globalBase();
    expect(run(['-DryRun']).json.wouldInstall).toEqual(expected);
  });

  it('maps a project through the real Detect-TechStack.ps1', () => {
    fakeApm();
    fs.copyFileSync(REAL_DETECT, detectDir(home));
    fs.writeFileSync(path.join(proj, 'package.json'), '{"dependencies":{"@angular/core":"19.0.0"},"devDependencies":{"typescript":"5.0.0"}}');
    fs.writeFileSync(path.join(proj, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(proj, 'angular.json'), '{}');
    globalBase();
    const r = run(['-DryRun']);
    expect(r.json.wouldInstall).toEqual(expect.arrayContaining(['ts', 'ng']));
  });

  it('adds the base packages unless a global core is present', () => {
    fakeApm();
    fakeDetect({ languages: ['ts'], frameworks: ['angular'] });
    expect(run(['-DryRun']).json.wouldInstall).toEqual(['ts', 'ng', 'shared', 'github', 'delivery']);
    globalBase();
    expect(run(['-DryRun']).json.wouldInstall).toEqual(['ts', 'ng']);
  });

  it('finds detect-techstack under other client directories in HOME', () => {
    fakeApm();
    fakeDetect({ languages: ['py'], frameworks: [] }, home, '.config/opencode/skills');
    globalBase();
    expect(run(['-DryRun']).json.wouldInstall).toEqual(['py']);
  });

  it('does not run a project-local detect-techstack without -TrustProject', () => {
    fakeApm();
    globalBase();
    const marker = path.join(dir, 'ran');
    fs.writeFileSync(detectDir(proj), `param($ProjectRoot)\nSet-Content '${marker}' x\n'{"languages":["py"],"frameworks":[]}'\n`);
    const r = run(['-DryRun']);
    expect(fs.existsSync(marker)).toBe(false);
    expect(r.json.wouldInstall).toEqual([]);
    expect(notes(r)).toContain('-TrustProject');
    expect(run(['-DryRun', '-TrustProject']).json.wouldInstall).toEqual(['py']);
    expect(fs.existsSync(marker)).toBe(true);
  });

  it('prefers the home detect-techstack over a project-local one', () => {
    fakeApm();
    globalBase();
    fakeDetect({ languages: ['py'], frameworks: [] });
    fakeDetect({ languages: ['ts'], frameworks: [] }, proj);
    expect(run(['-DryRun', '-TrustProject']).json.wouldInstall).toEqual(['py']);
  });

  it.each([
    ['exits non-zero', "param($ProjectRoot)\nexit 3\n"],
    ['prints invalid JSON', "param($ProjectRoot)\n'not json'\n"],
    ['throws', "param($ProjectRoot)\nthrow 'boom'\n"],
  ])('falls back to base packages with a note when detect %s', (_n, script) => {
    fakeApm();
    fs.writeFileSync(detectDir(home), script);
    const r = run(['-DryRun']);
    expect(r.status).toBe(0);
    expect(r.json.wouldInstall).toEqual(['shared', 'github', 'delivery']);
    expect(notes(r)).toContain('detect-techstack failed');
    expect(r.stderr).not.toContain('at <ScriptBlock>');
  });

  it('falls back to base packages with a note when detect-techstack is missing', () => {
    fakeApm();
    const r = run(['-DryRun']);
    expect(r.json.wouldInstall).toEqual(['shared', 'github', 'delivery']);
    expect(notes(r)).toContain('detect-techstack not installed');
  });

  it('installs and reports installed (not wouldInstall) without -DryRun', () => {
    fakeApm();
    const r = run(['-Packages', 'ts,py']);
    expect(r.json.installed).toEqual(['ts', 'py']);
    expect(r.json.wouldInstall).toBeUndefined();
    expect(r.json.dryRun).toBe(false);
    expect(apmCalls()).toEqual(['install GravionLabs/apm-hub/packages/ts', 'install GravionLabs/apm-hub/packages/py']);
  });

  it('-DryRun lists the commands, reports wouldInstall, and runs nothing', () => {
    fakeApm();
    const r = run(['-Packages', 'ts,ng', '-DryRun']);
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

  it('phrases install-only notes as future steps in a dry run', () => {
    fakeApm();
    const dry = run(['-Packages', 'core', '-DryRun']);
    expect(notes(dry)).toContain('After install: run apmw sanitize');
    expect(notes(dry)).toContain('After install: OpenCode: copy');
    const real = run(['-Packages', 'core']);
    expect(notes(real)).not.toContain('After install');
  });

  it('skips packages listed in apm.yml, ignoring comments, and accepts the @apm-hub form', () => {
    fakeApm();
    globalBase();
    manifest(
      'dependencies:\n  apm:\n    - GravionLabs/apm-hub/packages/py\n    # - GravionLabs/apm-hub/packages/ts\n    - ng@apm-hub\n    - "GravionLabs/apm-hub/packages/dotnet#v1" # pinned\n',
    );
    const r = run(['-Packages', 'py,ts,ng,dotnet']);
    expect(r.json.skipped).toEqual(['py', 'ng', 'dotnet']);
    expect(r.json.installed).toEqual(['ts']);
  });

  it('does not treat a longer name or another repository as installed', () => {
    fakeApm();
    manifest('  apm:\n    - GravionLabs/apm-hub/packages/ts-extra\n    - GravionLabs/apm-hub/packages/tsx\n    - other/repo/packages/py\n');
    const r = run(['-Packages', 'ts,py']);
    expect(r.json.installed).toEqual(['ts', 'py']);
    expect(r.json.skipped).toEqual([]);
  });

  it('treats core and all as covering their members', () => {
    fakeApm();
    manifest('  apm:\n    - GravionLabs/apm-hub/packages/core\n');
    const core = run(['-Packages', 'shared,hooks,ts']);
    expect(core.json.skipped).toEqual(['shared', 'hooks']);
    expect(core.json.installed).toEqual(['ts']);
    manifest('  apm:\n    - all@apm-hub\n');
    expect(run(['-Packages', 'ts,dotnet']).json.skipped).toEqual(['ts', 'dotnet']);
  });

  it('treats packages present in apm_modules as installed', () => {
    fakeApm();
    fs.mkdirSync(path.join(proj, 'apm_modules/GravionLabs/apm-hub/packages/ts'), { recursive: true });
    const r = run(['-Packages', 'ts,py']);
    expect(r.json.skipped).toEqual(['ts']);
    expect(r.json.installed).toEqual(['py']);
  });

  it('installs without an apm.yml and notes that apm creates it', () => {
    fakeApm();
    const r = run(['-Packages', 'ts']);
    expect(r.status).toBe(0);
    expect(r.json.installed).toEqual(['ts']);
    expect(notes(r)).toContain('apm install creates it');
  });

  it('reads the home manifest and apm_modules for -Global and ignores the project apm.yml', () => {
    fakeApm();
    manifest('  apm:\n    - GravionLabs/apm-hub/packages/py\n');
    fs.mkdirSync(path.join(home, '.apm'));
    manifest('  apm:\n    - GravionLabs/apm-hub/packages/ts\n', path.join(home, '.apm'));
    fs.mkdirSync(path.join(home, '.apm/apm_modules/GravionLabs/apm-hub/packages/ng'), { recursive: true });
    const r = run(['-Packages', 'ts,py,ng', '-Global']);
    expect(r.json.skipped).toEqual(['ts', 'ng']);
    expect(r.json.installed).toEqual(['py']);
    expect(apmCalls()).toEqual(['install GravionLabs/apm-hub/packages/py -g']);
  });

  it('-Global without -Packages proposes the base packages only, without detection', () => {
    fakeApm();
    const marker = path.join(dir, 'ran');
    fs.writeFileSync(detectDir(home), `param($ProjectRoot)\nSet-Content '${marker}' x\n'{"languages":["ts"],"frameworks":[]}'\n`);
    const r = run(['-Global', '-DryRun']);
    expect(r.json.wouldInstall).toEqual(['shared', 'github', 'delivery']);
    expect(r.json.commands[0]).toBe('apm install GravionLabs/apm-hub/packages/shared -g');
    expect(fs.existsSync(marker)).toBe(false);
    globalBase();
    expect(run(['-Global', '-DryRun']).json.wouldInstall).toEqual([]);
  });

  it('reports the failed package and the not-attempted remainder when apm fails', () => {
    fakeApm('packages/py');
    const r = run(['-Packages', 'ts,py,ng,dotnet']);
    expect(r.status).toBe(1);
    expect(r.json.installed).toEqual(['ts']);
    expect(r.json.failed).toBe('py');
    expect(r.json.notAttempted).toEqual(['ng', 'dotnet']);
    expect(notes(r)).toContain('apm install failed for py');
    expect(apmCalls()).toHaveLength(2);
  });

  it('names what was installed and the external dependencies', () => {
    fakeApm();
    const r = run(['-Packages', 'ng,dotnet,agents', '-DryRun']);
    expect(Object.keys(r.json.provides)).toEqual(['ng', 'dotnet', 'agents']);
    expect(r.json.provides.agents).toContain('orchestrator');
    expect(r.json.dependencies).toEqual(['angular/skills (angular-developer)', 'dotnet/skills (dotnet plugin)']);
  });

  it('notes the OpenCode plugin copy for hooks, core and all', () => {
    fakeApm();
    for (const p of ['hooks', 'core', 'all']) {
      expect(notes(run(['-Packages', p, '-DryRun']))).toContain('apm-hub-hooks.ts');
    }
    expect(notes(run(['-Packages', 'ts', '-DryRun']))).not.toContain('apm-hub-hooks.ts');
  });

  it('warns when apmw is missing and an agent package is selected, without failing', () => {
    fakeApm();
    const r = run(['-Packages', 'agents'], `${bin}:${path.dirname(pwshPath)}:/usr/bin:/bin`);
    const hasApmw = spawnSync('sh', ['-c', 'PATH=/usr/bin:/bin command -v apmw']).status === 0;
    expect(r.status).toBe(0);
    if (!hasApmw) expect(notes(r)).toContain('apmw not found');
  });

  it('exits 1 when apm is not on PATH', () => {
    const r = run(['-Packages', 'ts'], dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('apm not found');
  });

  it('rejects an invalid package name', () => {
    fakeApm();
    const r = run(['-Packages', 'nope']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Invalid package');
    expect(apmCalls()).toEqual([]);
  });

  it('-Global uses the -g form and notes apmw sanitize -g for agents', () => {
    fakeApm();
    const r = run(['-Packages', 'core', '-Global']);
    expect(apmCalls()).toEqual(['install GravionLabs/apm-hub/packages/core -g']);
    expect(notes(r)).toContain('apmw sanitize -g');
  });
});

describe('apm-install SKILL.md', () => {
  const skillPath = path.resolve(__dirname, '../../packages/delivery/.apm/skills/apm-install/SKILL.md');
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
