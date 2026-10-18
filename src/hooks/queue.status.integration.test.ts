import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SCRIPT, hasPwsh, posix, queueHelpers } from './queue.helpers';

describe.skipIf(!hasPwsh || !posix)('Invoke-OrchestratorQueue.ps1 -Status', () => {
  let dir: string;
  let bin: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-status-'));
    bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { run, calls } = queueHelpers(
    () => dir,
    () => bin,
  );
  const statusFile = () => path.join(dir, '.agents', 'status-248.md');
  const fake = (body: string) => fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\necho "$@" >> "${dir}/calls.log"\nmkdir -p .agents\n${body}\n`, { mode: 0o755 });
  const WRITE = 'printf "| #1 | merged |\\n" > .agents/status-248.md; echo "Status: .agents/status-248.md"';

  it('prints the table and exits 0 when the file was written and announced', () => {
    fake(WRITE);
    const r = run(['-Status', '248'], true);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('| #1 | merged |');
    expect(calls()[0]).toContain('-p status 248');
    const log = fs.readFileSync(path.join(dir, '.agents', 'status-248.log'), 'utf8');
    expect(log).toContain('=== exit code 0');
    run(['-Status', '248'], true);
    expect(fs.readFileSync(path.join(dir, '.agents', 'status-248.log'), 'utf8').match(/=== exit code 0/g)).toHaveLength(2);
  });

  it('creates no ledger', () => {
    fake(WRITE);
    run(['-Status', '248'], true);
    expect(fs.existsSync(path.join(dir, '.agents', '248'))).toBe(false);
  });

  it('exits 1 when no file was written', () => {
    fake('echo "Status: .agents/status-248.md"');
    const r = run(['-Status', '248'], true);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('no status file');
  });

  it('exits 1 on a stale file from an earlier run', () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(statusFile(), 'old\n');
    const past = new Date(Date.now() - 3600_000);
    fs.utimesSync(statusFile(), past, past);
    fake('echo "Status: .agents/status-248.md"');
    const r = run(['-Status', '248'], true);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('stale');
    expect(r.stdout).not.toContain('old');
  });

  it('exits 1 without the Status line or on a child failure', () => {
    fake('echo "x" > .agents/status-248.md');
    const noLine = run(['-Status', '248'], true);
    expect(noLine.status).toBe(1);
    expect(noLine.stdout).toContain("no 'Status: .agents/status-248.md' line");
    fake(`${WRITE}; exit 3`);
    const r = run(['-Status', '248'], true);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('exit code 3');
  });

  it('exits 2 on a Gate line and prints it', () => {
    fake('echo "  Gate: Which Feature?"');
    const r = run(['-Status', '248'], true);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('Gate: Which Feature?');
  });

  it('refuses a symlinked status file', () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(path.join(dir, 'target.md'), 'x');
    fs.symlinkSync(path.join(dir, 'target.md'), statusFile());
    fake(WRITE);
    const r = run(['-Status', '248'], true);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlinked');
    expect(calls()).toHaveLength(0);
  });

  it('accepts a markdown-wrapped marker but not another path', () => {
    fake("printf '| #1 | merged |\\n' > .agents/status-248.md; echo '**Status: `.agents/status-248.md`**'");
    expect(run(['-Status', '248'], true).status).toBe(0);
    fake('printf "| #1 | merged |\\n" > .agents/status-248.md; echo "Status: .agents/status-2480.md"');
    expect(run(['-Status', '248'], true).status).toBe(1);
  });

  it('strips escape sequences from the table and the child output', () => {
    fake(`printf '| #1 \\033]0;pwn\\007\\033[31mred\\033[0m |\\n' > .agents/status-248.md; printf 'out \\033[2Jclear\\n'; ${'echo "Status: .agents/status-248.md"'}`);
    const r = run(['-Status', '248'], true);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('| #1 red |');
    expect(r.stdout).toContain('out clear');
    expect(r.stdout).not.toContain('\u001b');
  });

  it('a Gate line wins over a fresh file with the marker', () => {
    fake(`${WRITE}; echo "Gate: pick one"`);
    expect(run(['-Status', '248'], true).status).toBe(2);
  });

  it('exits 1 on a stale file even when the output has the marker', () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(statusFile(), 'old\n');
    const past = new Date(Date.now() - 3600_000);
    fs.utimesSync(statusFile(), past, past);
    fake('echo "Status: .agents/status-248.md"');
    const r = run(['-Status', '248'], true);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('stale');
  });

  it('clears AGENTS_LEDGER for the child and leaves the caller environment alone', () => {
    fake(`${WRITE}; echo "ledger=[$AGENTS_LEDGER]" >> "${dir}/env.log"`);
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Status', '248'], {
      encoding: 'utf8', cwd: dir, env: { ...process.env, QUEUE_POLL_SECONDS: '0', AGENTS_LEDGER: '/x/ledger.md', PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'env.log'), 'utf8').trim()).toBe('ledger=[]');
  });

  it('restores AGENTS_LEDGER in the runner process after the run', () => {
    fake(WRITE);
    const cmd = `$env:AGENTS_LEDGER='/x/ledger.md'; & '${SCRIPT}' -Status 248 | Out-Null; Write-Output "after=$env:AGENTS_LEDGER"`;
    const r = spawnSync('pwsh', ['-NoProfile', '-Command', cmd], { encoding: 'utf8', cwd: dir, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
    expect(r.stdout).toContain('after=/x/ledger.md');
  });

  it('refuses a symlinked log file', () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(path.join(dir, 'target.log'), 'x');
    fs.symlinkSync(path.join(dir, 'target.log'), path.join(dir, '.agents', 'status-248.log'));
    fake(WRITE);
    const r = run(['-Status', '248'], true);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlinked');
    expect(calls()).toHaveLength(0);
  });
});
