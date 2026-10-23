import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type WorkerResult = { status: number; stdout: string; stderr: string };

// One long-lived pwsh process (pwsh-worker.ps1) that runs `script` in-process once per call. A describe starts it in beforeAll and
// closes it in afterAll, so it pays the pwsh cold start once instead of once per case. Calls run one after another; each gets the
// cwd and the complete environment a spawn would have had (default: process.env), so cases stay as isolated as separate spawns.
// Cases that need a different process (git removed from PATH, stdin, a real exit) stay on spawnSync.
export class PwshWorker {
  private child: ChildProcessWithoutNullStreams;
  private buf = '';
  private waiting: (() => void) | null = null;
  private exited: string | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pwsh-worker-'));
  private n = 0;

  constructor(script: string) {
    this.child = spawn(
      'pwsh',
      ['-NoProfile', '-File', path.join(__dirname, 'pwsh-worker.ps1'), script],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let err = '';
    this.child.stdout.setEncoding('utf8').on('data', (d: string) => {
      this.buf += d;
      this.waiting?.();
    });
    this.child.stderr.setEncoding('utf8').on('data', (d: string) => (err += d));
    this.child.on('exit', (code) => {
      this.exited = `pwsh worker exited (${code}): ${err}${this.buf}`;
      this.waiting?.();
    });
  }

  run(args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv }): Promise<WorkerResult> {
    const next = this.tail.then(() => this.exec(args, opts));
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async exec(
    args: string[],
    opts: { cwd: string; env?: NodeJS.ProcessEnv }
  ): Promise<WorkerResult> {
    if (this.exited) throw new Error(this.exited);
    // a spawned process sees the real path of its cwd (macOS /var -> /private/var); Set-Location would keep the symlink
    const realCwd = fs.realpathSync(opts.cwd);
    const out = path.join(this.tmp, `r${++this.n}.json`);
    const fullEnv = Object.fromEntries(
      Object.entries(opts.env ?? process.env).filter(([, v]) => v !== undefined)
    );
    this.child.stdin.write(
      JSON.stringify({ key: `call-${this.n}`, args, cwd: realCwd, fullEnv, out }) + '\n'
    );
    while (!this.buf.includes('@@done\n')) {
      if (this.exited) throw new Error(this.exited);
      await new Promise<void>((resolve) => (this.waiting = resolve));
    }
    this.waiting = null;
    this.buf = this.buf.slice(this.buf.indexOf('@@done\n') + 7);
    const raw = fs.readFileSync(out, 'utf8').replace(/^﻿/, '');
    fs.rmSync(out, { force: true });
    return JSON.parse(raw) as WorkerResult;
  }

  close(): void {
    this.child.stdin.end();
    this.child.kill();
    fs.rmSync(this.tmp, { recursive: true, force: true });
  }
}
