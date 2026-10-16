import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';
import { countBodyLines } from '../generators/agent-size-validator';

const SCRIPT = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/apm-install/scripts/Install-HubPackages.ps1',
);
const pwshProbe = spawnSync('sh', ['-c', 'command -v pwsh'], { encoding: 'utf8' });
const hasPwsh = pwshProbe.status === 0 && spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
const posix = process.platform !== 'win32';
const pwshPath = pwshProbe.stdout.trim();

if (!hasPwsh && process.env.CI) throw new Error('pwsh is required in CI');

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

  const fakeApm = () =>
    fs.writeFileSync(path.join(bin, 'apm'), `#!/bin/sh\necho "$@" >> "${dir}/apm.log"\n`, { mode: 0o755 });
  const apmCalls = () =>
    fs.existsSync(path.join(dir, 'apm.log')) ? fs.readFileSync(path.join(dir, 'apm.log'), 'utf8').trim().split('\n') : [];
  const fakeDetect = (report: object) => {
    const d = path.join(proj, '.claude/skills/detect-techstack/scripts');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'Detect-TechStack.ps1'), `param($ProjectRoot)\n'${JSON.stringify(report)}'\n`);
  };
  const globalBase = () => fs.mkdirSync(path.join(home, '.claude/skills/github-issue'), { recursive: true });

  const run = (args: string[], pathEnv = `${bin}:${process.env.PATH}`) => {
    const r = spawnSync(pwshPath, ['-NoProfile', '-File', SCRIPT, ...args], {
      encoding: 'utf8',
      cwd: proj,
      env: { ...process.env, HOME: home, PATH: pathEnv },
    });
    return { ...r, json: r.status === 0 ? JSON.parse(r.stdout) : null };
  };
  const ngReport = { languages: ['typescript'], frameworks: ['angular'] };

  it('maps a ts + angular project to ts and ng plus the base packages', () => {
    fakeApm();
    fakeDetect(ngReport);
    const r = run([]);
    expect(r.status).toBe(0);
    expect(r.json.installed).toEqual(['ts', 'ng', 'shared', 'github', 'delivery']);
    expect(apmCalls()).toContain('install GravionLabs/apm-hub/packages/ng');
  });

  it('adds no base packages when the global core is present', () => {
    fakeApm();
    fakeDetect(ngReport);
    globalBase();
    expect(run([]).json.installed).toEqual(['ts', 'ng']);
  });

  it('skips a package already listed in apm.yml', () => {
    fakeApm();
    fakeDetect({ languages: ['python'], frameworks: [] });
    globalBase();
    fs.writeFileSync(path.join(proj, 'apm.yml'), 'dependencies:\n  apm:\n    - GravionLabs/apm-hub/packages/py\n');
    const r = run([]);
    expect(r.json.skipped).toEqual(['py']);
    expect(r.json.installed).toEqual([]);
    expect(apmCalls()).toEqual([]);
  });

  it('does not treat a longer package name as installed', () => {
    fakeApm();
    fs.writeFileSync(path.join(proj, 'apm.yml'), '    - GravionLabs/apm-hub/packages/hooks\n');
    expect(run(['-Packages', 'ts']).json.installed).toEqual(['ts']);
  });

  it('-DryRun lists the commands and runs nothing', () => {
    fakeApm();
    const r = run(['-Packages', 'ts,ng', '-DryRun']);
    expect(r.status).toBe(0);
    expect(r.json.commands).toEqual([
      'apm install GravionLabs/apm-hub/packages/ts',
      'apm install GravionLabs/apm-hub/packages/ng',
    ]);
    expect(apmCalls()).toEqual([]);
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

  it('-Global uses the -g form and notes apmw sanitize for agents', () => {
    fakeApm();
    const r = run(['-Packages', 'core', '-Global']);
    expect(apmCalls()).toEqual(['install GravionLabs/apm-hub/packages/core -g']);
    expect(r.json.notes.join(' ')).toContain('apmw sanitize -g');
  });

  it('notes the OpenCode plugin copy for hooks', () => {
    fakeApm();
    expect(run(['-Packages', 'hooks']).json.notes.join(' ')).toContain('apm-hub-hooks.ts');
  });

  it('falls back to base packages with a note when detect-techstack is missing', () => {
    fakeApm();
    const r = run([]);
    expect(r.json.installed).toEqual(['shared', 'github', 'delivery']);
    expect(r.json.notes.join(' ')).toContain('detect-techstack not installed');
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

  it('documents the slash usage and the dry-run-first confirmation', () => {
    expect(text).toContain('`/apm-install`');
    expect(text).toContain('/apm-install core -g');
    expect(text).toContain('/apm-install dry-run');
    expect(text).toMatch(/confirmation/);
    expect(countBodyLines(text)).toBeLessThanOrEqual(100);
  });

  it('links references that exist', () => {
    const dir = path.dirname(skillPath);
    for (const m of text.matchAll(/\]\((references\/[^)]+)\)/g)) {
      expect(fs.existsSync(path.join(dir, m[1]))).toBe(true);
    }
  });
});
