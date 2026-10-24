import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  GATE_ACCEPT,
  GATE_REJECT,
  SCRIPT,
  hasPwsh,
  posix,
  queueHelpers,
} from '../../helpers/queue.helpers';
import { PwshWorker } from '../../helpers/pwsh-worker';

describe.skipIf(!hasPwsh || !posix)('Invoke-OrchestratorQueue.ps1 -Status', () => {
  let dir: string;
  let bin: string;
  // One pwsh worker for the whole describe runs the script in-process for every case (instead of one pwsh start per case).
  let worker: PwshWorker;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-status-'));
    bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { calls } = queueHelpers(
    () => dir,
    () => bin
  );
  // same environment as queueHelpers().run(args, true): the fake claude of this case first on PATH
  const run = (args: string[]) =>
    worker.run(args, {
      cwd: dir,
      env: {
        ...process.env,
        QUEUE_POLL_SECONDS: '0',
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      },
    });
  const statusFile = () => path.join(dir, '.agents', 'status-248.md');
  const fake = (body: string) =>
    fs.writeFileSync(
      path.join(bin, 'claude'),
      `#!/bin/sh\necho "$@" >> "${dir}/calls.log"\nmkdir -p .agents\n${body}\n`,
      { mode: 0o755 }
    );
  const WRITE =
    'printf "| #1 | merged |\\n" > .agents/status-248.md; echo "Status: .agents/status-248.md"';

  it('prints the table and exits 0 when the file was written and announced', async () => {
    fake(WRITE);
    const r = await run(['-Status', '248']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('| #1 | merged |');
    expect(calls()[0]).toContain('-p status 248');
    const log = fs.readFileSync(path.join(dir, '.agents', 'status-248.log'), 'utf8');
    expect(log).toContain('=== exit code 0');
    await run(['-Status', '248']);
    expect(
      fs.readFileSync(path.join(dir, '.agents', 'status-248.log'), 'utf8').match(/=== exit code 0/g)
    ).toHaveLength(2);
  });

  describe('state dir without DROMOS_STATE_DIR', () => {
    // a git repo, no override: the state dir is <git common dir>/agents and the marker may be absolute
    const runGit = async (args: string[], absolute: boolean) => {
      spawnSync('git', ['init', '-q'], { cwd: dir });
      const sd = path.join(fs.realpathSync(dir), '.git', 'agents');
      const marker = absolute ? sd + '/status-248.md' : 'status-248.md';
      fake(
        `mkdir -p "${sd}"; printf "| #1 | merged |\\n" > "${sd}/status-248.md"; echo "Status: ${marker}"`
      );
      const env = {
        ...process.env,
        QUEUE_POLL_SECONDS: '0',
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      };
      delete env.DROMOS_STATE_DIR;
      return { r: await worker.run(args, { cwd: dir, env }), sd };
    };
    it.each([true, false])(
      'reads the table from .git/agents (absolute marker: %s)',
      async (absolute) => {
        const { r, sd } = await runGit(['-Status', '248'], absolute);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('| #1 | merged |');
        expect(fs.existsSync(path.join(sd, 'status-248.log'))).toBe(true);
        expect(fs.existsSync(path.join(dir, '.agents', 'status-248.md'))).toBe(false);
      }
    );
  });

  it('creates no ledger', async () => {
    fake(WRITE);
    await run(['-Status', '248']);
    expect(fs.existsSync(path.join(dir, '.agents', '248'))).toBe(false);
  });

  it('exits 1 when no file was written', async () => {
    fake('echo "Status: .agents/status-248.md"');
    const r = await run(['-Status', '248']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('no status file');
  });

  it('exits 1 on a stale file from an earlier run', async () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(statusFile(), 'old\n');
    const past = new Date(Date.now() - 3600_000);
    fs.utimesSync(statusFile(), past, past);
    fake('echo "Status: .agents/status-248.md"');
    const r = await run(['-Status', '248']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('stale');
    expect(r.stdout).not.toMatch(/^old$/m);
  });

  it('exits 1 without the Status line or on a child failure', async () => {
    fake('echo "x" > .agents/status-248.md');
    const noLine = await run(['-Status', '248']);
    expect(noLine.status).toBe(1);
    expect(noLine.stdout).toContain("no 'Status: <path>/status-248.md' line");
    fake(`${WRITE}; exit 3`);
    const r = await run(['-Status', '248']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('exit code 3');
  });

  it('exits 2 on a Gate line and prints it', async () => {
    fake('echo "  Gate: Which Feature?"');
    const r = await run(['-Status', '248']);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('Gate: Which Feature?');
  });

  it('refuses a symlinked status file', async () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(path.join(dir, 'target.md'), 'x');
    fs.symlinkSync(path.join(dir, 'target.md'), statusFile());
    fake(WRITE);
    const r = await run(['-Status', '248']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlinked');
    expect(calls()).toHaveLength(0);
  });

  describe('marker line', () => {
    const marker = async (line: string) => {
      fake(`printf '| #1 | merged |\\n' > .agents/status-248.md; printf '%s\\n' '${line}'`);
      return await run(['-Status', '248']);
    };
    it.each([
      'Status: .agents/status-248.md',
      '**Status: `.agents/status-248.md`**',
      '> Status: `.agents/status-248.md`',
      '`Status:` .agents/status-248.md',
      '  - Status: .agents/status-248.md',
      '**Status**: .agents/status-248.md',
      '`Status`: `.agents/status-248.md`',
    ])('accepts %s', async (line) => {
      expect((await marker(line)).status).toBe(0);
    });
    it.each([
      'xStatus: .agents/status-248.md',
      'status: .agents/status-248.md',
      'See Status: .agents/status-248.md',
      'Status: .agents/status-2480.md',
      'Status: .agents/status-248.md.bak',
      'Status: .agents/status-248.mdx',
      'Status: .agents/status-24.md',
      'Status: /elsewhere/status-248.md',
      'Status: ../other/status-248.md',
      'Status: other/status-248.md',
    ])('rejects %s', async (line) => {
      const r = await marker(line);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("no 'Status: <path>/status-248.md' line");
    });
  });

  describe('gate line', () => {
    const gate = async (line: string) => {
      fake(`${WRITE}; printf '%s\\n' '${line}'`);
      return await run(['-Status', '248']);
    };
    it.each(GATE_ACCEPT)('accepts %s: exit 2 and prints the gate', async (line) => {
      const r = await gate(line);
      expect(r.status).toBe(2);
      expect(r.stdout).toContain(`Gate on status #248: ${line}`);
    });
    it.each(GATE_REJECT)('rejects %s: no gate, exit 0 with the table', async (line) => {
      const r = await gate(line);
      expect(r.status).toBe(0);
      expect(r.stdout).not.toContain('Gate on status');
      expect(r.stdout).toContain('| #1 | merged |');
    });
  });

  it('strips escape sequences from the table, the output and the log', async () => {
    const esc = String.raw`C1:\0302\0205 bare:\033Z ST:\033]8;;u\033\\ok osc:\033]0;pwn\007 csi:\033[31mred\033[0m cr:a\rb`;
    fake(
      String.raw`printf '| #1 \033[2Jtable |\n' > .agents/status-248.md; printf '%b\n' '${esc}'; echo "Status: .agents/status-248.md"`
    );
    const r = await run(['-Status', '248']);
    expect(r.status).toBe(0);
    const log = fs.readFileSync(path.join(dir, '.agents', 'status-248.log'), 'utf8');
    for (const text of [r.stdout, log]) {
      expect(text).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/);
      expect(text).toContain('C1: bare: ST:ok osc: csi:red cr:a');
    }
    expect(r.stdout).toContain('| #1 table |');
  });

  it('strips an escape sequence from the printed Gate line', async () => {
    fake(String.raw`printf '**Gate:** \033[31mpick\033[0m one\n'`);
    const r = await run(['-Status', '248']);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('Gate:** pick one');
    expect(r.stdout).not.toContain('\u001b');
  });

  it('a Gate line wins over a fresh file with the marker and prints the question', async () => {
    fake(`${WRITE}; echo "Gate: pick one"`);
    const r = await run(['-Status', '248']);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('Gate on status #248: Gate: pick one');
  });

  it('clears AGENTS_LEDGER for the child and leaves the caller environment alone', async () => {
    fake(`${WRITE}; echo "ledger=[$AGENTS_LEDGER]" >> "${dir}/env.log"`);
    const r = await worker.run(['-Status', '248'], {
      cwd: dir,
      env: {
        ...process.env,
        QUEUE_POLL_SECONDS: '0',
        AGENTS_LEDGER: '/x/ledger.md',
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      },
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'env.log'), 'utf8').trim()).toBe('ledger=[]');
  });

  // Single spawn on purpose: asserts on the environment of the invoking pwsh process itself, which the shared worker would blur.
  it('restores AGENTS_LEDGER in the runner process after the run', () => {
    fake(WRITE);
    const cmd = `$env:AGENTS_LEDGER='/x/ledger.md'; & '${SCRIPT}' -Status 248 | Out-Null; Write-Output "after=$env:AGENTS_LEDGER"`;
    const r = spawnSync('pwsh', ['-NoProfile', '-Command', cmd], {
      encoding: 'utf8',
      cwd: dir,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    });
    expect(r.stdout).toContain('after=/x/ledger.md');
  });

  it('refuses a symlinked log file', async () => {
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(path.join(dir, 'target.log'), 'x');
    fs.symlinkSync(path.join(dir, 'target.log'), path.join(dir, '.agents', 'status-248.log'));
    fake(WRITE);
    const r = await run(['-Status', '248']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlinked');
    expect(calls()).toHaveLength(0);
  });
});
