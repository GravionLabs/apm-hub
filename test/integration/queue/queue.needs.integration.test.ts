import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  hasPwsh,
  posix,
  runBatchParallel,
  type BatchCase,
  type BatchResult,
} from '../../helpers/queue.helpers';

// Needs sync at the PBI boundaries of the Feature queue (#638): a fake orchestrator announces PBI #11 and completes its ledger,
// a fake Sync-ProjectNeeds.ps1 (NEEDS_SYNC_SCRIPT) records its arguments. Cases run batched, one beforeAll.

type Def = { syncExit?: number; off?: boolean; missing?: boolean };

describe.skipIf(!hasPwsh || !posix)('Invoke-OrchestratorQueue.ps1 Needs sync (#638)', () => {
  let root: string;
  const defs = new Map<string, Def>();
  const dirs: Record<string, string> = {};
  const R: Record<string, BatchResult> = {};
  const reg = (key: string, def: Def) => defs.set(key, def);
  const argsLog = (key: string) => {
    const f = path.join(dirs[key], 'sync-args.log');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean) : [];
  };
  const runLog = (key: string) =>
    fs.readFileSync(path.join(dirs[key], '.agents', '11', 'run.log'), 'utf8');

  reg('ok', {});
  reg('failing', { syncExit: 7 });
  reg('off', { off: true });
  reg('missing', { missing: true });

  beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'queue-needs-')));
    const cases: BatchCase[] = [...defs.entries()].map(([key, def], i) => {
      const dir = path.join(root, `c${i}`);
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin, { recursive: true });
      dirs[key] = dir;
      const sync = path.join(dir, 'Sync-ProjectNeeds.ps1');
      fs.writeFileSync(
        sync,
        `Add-Content -LiteralPath '${path.join(dir, 'sync-args.log')}' -Value ($args -join ' ')\n` +
          `Write-Output 'sync output'\nexit ${def.syncExit ?? 0}\n`
      );
      // iteration 1: PBI 11 with a complete ledger; iteration 2: the Feature is done
      fs.writeFileSync(
        path.join(bin, 'claude'),
        `#!/bin/sh
c=$(cat "${dir}/count" 2>/dev/null || echo 0); c=$((c+1)); echo $c > "${dir}/count"
if [ "$c" = 1 ]; then
  mkdir -p .agents/11; echo "Next PBI: #11 T"; echo "Ledger complete." >> .agents/11/progress.md
else
  echo "Feature #10 is done."
fi
`,
        { mode: 0o755 }
      );
      return {
        key,
        args: ['-Feature', '10'],
        cwd: dir,
        path: `${bin}${path.delimiter}${process.env.PATH}`,
        env: {
          NEEDS_SYNC_SCRIPT: def.missing ? path.join(dir, 'nope.ps1') : sync,
          PROJECT_SYNC_OFF: def.off ? '1' : null,
        },
      };
    });
    const results = await runBatchParallel(cases);
    cases.forEach((c, i) => (R[c.key] = results[i]));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it('calls the sync with -Issue <pbi> -IncludeParents after Next PBI and after the done entry', () => {
    expect(R.ok.status, R.ok.stdout + R.ok.stderr).toBe(0);
    expect(argsLog('ok')).toEqual(['-Issue 11 -IncludeParents', '-Issue 11 -IncludeParents']);
    expect(runLog('ok')).toContain('sync output');
  });

  it('a failing sync leaves the exit code unchanged and is one line in the run log', () => {
    expect(R.failing.status, R.failing.stdout + R.failing.stderr).toBe(0);
    expect(argsLog('failing')).toHaveLength(2);
    expect(runLog('failing')).toContain('Needs sync failed for #11 (exit code 7): sync output');
  });

  it('a missing sync script is logged and never fails the queue', () => {
    expect(R.missing.status, R.missing.stdout + R.missing.stderr).toBe(0);
    expect(runLog('missing')).toContain('Needs sync skipped: Sync-ProjectNeeds.ps1 not found');
  });

  it('PROJECT_SYNC_OFF=1 skips the sync', () => {
    expect(R.off.status, R.off.stdout + R.off.stderr).toBe(0);
    expect(argsLog('off')).toEqual([]);
  });
});
