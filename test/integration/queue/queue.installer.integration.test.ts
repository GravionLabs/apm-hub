import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { INSTALLER, SCRIPT, hasPwsh, posix } from '../../helpers/queue.helpers';

describe.skipIf(!hasPwsh || !posix)('Install-QueueLauncher.ps1', () => {
  let tmp: string;
  let home: string;
  let target: string;
  let launcher: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qlaunch-'));
    home = path.join(tmp, 'home');
    target = path.join(tmp, 'bin');
    launcher = path.join(target, 'queue');
    fs.mkdirSync(home);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  // HOME points into tmp; every other variable the launcher or installer could read a home from is removed
  const env = (extra: Record<string, string> = {}) => {
    const e: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      ...extra,
    };
    for (const k of ['USERPROFILE', 'XDG_CONFIG_HOME', 'QUEUE_RUNNER', 'QUEUE_CALLER_CWD'])
      if (!(k in extra)) delete e[k];
    return e;
  };
  const install = (...args: string[]) =>
    spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Dir', target, ...args], {
      encoding: 'utf8',
      cwd: tmp,
      env: env(),
    });

  it('installs an executable launcher with the marker and a PATH hint', () => {
    const r = install();
    expect(r.status).toBe(0);
    expect(fs.statSync(launcher).mode & 0o111).not.toBe(0);
    const body = fs.readFileSync(launcher, 'utf8');
    expect(body.startsWith('#!/bin/sh\n# apm-hub queue launcher\n')).toBe(true);
    expect(r.stdout).toContain('is not on PATH');
  });

  it('is idempotent', () => {
    install();
    const before = fs.readFileSync(launcher, 'utf8');
    const r = install();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Up to date');
    expect(fs.readFileSync(launcher, 'utf8')).toBe(before);
  });

  it('prints no PATH hint when -Dir is on PATH', () => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Dir', target], {
      encoding: 'utf8',
      cwd: tmp,
      env: env({ PATH: `${target}${path.delimiter}${process.env.PATH}` }),
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Installed');
    expect(r.stdout).not.toContain('not on PATH');
  });

  it('expands a leading ~ in -Dir to HOME', () => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Dir', '~/mybin'], {
      encoding: 'utf8',
      cwd: tmp,
      env: env(),
    });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(home, 'mybin', 'queue'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '~'))).toBe(false);
  });

  it('refuses a foreign file and overwrites it with -Force', () => {
    fs.mkdirSync(target);
    fs.writeFileSync(launcher, '#!/bin/sh\necho mine\n');
    const r = install();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('-Force');
    expect(fs.readFileSync(launcher, 'utf8')).toContain('echo mine');
    expect(install('-Force').status).toBe(0);
    expect(fs.readFileSync(launcher, 'utf8')).toContain('apm-hub queue launcher');
  });

  it('needs -Force for a different older launcher', () => {
    fs.mkdirSync(target);
    fs.writeFileSync(launcher, '#!/bin/sh\n# apm-hub queue launcher\necho old\n');
    expect(install().status).not.toBe(0);
    expect(install('-Force').status).toBe(0);
    expect(fs.readFileSync(launcher, 'utf8')).not.toContain('echo old');
  });

  it('does not follow a symlinked launcher', () => {
    fs.mkdirSync(target);
    const real = path.join(tmp, 'real');
    fs.writeFileSync(real, 'x');
    fs.symlinkSync(real, launcher);
    const r = install('-Force');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlink');
    expect(fs.readFileSync(real, 'utf8')).toBe('x');
  });

  it('-Uninstall removes only our launcher', () => {
    install();
    expect(install('-Uninstall').status).toBe(0);
    expect(fs.existsSync(launcher)).toBe(false);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(launcher, '#!/bin/sh\necho mine\n');
    const r = install('-Uninstall');
    expect(r.status).toBe(0);
    expect(fs.readFileSync(launcher, 'utf8')).toContain('echo mine');
  });

  it('-WhatIf writes nothing', () => {
    const r = install('-WhatIf');
    expect(r.status).toBe(0);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('-Uninstall -WhatIf keeps our launcher', () => {
    install();
    expect(install('-Uninstall', '-WhatIf').status).toBe(0);
    expect(fs.existsSync(launcher)).toBe(true);
  });

  it('-Force -WhatIf leaves a foreign file untouched', () => {
    fs.mkdirSync(target);
    fs.writeFileSync(launcher, '#!/bin/sh\necho mine\n');
    expect(install('-Force', '-WhatIf').status).toBe(0);
    expect(fs.readFileSync(launcher, 'utf8')).toBe('#!/bin/sh\necho mine\n');
  });

  describe('the installed launcher', () => {
    let repo: string;
    const runner = (base: string, tag: string) => {
      const dir = path.join(base, 'skills', 'queue', 'scripts');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'Invoke-OrchestratorQueue.ps1'),
        `Write-Output "${tag} $($args -join '|') $((Get-Location).Path)"\n`
      );
    };
    const call = (cwd: string, ...args: string[]) =>
      spawnSync(launcher, args, { encoding: 'utf8', cwd, env: env() });
    beforeEach(() => {
      install();
      repo = path.join(tmp, 'repo');
      fs.mkdirSync(path.join(repo, 'sub'), { recursive: true });
      spawnSync('git', ['init', '-q'], { cwd: repo });
      repo = fs.realpathSync(repo);
    });

    it('runs the project runner from the git toplevel and passes args', () => {
      runner(path.join(repo, '.claude'), 'project');
      runner(path.join(home, '.claude'), 'global');
      const r = call(path.join(repo, 'sub'), '-DryRun', '-Mode', 'full', '12');
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe(`project -DryRun|-Mode|full|12 ${repo}`);
    });

    const lookup = (): [string, () => string][] => [
      ['project .claude', () => path.join(repo, '.claude')],
      ['project .opencode', () => path.join(repo, '.opencode')],
      ['project .agents', () => path.join(repo, '.agents')],
      ['project .github', () => path.join(repo, '.github')],
      ['global .claude', () => path.join(home, '.claude')],
      ['global .agents', () => path.join(home, '.agents')],
      ['global opencode', () => path.join(home, '.config', 'opencode')],
    ];
    it.each([0, 1, 2, 3, 4, 5, 6])(
      'lookup dir %i wins over every later one and is used alone when it is the only one',
      (i) => {
        const dirs = lookup();
        const alone = call(repo, '1');
        expect(alone.status).toBe(1);
        for (let k = dirs.length - 1; k >= i; k--)
          runner(dirs[k][1](), dirs[k][0].replace(/ /g, '_'));
        expect(call(repo, '1').stdout.trim()).toBe(`${dirs[i][0].replace(/ /g, '_')} 1 ${repo}`);
      }
    );

    it('announces a project-local runner on stderr, a global one silently', () => {
      runner(path.join(home, '.claude'), 'global');
      expect(call(repo, '1').stderr).not.toContain('project-local');
      runner(path.join(repo, '.claude'), 'project');
      expect(call(repo, '1').stderr).toContain(
        `queue: using project-local runner ${repo}/.claude/skills/queue/scripts/Invoke-OrchestratorQueue.ps1`
      );
    });

    it('QUEUE_RUNNER wins over every lookup dir and is not announced as project-local', () => {
      runner(path.join(repo, '.claude'), 'project');
      runner(path.join(tmp, 'custom'), 'custom');
      const custom = path.join(
        tmp,
        'custom',
        'skills',
        'queue',
        'scripts',
        'Invoke-OrchestratorQueue.ps1'
      );
      const r = spawnSync(launcher, ['7'], {
        encoding: 'utf8',
        cwd: repo,
        env: env({ QUEUE_RUNNER: custom }),
      });
      expect(r.stdout.trim()).toBe(`custom 7 ${repo}`);
      expect(r.stderr).not.toContain('project-local');
    });

    it('fails when QUEUE_RUNNER is not a file, without falling back', () => {
      runner(path.join(repo, '.claude'), 'project');
      const r = spawnSync(launcher, [], {
        encoding: 'utf8',
        cwd: repo,
        env: env({ QUEUE_RUNNER: path.join(tmp, 'nope.ps1') }),
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('QUEUE_RUNNER is not a file');
      expect(r.stdout).toBe('');
    });

    it('resolves a relative -IssueFile against the caller directory, not the git toplevel', () => {
      fs.writeFileSync(path.join(repo, 'sub', 'q.txt'), '7\n#8\n');
      const r = spawnSync(launcher, ['-IssueFile', 'q.txt', '-DryRun'], {
        encoding: 'utf8',
        cwd: path.join(repo, 'sub'),
        env: env({ QUEUE_RUNNER: SCRIPT }),
      });
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('-p "full 7"');
      expect(r.stdout).toContain('-p "full 8"');
    });

    it('errors when no runner is installed', () => {
      const r = call(repo);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('not found');
    });

    it('errors outside a git repository', () => {
      runner(path.join(home, '.claude'), 'global');
      const outside = path.join(tmp, 'plain');
      fs.mkdirSync(outside);
      const r = spawnSync(launcher, [], {
        encoding: 'utf8',
        cwd: outside,
        env: { ...env(), GIT_CEILING_DIRECTORIES: tmp },
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('not inside a git repository');
    });
  });
});
