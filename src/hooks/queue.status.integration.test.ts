import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasPwsh, posix, queueHelpers } from './queue.helpers';

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
    expect(run(['-Status', '248'], true).status).toBe(1);
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
});
