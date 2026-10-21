import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasPwsh, posix, runBatchParallel, type BatchCase, type BatchResult } from '../../helpers/queue.helpers';

// The run directory of a queue issue comes from Enter-Checkout.ps1 and is released by Exit-Checkout.ps1 (#465).
// Same batching pattern as queue.mode.integration.test.ts: cases are registered while the file is collected, one beforeAll runs them all.

const gitIn = (cwd: string, ...a: string[]) => {
  const r = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' },
  });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const leaseKey = (p: string) => createHash('sha256').update(p, 'utf8').digest('hex').slice(0, 16);

type Def = { args: string[]; foreignLease?: boolean; gate?: boolean };
type Ctx = { repo: string; state: string; pwdFile: string };

describe.skipIf(!hasPwsh || !posix)('Invoke-OrchestratorQueue.ps1 run directory (checkout lease)', () => {
  let root: string;
  const defs = new Map<string, Def>();
  const C: Record<string, Ctx> = {};
  const R: Record<string, BatchResult> = {};
  const reg = (key: string, def: Def) => defs.set(key, def);
  const leaseFiles = (c: Ctx) => {
    const d = path.join(c.state, 'leases');
    return fs.existsSync(d) ? fs.readdirSync(d).map((n) => JSON.parse(fs.readFileSync(path.join(d, n), 'utf8')) as { issue: number; path: string }) : [];
  };

  reg('alone', { args: ['-Mode', 'implement', '-Base', 'main', '10'] });
  reg('foreign', { args: ['-Mode', 'implement', '-Base', 'main', '10'], foreignLease: true });
  reg('foreignGate', { args: ['-Mode', 'implement', '-Base', 'main', '10'], foreignLease: true, gate: true });
  reg('aloneGate', { args: ['-Mode', 'implement', '-Base', 'main', '10'], gate: true });

  beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'queue-checkout-')));
    const cases: BatchCase[] = [...defs.entries()].map(([key, def], i) => {
      const dir = path.join(root, `c${i}`);
      const repo = path.join(dir, 'repo');
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(repo, { recursive: true });
      fs.mkdirSync(bin);
      gitIn(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
      gitIn(repo, 'init', '-q', '-b', 'main');
      fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
      fs.writeFileSync(path.join(repo, '.gitignore'), '.worktrees/\n.agents/\n');
      gitIn(repo, 'add', '.');
      gitIn(repo, 'commit', '-q', '-m', 'init');
      gitIn(repo, 'remote', 'add', 'origin', path.join(dir, 'origin.git'));
      gitIn(repo, 'push', '-q', '-u', 'origin', 'main');
      const state = path.join(repo, '.agents');
      const pwdFile = path.join(dir, 'pwd');
      C[key] = { repo, state, pwdFile };
      if (def.foreignLease) {
        fs.mkdirSync(path.join(state, 'leases'), { recursive: true });
        const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        fs.writeFileSync(
          path.join(state, 'leases', `${leaseKey(repo)}.json`),
          JSON.stringify({ path: repo, issue: 3, branch: 'feat/3', host: 'other', started: now, heartbeat: now }),
        );
      }
      // fake claude: records its working directory; the state directory arrives absolute through DROMOS_STATE_DIR
      fs.writeFileSync(
        path.join(bin, 'claude'),
        `#!/bin/sh
n=\${4##* }
pwd -P > "${pwdFile}"
mkdir -p "$DROMOS_STATE_DIR/$n"
${def.gate ? 'echo "Gate: Approve the plan?" >> "$DROMOS_STATE_DIR/$n/progress.md"' : 'echo "Ledger complete." >> "$DROMOS_STATE_DIR/$n/progress.md"'}
exit 0
`,
        { mode: 0o755 },
      );
      return { key, args: def.args, cwd: repo, path: `${bin}${path.delimiter}${process.env.PATH}` };
    });
    const results = await runBatchParallel(cases);
    cases.forEach((c, i) => (R[c.key] = results[i]));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it('a sequential run alone works in the main checkout and releases the lease', () => {
    const c = C.alone;
    expect(R.alone.status).toBe(0);
    expect(fs.readFileSync(c.pwdFile, 'utf8').trim()).toBe(c.repo);
    expect(gitIn(c.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feat/10');
    expect(fs.existsSync(path.join(c.repo, '.worktrees'))).toBe(false);
    expect(leaseFiles(c)).toEqual([]);
    expect(fs.readFileSync(path.join(c.state, '10', 'progress.md'), 'utf8')).toContain('Ledger complete.');
  });

  it('with a live foreign lease on the main checkout the run gets .worktrees/<nr>, removed afterwards', () => {
    const c = C.foreign;
    expect(R.foreign.status).toBe(0);
    expect(fs.readFileSync(c.pwdFile, 'utf8').trim()).toBe(path.join(c.repo, '.worktrees', '10'));
    expect(gitIn(c.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(fs.existsSync(path.join(c.repo, '.worktrees', '10'))).toBe(false);
    expect(leaseFiles(c).map((l) => l.issue)).toEqual([3]);
    expect(fs.readFileSync(path.join(c.state, '10', 'progress.md'), 'utf8')).toContain('Ledger complete.');
  });

  it('a gate keeps lease and worktree and prints the path', () => {
    const c = C.foreignGate;
    const wt = path.join(c.repo, '.worktrees', '10');
    expect(R.foreignGate.status).toBe(2);
    expect(fs.existsSync(wt)).toBe(true);
    expect(leaseFiles(c).map((l) => l.issue).sort((a, b) => a - b)).toEqual([3, 10]);
    expect(R.foreignGate.stdout).toContain(wt);
  });

  it('a gate in the main checkout keeps the lease too', () => {
    const c = C.aloneGate;
    expect(R.aloneGate.status).toBe(2);
    expect(leaseFiles(c).map((l) => l.issue)).toEqual([10]);
    expect(R.aloneGate.stdout).toContain(c.repo);
  });
});
