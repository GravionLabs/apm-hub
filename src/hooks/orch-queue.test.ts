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

    it('prints the narrow Copilot command, quoted for the shell, and --allow-all-tools only with -AllowAll', () => {
      const narrow = run(['12', '-Harness', 'copilot', '-DryRun']).stdout;
      expect(narrow).toContain('[dry-run] #12: copilot -p "full 12" --agent=orchestrator --no-ask-user --allow-tool=write ');
      expect(narrow).toContain('"--allow-tool=shell(git:*)"');
      expect(narrow).toContain('"--allow-tool=shell(gh:*)"');
      expect(narrow).not.toContain('--allow-all-tools');
      const all = run(['12', '-Harness', 'copilot', '-Mode', 'plan', '-AllowAll', '-DryRun']);
      expect(all.status).toBe(0);
      expect(all.stdout).toContain('[dry-run] #12: copilot -p "plan 12" --agent=orchestrator --no-ask-user --allow-all-tools\n');
      expect(all.stdout).not.toContain('--allow-tool');
    });

    it('prints the narrow OpenCode command with OPENCODE_PERMISSION, and --auto without it with -AllowAll', () => {
      const narrow = run(['12', '-Harness', 'opencode', '-DryRun']).stdout;
      expect(narrow).toContain('[dry-run] #12: OPENCODE_PERMISSION=');
      expect(narrow).toContain('opencode run --agent orchestrator "full 12"');
      expect(narrow).toContain('\\"git *\\":\\"allow\\"');
      expect(narrow).toContain('\\"*\\":\\"deny\\"');
      expect(narrow).not.toContain('--auto');
      const all = run(['12', '-Harness', 'opencode', '-Mode', 'implement', '-AllowAll', '-DryRun']);
      expect(all.status).toBe(0);
      expect(all.stdout).toContain('[dry-run] #12: opencode run --agent orchestrator --auto "implement 12"\n');
      expect(all.stdout).not.toContain('OPENCODE_PERMISSION');
    });

    it.each(['copilot', 'opencode'])('does not report "No adapter" for %s', (h) => {
      const r = run(['1', '-Harness', h, '-DryRun']);
      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain('No adapter');
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

    it.each(['copilot', 'opencode'])('fails with a clear message when %s is not on PATH', (h) => {
      const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '1', '-Harness', h], {
        encoding: 'utf8', cwd: dir, env: { ...process.env, PATH: path.dirname(spawnSync('which', ['pwsh'], { encoding: 'utf8' }).stdout.trim()) },
      });
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
      expect(JSON.parse(fs.readFileSync(path.join(dir, 'perm.txt'), 'utf8')).bash['*']).toBe('deny');
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

  describe.skipIf(!posix)('Feature and Epic queue mode', () => {
    // fake claude: iteration k runs steps/<k> (a sh script); records AGENTS_LEDGER and args per call
    const fakeQueue = (steps: string[]) => {
      fs.mkdirSync(path.join(dir, 'steps'));
      steps.forEach((body, i) => fs.writeFileSync(path.join(dir, 'steps', String(i + 1)), body));
      fs.writeFileSync(
        path.join(bin, 'claude'),
        `#!/bin/sh
c=$(cat "${dir}/count" 2>/dev/null || echo 0); c=$((c+1)); echo $c > "${dir}/count"
echo "$@" >> "${dir}/calls.log"
echo "[$c] \${AGENTS_LEDGER:-unset}" >> "${dir}/env.log"
sh "${dir}/steps/$c"
`,
        { mode: 0o755 },
      );
    };
    const pbiRun = (n: number, extra = '') =>
      `mkdir -p .agents/${n}; echo "Next PBI: #${n} Title ${n}"; echo "Ledger complete." >> .agents/${n}/progress.md; ${extra}`;
    const doneStep = 'echo "Feature #10 is done."; echo "Ledger complete. Start the next issue in a new session."';
    const queue = (nr = 10) => JSON.parse(fs.readFileSync(path.join(dir, '.agents', `queue-${nr}.json`), 'utf8'));
    const ghFake = (verdict = '{"state":"OPEN","baseRefName":"release/next","headRefName":"feat/1-x"}') =>
      fs.writeFileSync(
        path.join(bin, 'gh'),
        `#!/bin/sh\necho "$@" >> "${dir}/gh.log"\ncase "$1 $2" in "pr view") echo '${verdict}';; esac\nexit 0\n`,
        { mode: 0o755 },
      );
    const ghCalls = () => (fs.existsSync(path.join(dir, 'gh.log')) ? fs.readFileSync(path.join(dir, 'gh.log'), 'utf8') : '');

    it('dry run prints one next command and writes nothing', () => {
      const r = run(['-Feature', '10', '-DryRun']);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('[dry-run] Feature #10: claude --agent orchestrator -p "next 10" --allowedTools ');
      expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
      expect(run(['-Epic', '#11', '-Harness', 'copilot', '-DryRun']).stdout).toContain('copilot -p "next 11"');
    });

    it('rejects -Feature with -Epic or issue numbers', () => {
      expect(run(['-Feature', '1', '-Epic', '2', '-DryRun']).status).not.toBe(0);
      expect(run(['5', '-Feature', '1', '-DryRun']).status).not.toBe(0);
    });

    it('loops in fresh processes until the Feature is done and writes the queue json', () => {
      fakeQueue([pbiRun(11, 'echo "PR #101 opened"'), pbiRun(12), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(calls()).toHaveLength(3);
      expect(calls()[0]).toContain('-p next 10');
      const q = queue();
      expect(q.state).toBe('done');
      expect(q.exitCode).toBe(0);
      expect(q.pbis.map((p: { number: number; outcome: string }) => [p.number, p.outcome])).toEqual([[11, 'done'], [12, 'done']]);
      expect(q.pbis[0].pr).toBe(101);
      expect(q.pbis[0].ledger).toBe('.agents/11/progress.md');
      expect(q.started).toBeTruthy();
      expect(q.pbis[0].ended).toBeTruthy();
      expect(r.stdout).toContain('Feature #10 is done.');
    });

    it('exports AGENTS_LEDGER of the announced PBI to the following iteration', () => {
      fakeQueue([pbiRun(11), doneStep]);
      run(['-Feature', '10'], true);
      const env = fs.readFileSync(path.join(dir, 'env.log'), 'utf8').split('\n');
      expect(env[0]).toBe('[1] unset');
      expect(env[1]).toMatch(/^\[2\] .*\.agents[\\/]11[\\/]progress\.md$/);
    });

    it('stops at a Gate: line with exit 2 and records the gate text', () => {
      fakeQueue([pbiRun(11), `mkdir -p .agents/12; echo "Next PBI: #12 T"; echo "Gate: Approve the plan?" >> .agents/12/progress.md`, doneStep]);
      const r = run(['-Epic', '10'], true);
      expect(r.status).toBe(2);
      expect(calls()).toHaveLength(2);
      const q = queue();
      expect(q.state).toBe('gate');
      expect(q.pbis[1]).toMatchObject({ number: 12, outcome: 'gate', gate: 'Gate: Approve the plan?' });
      expect(r.stdout).toContain('Approve the plan?');
    });

    it('stops with exit 1 on a failed run, fail closed', () => {
      fakeQueue([pbiRun(11), 'echo "Next PBI: #12 T"; echo boom >&2; exit 1', doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(2);
      const q = queue();
      expect(q.state).toBe('failed');
      expect(q.pbis[1].outcome).toBe('failed');
    });

    it('fails when the output names neither a PBI nor Feature done', () => {
      fakeQueue(['echo "nothing useful"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(queue().pbis[0]).toMatchObject({ number: null, outcome: 'failed' });
    });

    it('stops when the same PBI is selected twice in a row', () => {
      fakeQueue([pbiRun(11), pbiRun(11), pbiRun(12), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(2);
      expect(queue().pbis[1].note).toContain('twice in a row');
    });

    it('continues past a failed PBI with -ContinueOnError and exits 1', () => {
      fakeQueue(['echo "Next PBI: #11 T"; exit 1', pbiRun(12), doneStep]);
      const r = run(['-Feature', '10', '-ContinueOnError'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(3);
      expect(queue().pbis.map((p: { outcome: string }) => p.outcome)).toEqual(['failed', 'done']);
    });

    it('lists PBIs from "merged, closes at release" on the done line as merged', () => {
      fakeQueue(['echo "Feature #10 is done — merged, closes at release: #5, #6"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(queue().pbis.map((p: { number: number; outcome: string }) => [p.number, p.outcome])).toEqual([[5, 'merged'], [6, 'merged']]);
    });

    it('does not merge by default, even with an APPROVE verdict', () => {
      ghFake();
      fakeQueue([pbiRun(11, 'echo "PR #101 verdict APPROVE"'), doneStep]);
      expect(run(['-Feature', '10'], true).status).toBe(0);
      expect(ghCalls()).not.toContain('pr merge');
      expect(queue().pbis[0].outcome).toBe('done');
    });

    it('squash-merges an open APPROVE PR with -MergeApproved', () => {
      ghFake();
      fakeQueue([pbiRun(11, 'echo "PR #101 verdict APPROVE"'), doneStep]);
      expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(0);
      expect(ghCalls()).toContain('pr merge 101 --squash');
      expect(queue().pbis[0]).toMatchObject({ outcome: 'merged', pr: 101 });
    });

    it('does not merge CHANGES_REQUESTED, a release PR, a gate or a failure', () => {
      ghFake();
      fakeQueue([pbiRun(11, 'echo "PR #101 verdict CHANGES_REQUESTED"'), doneStep]);
      run(['-Feature', '10', '-MergeApproved'], true);
      expect(ghCalls()).not.toContain('pr merge');

      fs.rmSync(path.join(dir, 'steps'), { recursive: true });
      fs.rmSync(path.join(dir, 'count'));
      fs.rmSync(path.join(dir, '.agents'), { recursive: true });
      ghFake('{"state":"OPEN","baseRefName":"main","headRefName":"release/next"}');
      fakeQueue([pbiRun(12, 'echo "PR #102 APPROVE"'), doneStep]);
      run(['-Feature', '10', '-MergeApproved'], true);
      expect(ghCalls()).not.toContain('pr merge');
      expect(queue().pbis[0].note).toContain('release PR');

      fs.rmSync(path.join(dir, 'steps'), { recursive: true });
      fs.rmSync(path.join(dir, 'count'));
      ghFake();
      fakeQueue([`mkdir -p .agents/13; echo "Next PBI: #13 T"; echo "PR #103 APPROVE"; echo "Gate: ok?" >> .agents/13/progress.md`]);
      expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(2);
      expect(ghCalls()).not.toContain('pr merge');
    });
  });

});

describe('orchestrator agent', () => {
  it('writes Ledger complete. through Add-LedgerLine.ps1 before the final report line', () => {
    const body = fs.readFileSync(AGENT, 'utf8');
    expect(body).toMatch(/append `Ledger complete\.` as the last ledger line via `Add-LedgerLine\.ps1`/);
  });
});
