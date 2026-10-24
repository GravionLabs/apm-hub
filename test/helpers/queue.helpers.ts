import { execFile, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const SCRIPT = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/queue/scripts/Invoke-OrchestratorQueue.ps1'
);
export const INSTALLER = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/queue/scripts/Install-QueueLauncher.ps1'
);
export const AGENT = path.resolve(
  __dirname,
  '../../packages/agents/.apm/agents/orchestrator.agent.md'
);
export const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
export const posix = process.platform !== 'win32';
// Gate-line forms the queue must detect (markdown-wrapped at line start) and must ignore (mid-line, prefixed, wrong case).
export const GATE_ACCEPT = ['Gate: x', '**Gate:** x', '**Gate**: x', '`Gate:` x', '> Gate: x'];
export const GATE_REJECT = ['See Gate: x', 'xGate: x', 'gate: x'];

// Hermetic state dir: a relative DROMOS_STATE_DIR resolves against the cwd of every run, so each test's temp dir keeps its
// own `.agents/` and nothing lands in the real repository's git common dir (spawned children inherit process.env).
process.env.DROMOS_STATE_DIR = '.agents';

if (!hasPwsh && process.env.CI)
  throw new Error(
    'CI is set but pwsh did not start: the queue tests need pwsh and must not be skipped silently in CI'
  );

// HOME points into `home`; every other variable the scripts could read a home or a runner from is removed.
export const isolatedEnv = (
  home: string,
  extra: Record<string, string> = {}
): NodeJS.ProcessEnv => {
  const e: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    QUEUE_POLL_SECONDS: '0',
    ...extra,
  };
  for (const k of [
    'USERPROFILE',
    'XDG_CONFIG_HOME',
    'QUEUE_RUNNER',
    'QUEUE_CALLER_CWD',
    'OPENCODE_PERMISSION',
    'AGENTS_LEDGER',
  ])
    if (!(k in extra)) delete e[k];
  return e;
};

// env: per-case variables set for this case only (a string sets, null removes); restored before the next case.
export type BatchCase = {
  key: string;
  args: string[];
  cwd: string;
  path?: string;
  env?: Record<string, string | null>;
};
export type BatchResult = { status: number; stdout: string; stderr: string };

// Runs all cases in one pwsh process (see queue-batch.ps1); results are in case order.
export const runBatch = (cases: BatchCase[]): BatchResult[] => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-batch-'));
  try {
    const spec = path.join(tmp, 'cases.json');
    const out = path.join(tmp, 'results.json');
    fs.writeFileSync(spec, JSON.stringify(cases));
    const home = path.join(tmp, 'home');
    fs.mkdirSync(home);
    const r = spawnSync(
      'pwsh',
      ['-NoProfile', '-File', path.join(__dirname, 'queue-batch.ps1'), SCRIPT, spec, out],
      {
        encoding: 'utf8',
        env: isolatedEnv(home),
      }
    );
    if (r.status !== 0 || !fs.existsSync(out))
      throw new Error(
        `batch wrapper failed (cases: ${cases.map((c) => c.key).join(', ')}): ${r.stderr}${r.stdout}`
      );
    return JSON.parse(fs.readFileSync(out, 'utf8').replace(/^\uFEFF/, '')) as BatchResult[];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

// Same as runBatch, but asynchronous: the cases are dealt round-robin to `groups` pwsh processes that run concurrently
// (one process per group instead of one per case). For files whose cases are too slow for one sequential process;
// results are in case order. Cases must be independent (own cwd and files), as they are in every batch.
export const runBatchParallel = async (cases: BatchCase[], groups = 6): Promise<BatchResult[]> => {
  const n = Math.max(1, Math.min(groups, cases.length));
  const slots = Array.from({ length: n }, () => [] as number[]);
  cases.forEach((_, i) => slots[i % n].push(i));
  const results = new Array<BatchResult>(cases.length);
  await Promise.all(
    slots.map(async (idx) => {
      const mine = idx.map((i) => cases[i]);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-batch-'));
      try {
        const spec = path.join(tmp, 'cases.json');
        const out = path.join(tmp, 'results.json');
        fs.writeFileSync(spec, JSON.stringify(mine));
        const home = path.join(tmp, 'home');
        fs.mkdirSync(home);
        const failure = await new Promise<string | null>((resolve) => {
          execFile(
            'pwsh',
            ['-NoProfile', '-File', path.join(__dirname, 'queue-batch.ps1'), SCRIPT, spec, out],
            { encoding: 'utf8', env: isolatedEnv(home), maxBuffer: 64 * 1024 * 1024 },
            (err, stdout, stderr) =>
              resolve(err || !fs.existsSync(out) ? `${stderr}${stdout}` : null)
          );
        });
        if (failure !== null)
          throw new Error(
            `batch wrapper failed (cases: ${mine.map((c) => c.key).join(', ')}): ${failure}`
          );
        const parsed = JSON.parse(fs.readFileSync(out, 'utf8').replace(/^﻿/, '')) as BatchResult[];
        idx.forEach((i, j) => (results[i] = parsed[j]));
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    })
  );
  return results;
};

// Per-test helpers of the integration files; dir/bin are the current test's temp dir and fake-binary dir.
export const queueHelpers = (getDir: () => string, getBin: () => string) => {
  const ledger = (n: number, ...lines: string[]) => {
    fs.mkdirSync(path.join(getDir(), '.agents', String(n)), { recursive: true });
    fs.writeFileSync(
      path.join(getDir(), '.agents', String(n), 'progress.md'),
      lines.join('\n') + '\n'
    );
  };
  const readLedger = (n: number) =>
    fs.readFileSync(path.join(getDir(), '.agents', String(n), 'progress.md'), 'utf8');

  const run = (args: string[], withBin = false) => {
    const env = {
      ...process.env,
      QUEUE_POLL_SECONDS: '0',
      PATH: withBin ? `${getBin()}${path.delimiter}${process.env.PATH}` : process.env.PATH,
    };
    return spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], {
      encoding: 'utf8',
      cwd: getDir(),
      env,
    });
  };

  // fake harness: behaviour per issue from a file in dir/actions (complete | gate | none | exit1)
  const fakeClaude = (actions: Record<number, string>) => {
    const dir = getDir();
    fs.mkdirSync(path.join(dir, 'actions'));
    for (const [n, a] of Object.entries(actions)) fs.writeFileSync(path.join(dir, 'actions', n), a);
    const f = path.join(getBin(), 'claude');
    fs.writeFileSync(
      f,
      `#!/bin/sh
n=\${4##* }
echo "$@" >> "${dir}/calls.log"
echo "output for $n"
mkdir -p .agents/$n
case "$(cat "${dir}/actions/$n")" in
  complete) echo "Phase pull-request: complete" >> .agents/$n/progress.md; echo "Ledger complete." >> .agents/$n/progress.md ;;
  gate) echo "Gate: Approve the plan?" >> .agents/$n/progress.md ;;
  exit1) echo "crashed" >&2; exit 1 ;;
esac
exit 0
`,
      { mode: 0o755 }
    );
  };
  const calls = () =>
    fs.existsSync(path.join(getDir(), 'calls.log'))
      ? fs.readFileSync(path.join(getDir(), 'calls.log'), 'utf8').trim().split('\n')
      : [];

  return { ledger, readLedger, run, fakeClaude, calls };
};
