import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SCRIPT, hasPwsh, posix, queueHelpers } from './queue.helpers';

// Every case spawns pwsh (some several times); the 5 s default flakes on loaded CI runners.
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

describe.skipIf(!hasPwsh)('Invoke-OrchestratorQueue.ps1', () => {
  let dir: string;
  let bin: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-'));
    bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const { ledger, readLedger, run, fakeClaude, calls } = queueHelpers(
    () => dir,
    () => bin,
  );

  describe.skipIf(!posix)('runs with a fake harness binary', () => {
    // PATH containing only a symlink to pwsh: no harness binary, independent of the ambient environment
    const onlyPwshEnv = (only: string) => {
      const home = path.join(dir, 'home');
      fs.mkdirSync(home, { recursive: true });
      const dotnet = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('DOTNET_')));
      return { ...dotnet, PATH: only, HOME: home, TMPDIR: os.tmpdir(), LANG: process.env.LANG ?? 'C.UTF-8', DOTNET_CLI_HOME: home, DOTNET_CLI_TELEMETRY_OPTOUT: '1' } as NodeJS.ProcessEnv;
    };
    const onlyPwsh = (args: string[]) => {
      const real = spawnSync('pwsh', ['-NoProfile', '-Command', '(Get-Command pwsh).Source'], { encoding: 'utf8' }).stdout.trim();
      const only = path.join(dir, 'onlypwsh');
      fs.mkdirSync(only, { recursive: true });
      if (!fs.existsSync(path.join(only, 'pwsh'))) fs.symlinkSync(real, path.join(only, 'pwsh'));
      return spawnSync(path.join(only, 'pwsh'), ['-NoProfile', '-File', SCRIPT, ...args], { encoding: 'utf8', cwd: dir, env: onlyPwshEnv(only) });
    };

    it('fails with a clear message when the harness binary is not on PATH', () => {
      const r = onlyPwsh(['1']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("'claude' not found on PATH");
    });

    it.each(['copilot', 'opencode'])('fails with a clear message when %s is not on PATH', (h) => {
      const r = onlyPwsh(['1', '-Harness', h]);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain(`'${h}' not found on PATH (harness '${h}')`);
    });

    it('passes OPENCODE_PERMISSION to the opencode process only for that run', () => {
      fs.writeFileSync(
        path.join(bin, 'opencode'),
        `#!/bin/sh\necho "$OPENCODE_PERMISSION" > "${dir}/perm.txt"\nmkdir -p .agents/1\necho "Ledger complete." >> .agents/1/progress.md\n`,
        { mode: 0o755 },
      );
      const r = run(['1', '-Harness', 'opencode'], true);
      expect(r.status).toBe(0);
      const perm = JSON.parse(fs.readFileSync(path.join(dir, 'perm.txt'), 'utf8'));
      expect(perm.bash['*']).toBe('deny');
      expect(perm.bash['gh pr merge *']).toBeUndefined();
      expect(perm.edit['.git/**']).toBe('deny');
    });

    it('runs each issue in its own process, logs the output and reports done', () => {
      fakeClaude({ 1: 'complete', 2: 'complete' });
      const r = run(['1', '2'], true);
      expect(r.status).toBe(0);
      expect(calls()).toHaveLength(2);
      expect(r.stdout).toMatch(/^#1 done$/m);
      expect(r.stdout).toMatch(/^#2 done$/m);
      expect(fs.readFileSync(path.join(dir, '.agents/1/run.log'), 'utf8')).toContain('output for 1');
    });

    it('runs again on a ledger without Ledger complete. (resume)', () => {
      ledger(1, '# orchestrator ledger', 'Phase read: complete');
      fakeClaude({ 1: 'complete' });
      const r = run(['1'], true);
      expect(r.status).toBe(0);
      expect(calls()).toHaveLength(1);
    });

    it('ends a resumed run as done with exit 0 and keeps the earlier ledger content', () => {
      ledger(1, '# orchestrator ledger', 'Phase read: complete', 'Gate: old question');
      fakeClaude({ 1: 'complete' });
      const r = run(['1'], true);
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/^#1 done$/m);
      const l = readLedger(1);
      expect(l).toContain('# orchestrator ledger');
      expect(l).toContain('Phase read: complete');
      expect(l.trim().split('\n').pop()).toBe('Ledger complete.');
    });

    it('detects a new gate by count when an old Gate: line is already in the ledger', () => {
      ledger(1, 'Gate: old question');
      fakeClaude({ 1: 'gate' });
      const r = run(['1'], true);
      expect(r.status).toBe(2);
      expect(r.stdout).toMatch(/^#1 gate$/m);
    });

    it('appends stdout, stderr and an exit-code trailer per run to run.log', () => {
      fakeClaude({ 1: 'exit1' });
      run(['1'], true);
      fs.writeFileSync(path.join(dir, 'actions', '1'), 'complete');
      run(['1'], true);
      const log = fs.readFileSync(path.join(dir, '.agents/1/run.log'), 'utf8');
      expect(log).toContain('crashed');
      expect(log).toContain('=== exit code 1');
      expect(log).toContain('output for 1');
      expect(log).toContain('=== exit code 0');
      expect(log.indexOf('=== exit code 1')).toBeLessThan(log.indexOf('=== exit code 0'));
    });

    it('checks the harness binary once up front, before the first issue is looked at', () => {
      ledger(1, 'Ledger complete.');
      const r = onlyPwsh(['1', '2']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("'claude' not found on PATH");
      expect(fs.existsSync(path.join(dir, '.agents/2'))).toBe(false);
    });

    it('refuses a symlinked .agents/ directory', () => {
      fs.mkdirSync(path.join(dir, 'elsewhere'));
      fs.symlinkSync(path.join(dir, 'elsewhere'), path.join(dir, '.agents'));
      fakeClaude({ 1: 'complete' });
      const r = run(['1'], true);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Refusing symlinked path');
      expect(calls()).toHaveLength(0);
    });

    it('refuses a dangling symlinked .agents/ and a symlinked run.log', () => {
      fs.symlinkSync(path.join(dir, 'nowhere'), path.join(dir, '.agents'));
      fakeClaude({ 1: 'complete' });
      expect(run(['1'], true).stderr).toContain('Refusing symlinked path');
      fs.rmSync(path.join(dir, '.agents'));
      fs.mkdirSync(path.join(dir, '.agents/1'), { recursive: true });
      fs.symlinkSync(path.join(dir, 'nowhere.log'), path.join(dir, '.agents/1/run.log'));
      const r = run(['1'], true);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Refusing symlinked path');
      expect(fs.existsSync(path.join(dir, 'nowhere.log'))).toBe(false);
    });

    it('filters -Label issues by author_association only with -TrustedOnly', () => {
      fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\necho "$@" > "${dir}/gh.args"\nprintf '4\\n'\n`, { mode: 0o755 });
      run(['-Label', 'ready', '-DryRun'], true);
      expect(fs.readFileSync(path.join(dir, 'gh.args'), 'utf8')).not.toContain('author_association');
      run(['-Label', 'ready', '-TrustedOnly', '-DryRun'], true);
      const args = fs.readFileSync(path.join(dir, 'gh.args'), 'utf8');
      expect(args).toContain('select(.pull_request | not)');
      expect(args).toContain('author_association | IN("OWNER","MEMBER","COLLABORATOR")');
    });

    it('fails when gh api fails for -Label', () => {
      fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
      const r = run(['-Label', 'ready', '-DryRun'], true);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("gh api failed for label 'ready'");
    });

    it('stops the queue on a gate, prints the question and exits non-zero', () => {
      fakeClaude({ 1: 'gate', 2: 'complete' });
      const r = run(['1', '2'], true);
      expect(r.status).toBe(2);
      expect(r.stdout).toContain('Gate: Approve the plan?');
      expect(calls()).toHaveLength(1);
      expect(r.stdout).toMatch(/^#1 gate$/m);
      expect(r.stdout).toMatch(/^#2 not-run$/m);
      expect(readLedger(1)).not.toContain('Ledger complete.');
    });

    it('does not continue past a gate even with -ContinueOnError', () => {
      fakeClaude({ 1: 'gate', 2: 'complete' });
      const r = run(['1', '2', '-ContinueOnError'], true);
      expect(r.status).toBe(2);
      expect(calls()).toHaveLength(1);
    });

    it('treats a run without Ledger complete. as failed and stops the queue', () => {
      fakeClaude({ 1: 'exit1', 2: 'complete' });
      const r = run(['1', '2'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(1);
      expect(r.stdout).toMatch(/^#1 failed$/m);
      expect(r.stdout).toMatch(/^#2 not-run$/m);
    });

    it('classifies exit code 0 without a complete ledger as failed (ledger wins over exit code)', () => {
      fakeClaude({ 1: 'none' });
      const r = run(['1'], true);
      expect(r.status).toBe(1);
      expect(r.stdout).toMatch(/^#1 failed$/m);
    });

    it('continues after a failure with -ContinueOnError and still exits non-zero', () => {
      fakeClaude({ 1: 'exit1', 2: 'complete' });
      const r = run(['1', '2', '-ContinueOnError'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(2);
      expect(r.stdout).toMatch(/^#1 failed$/m);
      expect(r.stdout).toMatch(/^#2 done$/m);
    });

    it('does not treat an old gate line as a new gate when the resumed run fails', () => {
      ledger(1, 'Gate: old question');
      fakeClaude({ 1: 'none' });
      const r = run(['1'], true);
      expect(r.stdout).toMatch(/^#1 failed$/m);
    });
  });
});
