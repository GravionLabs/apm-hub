import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/orch-queue/scripts/Invoke-OrchestratorQueue.ps1',
);
const AGENT = path.resolve(__dirname, '../../packages/agents/.apm/agents/orchestrator.agent.md');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
const posix = process.platform !== 'win32';

if (!hasPwsh && process.env.CI) throw new Error('pwsh is required in CI');

describe.skipIf(!hasPwsh)('Invoke-OrchestratorQueue.ps1', () => {
  let dir: string;
  let bin: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-'));
    bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const ledger = (n: number, ...lines: string[]) => {
    fs.mkdirSync(path.join(dir, '.agents', String(n)), { recursive: true });
    fs.writeFileSync(path.join(dir, '.agents', String(n), 'progress.md'), lines.join('\n') + '\n');
  };
  const readLedger = (n: number) => fs.readFileSync(path.join(dir, '.agents', String(n), 'progress.md'), 'utf8');

  const run = (args: string[], withBin = false) => {
    const env = { ...process.env, PATH: withBin ? `${bin}${path.delimiter}${process.env.PATH}` : process.env.PATH };
    return spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], { encoding: 'utf8', cwd: dir, env });
  };

  // fake harness: behaviour per issue from a file in dir/actions (complete | gate | none | exit1)
  const fakeClaude = (actions: Record<number, string>) => {
    fs.mkdirSync(path.join(dir, 'actions'));
    for (const [n, a] of Object.entries(actions)) fs.writeFileSync(path.join(dir, 'actions', n), a);
    const f = path.join(bin, 'claude');
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
      { mode: 0o755 },
    );
  };
  const calls = () => (fs.existsSync(path.join(dir, 'calls.log')) ? fs.readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n') : []);

  describe('input and dry run', () => {
    it('prints one claude command per positional issue with the default mode full', () => {
      const r = run(['12', '#13', '-DryRun']);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('[dry-run] #12: claude --agent orchestrator -p "full 12" --allowedTools ');
      expect(r.stdout).toContain('-p "full 13"');
      expect(r.stdout).toContain('Bash(git:*)');
      expect(r.stdout).not.toContain('--dangerously-skip-permissions');
    });

    it('forwards -Mode and adds the permission bypass only with -AllowAll', () => {
      const r = run(['5', '-Mode', 'plan', '-AllowAll', '-DryRun']);
      expect(r.stdout).toContain('-p "plan 5"');
      expect(r.stdout).toContain('--dangerously-skip-permissions');
    });

    it('reads issues from -IssueFile, ignoring blank lines and duplicates', () => {
      fs.writeFileSync(path.join(dir, 'q.txt'), '7\n\n#8\n7\n');
      const r = run(['-IssueFile', 'q.txt', '-DryRun']);
      expect(r.status).toBe(0);
      expect(r.stdout.match(/\[dry-run\]/g)).toHaveLength(2);
      expect(r.stdout).toContain('-p "full 7"');
      expect(r.stdout).toContain('-p "full 8"');
    });

    it.skipIf(!posix)('resolves -Label through gh api GET, ascending, without pull requests', () => {
      fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\necho "$@" > "${dir}/gh.args"\nprintf '30\\n4\\n'\n`, { mode: 0o755 });
      const r = run(['-Label', 'queue ready', '-DryRun'], true);
      expect(r.status).toBe(0);
      expect(r.stdout.indexOf('full 4')).toBeLessThan(r.stdout.indexOf('full 30'));
      const args = fs.readFileSync(path.join(dir, 'gh.args'), 'utf8');
      expect(args).toContain('--method GET');
      expect(args).toContain('labels=queue%20ready');
    });

    it('lists an issue with a complete ledger as skipped and starts nothing', () => {
      ledger(12, '# orchestrator ledger', 'Ledger complete.');
      const r = run(['12', '13', '-DryRun']);
      expect(r.stdout).not.toContain('-p "full 12"');
      expect(r.stdout).toContain('-p "full 13"');
      expect(r.stdout).toMatch(/^#12 skipped$/m);
    });

    it('does not skip when Ledger complete. is not the last line', () => {
      ledger(12, 'Ledger complete.', 'Fix round 1: x');
      expect(run(['12', '-DryRun']).stdout).toContain('-p "full 12"');
    });

    it.each([[['abc']], [['0']], [['1;rm']], [[]]])('rejects invalid input %j', (args) => {
      const r = run([...args, '-DryRun']);
      expect(r.status).not.toBe(0);
    });

    it('rejects a bad line in -IssueFile and a missing file', () => {
      fs.writeFileSync(path.join(dir, 'q.txt'), '7\nfoo\n');
      expect(run(['-IssueFile', 'q.txt', '-DryRun']).stderr).toContain('q.txt line 2');
      expect(run(['-IssueFile', 'none.txt', '-DryRun']).status).not.toBe(0);
    });

    it('fails clearly for an unknown harness adapter and an invalid mode', () => {
      expect(run(['1', '-Harness', 'nope', '-DryRun']).stderr).toContain("No adapter for harness 'nope'");
      expect(run(['1', '-Mode', 'next', '-DryRun']).status).not.toBe(0);
    });
  });

  describe.skipIf(!posix)('runs with a fake harness binary', () => {
    it('fails with a clear message when the harness binary is not on PATH', () => {
      const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '1'], {
        encoding: 'utf8', cwd: dir, env: { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + path.dirname(spawnSync('which', ['pwsh'], { encoding: 'utf8' }).stdout.trim()) },
      });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("'claude' not found on PATH");
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

describe('orchestrator agent', () => {
  it('writes Ledger complete. through Add-LedgerLine.ps1 before the final report line', () => {
    const body = fs.readFileSync(AGENT, 'utf8');
    expect(body).toMatch(/append `Ledger complete\.` as the last ledger line via `Add-LedgerLine\.ps1`/);
  });
});
