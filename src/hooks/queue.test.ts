import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/queue/scripts/Invoke-OrchestratorQueue.ps1',
);
const INSTALLER = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/queue/scripts/Install-QueueLauncher.ps1',
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
    const env = { ...process.env, QUEUE_POLL_SECONDS: '0', PATH: withBin ? `${bin}${path.delimiter}${process.env.PATH}` : process.env.PATH };
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
      expect(r.stdout).toContain('Bash(git status:*)');
      expect(r.stdout).toContain('Bash(gh pr create:*)');
      expect(r.stdout).not.toContain('gh pr merge');
      expect(r.stdout).not.toContain('Bash(git:*)');
      expect(r.stdout).not.toContain('Bash(gh:*)');
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
      expect(narrow).toContain('"--allow-tool=shell(git status:*)"');
      expect(narrow).toContain('"--allow-tool=shell(gh pr create:*)"');
      expect(narrow).not.toContain('--allow-all-tools');
      expect(narrow).not.toContain('gh pr merge');
      const all = run(['12', '-Harness', 'copilot', '-Mode', 'plan', '-AllowAll', '-DryRun']);
      expect(all.status).toBe(0);
      expect(all.stdout).toContain('[dry-run] #12: copilot -p "plan 12" --agent=orchestrator --no-ask-user --allow-all-tools\n');
      expect(all.stdout).not.toContain('--allow-tool');
    });

    it('prints the narrow OpenCode command with OPENCODE_PERMISSION, and --auto without it with -AllowAll', () => {
      const narrow = run(['12', '-Harness', 'opencode', '-DryRun']).stdout;
      expect(narrow).toContain('[dry-run] #12: OPENCODE_PERMISSION=');
      expect(narrow).toContain('opencode run --agent orchestrator "full 12"');
      expect(narrow).toContain('\\"git status *\\":\\"allow\\"');
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

  describe.skipIf(!posix)('Feature and Epic queue mode', () => {
    // fake claude: iteration k runs steps/<k> (a sh script); records AGENTS_LEDGER and args per call
    const fakeQueue = (steps: string[]) => {
      fs.rmSync(path.join(dir, 'steps'), { recursive: true, force: true });
      fs.rmSync(path.join(dir, 'count'), { force: true });
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
    const PR_URL = 'https://github.com/o/r/pull/101';
    // a finished PBI run: announces the PBI, writes its ledger (optionally with the PR line) and prints extra output
    const pbiRun = (n: number, o: { pr?: number; out?: string } = {}) =>
      `mkdir -p .agents/${n}; echo "Next PBI: #${n} Title ${n}"; ` +
      (o.pr ? `echo "Phase pull-request: complete — https://github.com/o/r/pull/${o.pr}" >> .agents/${n}/progress.md; ` : '') +
      `echo "Ledger complete." >> .agents/${n}/progress.md; ${o.out ?? ''}`;
    const doneStep = 'echo "Feature #10 is done."; echo "Ledger complete. Start the next issue in a new session."';
    const queue = (nr = 10) => JSON.parse(fs.readFileSync(path.join(dir, '.agents', `queue-${nr}.json`), 'utf8'));
    type Pbi = { number: number | null; outcome: string; pr: number | null; note: string | null; gate: string | null };
    const outcomes = () => (queue().pbis as Pbi[]).map((p) => [p.number, p.outcome]);

    const defaultPr = { number: 101, state: 'OPEN', headRefName: 'feat/11-x', baseRefName: 'release/next', headRefOid: 'abc123', isCrossRepository: false, mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ conclusion: 'SUCCESS' }] };
    // fake gh: `pr list` prints the given PRs (or fails), `pr merge` exits with mergeExit
    const ghFake = (prs: object[] = [defaultPr], o: { listFails?: boolean; mergeExit?: number; view?: object } = {}) => {
      fs.writeFileSync(path.join(dir, 'gh-list.json'), JSON.stringify(prs));
      fs.writeFileSync(path.join(dir, 'gh-view.json'), JSON.stringify(o.view ?? {}));
      fs.writeFileSync(
        path.join(bin, 'gh'),
        `#!/bin/sh
echo "$@" >> "${dir}/gh.log"
case "$1 $2" in
  "pr list") ${o.listFails ? 'echo "boom" >&2; exit 1' : `cat "${dir}/gh-list.json"`} ;;
  "pr view") cat "${dir}/gh-view.json" ;;
  "pr merge") exit ${o.mergeExit ?? 0} ;;
esac
exit 0
`,
        { mode: 0o755 },
      );
    };
    const ghCalls = () => (fs.existsSync(path.join(dir, 'gh.log')) ? fs.readFileSync(path.join(dir, 'gh.log'), 'utf8') : '');
    const approve = 'echo "Verdict: APPROVE"';

    it('dry run prints one next command and writes nothing', () => {
      const r = run(['-Feature', '10', '-DryRun']);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('[dry-run] Feature #10: claude --agent orchestrator -p "next 10" --allowedTools ');
      expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
      expect(run(['-Epic', '#11', '-Harness', 'copilot', '-DryRun']).stdout).toContain('copilot -p "next 11"');
    });

    it('rejects -Feature with -Epic, issue numbers or an explicit -Mode', () => {
      expect(run(['-Feature', '1', '-Epic', '2', '-DryRun']).status).not.toBe(0);
      expect(run(['5', '-Feature', '1', '-DryRun']).status).not.toBe(0);
      const r = run(['-Feature', '1', '-Mode', 'plan', '-DryRun']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('-Mode cannot be combined');
    });

    it('loops in fresh processes until the Feature is done and writes the queue json', () => {
      fakeQueue([pbiRun(11, { pr: 101 }), pbiRun(12), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(calls()).toHaveLength(3);
      expect(calls()[0]).toContain('-p next 10');
      const q = queue();
      expect(q).toMatchObject({ queue: 10, kind: 'Feature', state: 'done', exitCode: 0, mergeApproved: false });
      expect(outcomes()).toEqual([[11, 'done'], [12, 'done']]);
      expect(q.pbis[0].pr).toBe(101);
      expect(q.pbis[1].pr).toBeNull();
      expect(q.pbis[0].ledger).toBe('.agents/11/progress.md');
      expect(Date.parse(q.started)).not.toBeNaN();
      expect(Date.parse(q.ended)).not.toBeNaN();
      expect(r.stdout).toContain('Feature #10 is done.');
    });

    it('ends an Epic run on "Epic #<nr> is done."', () => {
      fakeQueue([pbiRun(11), 'echo "Epic #10 is done."']);
      const r = run(['-Epic', '10'], true);
      expect(r.status).toBe(0);
      expect(queue()).toMatchObject({ kind: 'Epic', state: 'done' });
      expect(calls()).toHaveLength(2);
    });

    it('does not accept a lower-case or mismatched done/gate line', () => {
      fakeQueue(['echo "feature #10 is done."']);
      expect(run(['-Feature', '10'], true).status).toBe(1);
      fakeQueue(['echo "Epic #10 is done."']);
      expect(run(['-Feature', '10'], true).status).toBe(1);
      fakeQueue(['mkdir -p .agents/11; echo "Next PBI: #11 T"; echo "gate: lower case"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(outcomes()).toEqual([[11, 'failed']]);
    });

    it('requires exit code 0 for "is done."', () => {
      fakeQueue(['echo "Feature #10 is done."; exit 3']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(queue().state).toBe('failed');
    });

    it('clears AGENTS_LEDGER before every child, also an inherited value, and restores nothing into children', () => {
      fakeQueue([pbiRun(11), doneStep]);
      const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Feature', '10'], {
        encoding: 'utf8', cwd: dir, env: { ...process.env, AGENTS_LEDGER: '/ambient/progress.md', PATH: `${bin}${path.delimiter}${process.env.PATH}` },
      });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(path.join(dir, 'env.log'), 'utf8').trim().split('\n')).toEqual(['[1] unset', '[2] unset']);
    });

    it('stops at a Gate: line with exit 2 and records the gate text', () => {
      fakeQueue([pbiRun(11), `mkdir -p .agents/12; echo "Next PBI: #12 T"; echo "Gate: Approve the plan?" >> .agents/12/progress.md`, doneStep]);
      const r = run(['-Epic', '10'], true);
      expect(r.status).toBe(2);
      expect(calls()).toHaveLength(2);
      expect(queue().state).toBe('gate');
      expect(queue().pbis[1]).toMatchObject({ number: 12, outcome: 'gate', gate: 'Gate: Approve the plan?' });
      expect(r.stdout).toContain('Approve the plan?');
    });

    it('detects a gate that exists only in the ledger as a count increase, ignoring an old Gate: line', () => {
      ledger(12, 'Gate: old question', 'Phase read: complete');
      fakeQueue(['mkdir -p .agents/12; echo "Next PBI: #12 T"; echo "Gate: new question" >> .agents/12/progress.md']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(2);
      expect(queue().pbis[0].gate).toBe('Gate: new question');
    });

    it('does not report an old ledger gate as a gate when the resumed run just fails', () => {
      ledger(12, 'Gate: old question');
      fakeQueue(['echo "Next PBI: #12 T"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(outcomes()).toEqual([[12, 'failed']]);
    });

    it('lets a complete PBI ledger win over a Gate: line in the output (as in positional mode)', () => {
      fakeQueue([pbiRun(11, { out: 'echo "Gate: stale"' }), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(outcomes()).toEqual([[11, 'done']]);
    });

    it('stops with exit 1 on a failed run, fail closed', () => {
      fakeQueue([pbiRun(11), 'echo "Next PBI: #12 T"; echo boom >&2; exit 1', doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(2);
      expect(queue().state).toBe('failed');
      expect(outcomes()).toEqual([[11, 'done'], [12, 'failed']]);
    });

    it('fails when the output names neither a PBI nor Feature done', () => {
      fakeQueue(['echo "nothing useful"']);
      expect(run(['-Feature', '10'], true).status).toBe(1);
      expect(queue().pbis[0]).toMatchObject({ number: null, outcome: 'failed' });
    });

    it('reports "Nothing selectable" as state blocked with exit 3, not as a failure', () => {
      fakeQueue(['echo "Nothing selectable: Feature #10"; echo "#12 waiting for merge: PR #5"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(3);
      expect(queue()).toMatchObject({ state: 'blocked', exitCode: 3 });
      expect(queue().pbis[0]).toMatchObject({ number: null, outcome: 'blocked' });
      expect(r.stdout).toContain('Nothing selectable in Feature #10');
    });

    it('does not read "Nothing selectable" from a run that exited non-zero', () => {
      fakeQueue(['echo "Nothing selectable: Feature #10"; exit 1']);
      expect(run(['-Feature', '10'], true).status).toBe(1);
    });

    it('stops when the same PBI is selected twice in a row', () => {
      fakeQueue([pbiRun(11), pbiRun(11), pbiRun(12), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(2);
      expect(queue().pbis[1].note).toContain('twice in a row');
    });

    it('with -ContinueOnError continues only when next picks a different PBI, and exits 1', () => {
      fakeQueue(['echo "Next PBI: #11 T"; exit 1', pbiRun(12), doneStep]);
      const r = run(['-Feature', '10', '-ContinueOnError'], true);
      expect(r.status).toBe(1);
      expect(calls()).toHaveLength(3);
      expect(outcomes()).toEqual([[11, 'failed'], [12, 'done']]);
      fakeQueue(['echo "Next PBI: #11 T"; exit 1', 'echo "Next PBI: #11 T"; exit 1', doneStep]);
      expect(run(['-Feature', '10', '-ContinueOnError'], true).status).toBe(1);
      expect(calls()).toHaveLength(5);
    });

    it('marks a selected PBI whose ledger was already complete as skipped', () => {
      ledger(11, 'Ledger complete.');
      fakeQueue([`echo "Next PBI: #11 T"`, doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(outcomes()).toEqual([[11, 'skipped']]);
    });

    it('lists PBIs from "merged, closes at release" on the done line as merged', () => {
      fakeQueue(['echo "Feature #10 is done — merged, closes at release: #5, #6"']);
      const r = run(['-Feature', '10'], true);
      expect(r.status).toBe(0);
      expect(outcomes()).toEqual([[5, 'merged'], [6, 'merged']]);
    });

    it('handles a PBI number beyond int range', () => {
      fakeQueue(['mkdir -p .agents/4294967299; echo "Next PBI: #4294967299 T"; echo "Ledger complete." >> .agents/4294967299/progress.md', doneStep]);
      expect(run(['-Feature', '10'], true).status).toBe(0);
      expect(queue().pbis[0].number).toBe(4294967299);
    });

    it('writes queue-<nr>.log and appends each PBI output with the exit trailer to .agents/<pbi>/run.log', () => {
      fakeQueue([pbiRun(11, { out: 'echo "hello 11"; echo "err 11" >&2' }), doneStep]);
      run(['-Feature', '10'], true);
      const qlog = fs.readFileSync(path.join(dir, '.agents/queue-10.log'), 'utf8');
      expect(qlog).toContain('hello 11');
      expect(qlog.match(/=== exit code 0/g)).toHaveLength(2);
      const plog = fs.readFileSync(path.join(dir, '.agents/11/run.log'), 'utf8');
      expect(plog).toContain('hello 11');
      expect(plog).toContain('err 11');
      expect(plog).toContain('=== exit code 0');
    });

    it('on an unexpected runner error writes the queue json as failed and exits non-zero', () => {
      fs.mkdirSync(path.join(dir, 'elsewhere'));
      fs.mkdirSync(path.join(dir, '.agents'));
      fs.symlinkSync(path.join(dir, 'elsewhere'), path.join(dir, '.agents/11'));
      fakeQueue([pbiRun(11), doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).not.toBe(0);
      expect(queue()).toMatchObject({ state: 'failed', exitCode: 1 });
      expect(queue().pbis.at(-1).note).toContain('runner error');
    });

    it('ends in state failed (not running) when the runner throws without the symlink guard, and starts no further child', () => {
      // run.log is a directory: Add-Content throws inside the loop, in the generic catch
      fakeQueue(['mkdir -p .agents/11/run.log; echo "Next PBI: #11 T"', doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).not.toBe(0);
      expect(queue()).toMatchObject({ state: 'failed', exitCode: 1 });
      expect(queue().pbis.at(-1).note).toContain('runner error');
      expect(calls()).toHaveLength(1);
    });

    it('refuses a dangling symlinked .agents/', () => {
      fs.symlinkSync(path.join(dir, 'nowhere'), path.join(dir, '.agents'));
      fakeQueue([doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Refusing symlinked path');
    });

    it('refuses a symlinked .agents/', () => {
      fs.mkdirSync(path.join(dir, 'elsewhere'));
      fs.symlinkSync(path.join(dir, 'elsewhere'), path.join(dir, '.agents'));
      fakeQueue([doneStep]);
      const r = run(['-Feature', '10'], true);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('Refusing symlinked path');
      expect(calls()).toHaveLength(0);
    });

    describe('-MergeApproved', () => {
      const lines = () => ghCalls().trim().split('\n').filter(Boolean);
      // isolated git: no user/system config, no signing, fixed identity; every call must succeed
      const git = (...a: string[]) => {
        const r = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
          cwd: dir,
          encoding: 'utf8',
          env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
        });
        expect(r.status, `git ${a.join(' ')}: ${r.stderr}`).toBe(0);
        return r.stdout.trim();
      };
      let oid: string;
      // a repo whose origin has feat/11-x at oid; there is no local feat/11-x branch unless a test creates it
      beforeEach(() => {
        git('init', '-q', '-b', 'main');
        git('commit', '-q', '--allow-empty', '-m', 'x');
        oid = git('rev-parse', 'HEAD');
        expect(oid).toMatch(/^[0-9a-f]{40,64}$/);
        git('init', '-q', '--bare', path.join(dir, 'upstream-store'));
        git('remote', 'add', 'origin', path.join(dir, 'upstream-store'));
        git('push', '-q', 'origin', 'HEAD:refs/heads/feat/11-x');
        defaultPr.headRefOid = oid;
      });

      it('does not merge by default, even with an APPROVE verdict', () => {
        ghFake();
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        expect(run(['-Feature', '10'], true).status).toBe(0);
        expect(ghCalls()).toBe('');
        expect(outcomes()).toEqual([[11, 'done']]);
      });

      it('squash-merges the PBI PR pinned to its head commit', () => {
        ghFake();
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(0);
        expect(lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
        expect(outcomes()).toEqual([[11, 'merged']]);
        expect(queue().pbis[0].pr).toBe(101);
        expect(queue().state).toBe('done');
        expect(calls()).toHaveLength(2);
      });

      it('finds the PR by the PBI head branch when the ledger has no PR line', () => {
        ghFake();
        fakeQueue([pbiRun(11, { out: approve }), doneStep]);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
      });

      it.each([
        ['CHANGES_REQUESTED verdict', 'echo "Verdict: CHANGES_REQUESTED"', defaultPr, 'verdict is not a plain APPROVE'],
        ['a later non-APPROVE verdict wins', 'echo "Verdict: APPROVE"; echo "Verdict: CHANGES_REQUESTED"', defaultPr, 'verdict is not a plain APPROVE'],
        ['lower-case verdict', 'echo "Verdict: approve"', defaultPr, 'verdict is not a plain APPROVE'],
        ['APPROVE with a suffix after a dash', 'echo "Verdict: APPROVE - but 2 HIGH findings"', defaultPr, 'verdict is not a plain APPROVE'],
        ['APPROVE with a trailing comment', 'echo "Verdict: APPROVE, see below"', defaultPr, 'verdict is not a plain APPROVE'],
        ['prose that mentions approve', 'echo "I would APPROVE this"; echo "approve"', defaultPr, 'no Verdict: line'],
        ['no verdict at all', 'echo ok', defaultPr, 'no Verdict: line'],
        ['release head with a non-main base', approve, { ...defaultPr, headRefName: 'release/11-x', baseRefName: 'develop' }, 'release PR'],
        ['main base with a non-release head', approve, { ...defaultPr, baseRefName: 'main' }, 'is not the integration branch'],
        ['base that is not release/*', approve, { ...defaultPr, baseRefName: 'develop' }, 'is not the integration branch'],
        ['a PR that is not open', approve, { ...defaultPr, state: 'MERGED' }, 'state MERGED'],
        ['a PR of another PBI branch', approve, { ...defaultPr, headRefName: 'feat/99-other' }, 'no single open PR of PBI #11'],
        ['a cross-repository PR', approve, { ...defaultPr, isCrossRepository: true }, 'fork or cross-repository PR'],
        ['unknown cross-repository status', approve, { ...defaultPr, isCrossRepository: undefined }, 'fork or cross-repository PR'],
        ['a missing head commit', approve, { ...defaultPr, headRefOid: undefined }, 'head commit unknown'],
        ['failing checks', approve, { ...defaultPr, statusCheckRollup: [{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }] }, 'checks are not green'],
        ['pending checks', approve, { ...defaultPr, statusCheckRollup: [{ state: 'PENDING' }] }, 'checks are not green'],
        ['an empty check list', approve, { ...defaultPr, statusCheckRollup: [] }, 'no checks reported'],
        ['a missing check list', approve, { ...defaultPr, statusCheckRollup: undefined }, 'no checks reported'],
        ['a PR that is not clean', approve, { ...defaultPr, mergeStateStatus: 'BLOCKED' }, 'not mergeable/clean (MERGEABLE/BLOCKED)'],
        ['a conflicting PR', approve, { ...defaultPr, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }, 'not mergeable/clean (CONFLICTING/DIRTY)'],
        ['APPROVE without any PR', approve, null, 'no single open PR of PBI #11'],
      ])('does not merge: %s', (_name, out, pr, note) => {
        ghFake(pr ? [pr] : []);
        fakeQueue([pbiRun(11, { pr: pr ? 101 : undefined, out }), doneStep]);
        const r = run(['-Feature', '10', '-MergeApproved'], true);
        expect(r.status).toBe(0);
        expect(ghCalls()).not.toContain('pr merge');
        expect(outcomes()).toEqual([[11, 'done']]);
        expect(queue().state).toBe('done');
        expect(queue().pbis[0].note).toContain(note);
      });

      describe('UNKNOWN mergeability right after PR creation', () => {
        const unknown = () => ({ ...defaultPr, mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN', statusCheckRollup: [] });
        it('polls gh pr view and merges once GitHub has computed MERGEABLE/CLEAN', () => {
          ghFake([unknown()], { view: { mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ conclusion: 'SUCCESS' }] } });
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(lines()).toContain('pr view 101 --json mergeable,mergeStateStatus,statusCheckRollup');
          expect(lines()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
        });
        it('skips the merge after three polls that stay UNKNOWN', () => {
          ghFake([unknown()], { view: { mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN', statusCheckRollup: [] } });
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(0);
          expect(lines().filter((l) => l.startsWith('pr view'))).toHaveLength(3);
          expect(ghCalls()).not.toContain('pr merge');
          expect(queue().pbis[0].note).toContain('mergeability still UNKNOWN after 3 polls');
        });
      });

      it('does not merge when the child exited non-zero even with a complete ledger and APPROVE', () => {
        ghFake();
        fakeQueue([pbiRun(11, { pr: 101, out: `${approve}; exit 1` }), doneStep]);
        const r = run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
        expect(outcomes()).toEqual([[11, 'done']]);
        expect(queue().pbis[0].note).toContain('child exit code 1');
        expect(r.status).toBe(0); // ledger wins for the outcome, only the merge is withheld
      });

      it('does not merge when two open PRs match the PBI branch and the ledger names none', () => {
        ghFake([defaultPr, { ...defaultPr, number: 102, headRefName: 'fix/11-again' }]);
        fakeQueue([pbiRun(11, { out: approve }), doneStep]);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
        expect(queue().pbis[0].note).toContain('PBI #11');
      });

      it('does not let PBI 1 match a feat/11-x branch', () => {
        ghFake();
        fakeQueue([pbiRun(1, { out: approve }), 'echo "Feature #10 is done."']);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
      });

      it('does not merge when gh pr list returns something that is not JSON', () => {
        ghFake();
        fs.writeFileSync(path.join(dir, 'gh-list.json'), 'not json at all');
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
        expect(outcomes()).toEqual([[11, 'done']]);
      });

      describe('head verification', () => {
        const merged = () => ghCalls().includes('pr merge');
        const other = 'ffffffffffffffffffffffffffffffffffffffff';
        it('merges when the local branch tip equals the PR head', () => {
          git('branch', 'feat/11-x');
          ghFake([{ ...defaultPr, headRefOid: oid }]);
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(ghCalls()).toContain(`pr merge 101 --squash --match-head-commit ${oid}`);
        });
        it('skips the merge when the local branch tip differs from the PR head', () => {
          git('branch', 'feat/11-x');
          ghFake([{ ...defaultPr, headRefOid: other }]);
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(merged()).toBe(false);
          expect(queue().pbis[0].note).toContain(`differs from local branch tip ${oid}`);
        });
        it('without a local branch, skips when the origin branch tip differs from the PR head', () => {
          ghFake([{ ...defaultPr, headRefOid: other }]);
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(merged()).toBe(false);
          expect(queue().pbis[0].note).toContain(`differs from origin branch tip ${oid}`);
        });
        it('without a local branch and without a reachable origin, skips because the head cannot be verified', () => {
          git('remote', 'remove', 'origin');
          ghFake();
          fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
          run(['-Feature', '10', '-MergeApproved'], true);
          expect(merged()).toBe(false);
          expect(queue().pbis[0].note).toContain('cannot be verified');
        });
      });

      it('does not merge when the ledger PR is not among the open PRs of the PBI', () => {
        ghFake([{ ...defaultPr, number: 555 }]);
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        run(['-Feature', '10', '-MergeApproved'], true);
        expect(ghCalls()).not.toContain('pr merge');
      });

      it('does not merge when gh pr list fails', () => {
        ghFake([defaultPr], { listFails: true });
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(0);
        expect(ghCalls()).not.toContain('pr merge');
        expect(queue().pbis[0].note).toContain('gh pr list failed');
      });

      it('does not merge on a gate', () => {
        ghFake();
        fakeQueue([`mkdir -p .agents/11; echo "Next PBI: #11 T"; ${approve}; echo "Gate: ok?" >> .agents/11/progress.md`]);
        expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(2);
        expect(ghCalls()).not.toContain('pr merge');
      });

      it('does not merge a failed iteration that printed APPROVE', () => {
        ghFake();
        fakeQueue([`echo "Next PBI: #11 T"; ${approve}; exit 1`]);
        expect(run(['-Feature', '10', '-MergeApproved'], true).status).toBe(1);
        expect(ghCalls()).not.toContain('pr merge');
      });

      it('records failed and exits 1 when gh pr merge fails', () => {
        ghFake([defaultPr], { mergeExit: 1 });
        fakeQueue([pbiRun(11, { pr: 101, out: approve }), doneStep]);
        const r = run(['-Feature', '10', '-MergeApproved'], true);
        expect(r.status).toBe(1);
        expect(ghCalls()).toContain('pr merge 101');
        expect(outcomes()).toEqual([[11, 'failed']]);
        expect(queue().pbis[0].note).toContain('merge');
        expect(queue().state).toBe('failed');
        expect(calls()).toHaveLength(1);
      });
    });
  });
});

describe.skipIf(!hasPwsh || !posix)('Install-QueueLauncher.ps1', () => {
  let tmp: string;
  let home: string;
  let target: string;
  let launcher: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qlaunch-'));
    home = path.join(tmp, 'home');
    target = path.join(tmp, 'bin');
    launcher = path.join(target, 'queue');
    fs.mkdirSync(home);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  // HOME points into tmp; every other variable the launcher or installer could read a home from is removed
  const env = (extra: Record<string, string> = {}) => {
    const e: NodeJS.ProcessEnv = { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...extra };
    for (const k of ['USERPROFILE', 'XDG_CONFIG_HOME', 'QUEUE_RUNNER', 'QUEUE_CALLER_CWD']) if (!(k in extra)) delete e[k];
    return e;
  };
  const install = (...args: string[]) =>
    spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Dir', target, ...args], { encoding: 'utf8', cwd: tmp, env: env() });

  it('installs an executable launcher with the marker and a PATH hint', () => {
    const r = install();
    expect(r.status).toBe(0);
    expect(fs.statSync(launcher).mode & 0o111).not.toBe(0);
    const body = fs.readFileSync(launcher, 'utf8');
    expect(body.startsWith('#!/bin/sh\n# apm-hub queue launcher\n')).toBe(true);
    expect(r.stdout).toContain('is not on PATH');
  });

  it('is idempotent', () => {
    install();
    const before = fs.readFileSync(launcher, 'utf8');
    const r = install();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Up to date');
    expect(fs.readFileSync(launcher, 'utf8')).toBe(before);
  });

  it('prints no PATH hint when -Dir is on PATH', () => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Dir', target], {
      encoding: 'utf8',
      cwd: tmp,
      env: env({ PATH: `${target}${path.delimiter}${process.env.PATH}` }),
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Installed');
    expect(r.stdout).not.toContain('not on PATH');
  });

  it('expands a leading ~ in -Dir to HOME', () => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Dir', '~/mybin'], { encoding: 'utf8', cwd: tmp, env: env() });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(home, 'mybin', 'queue'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '~'))).toBe(false);
  });

  describe('launcher text (-Show), also the Windows variant, text-level only', () => {
    const show = (flavor: 'sh' | 'cmd') => {
      const r = spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Show', '-Flavor', flavor], { encoding: 'utf8', cwd: tmp, env: env() });
      expect(r.status).toBe(0);
      return r.stdout;
    };
    const norm = (d: string) => d.replace(/\$top|%TOP%/g, 'TOP').replace(/\$HOME|%USERPROFILE%/g, 'HOME').replace(/\\/g, '/');
    const dirsOf = (text: string, re: RegExp) => [...(text.match(re)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => norm(m[1]));

    it('the cmd launcher uses setlocal so cd /d does not leak, and returns the exit code', () => {
      const cmd = show('cmd');
      expect(cmd).toMatch(/^@echo off\r\nsetlocal\r\n/);
      expect(cmd.indexOf('setlocal')).toBeLessThan(cmd.indexOf('cd /d'));
      expect(cmd).toContain('endlocal & exit /b %ERRORLEVEL%');
      expect(cmd).toContain('QUEUE_RUNNER');
    });

    it('sh and cmd search the same seven directories in the same order', () => {
      const fromSh = dirsOf(show('sh'), /for base in([\s\S]*?); do/);
      const fromCmd = dirsOf(show('cmd'), /for %%b in \((.*)\) do/);
      expect(fromSh).toEqual([
        'TOP/.claude/skills',
        'TOP/.opencode/skills',
        'TOP/.agents/skills',
        'TOP/.github/skills',
        'HOME/.claude/skills',
        'HOME/.agents/skills',
        'HOME/.config/opencode/skills',
      ]);
      expect(fromCmd).toEqual(fromSh);
    });
  });

  it('refuses a foreign file and overwrites it with -Force', () => {
    fs.mkdirSync(target);
    fs.writeFileSync(launcher, '#!/bin/sh\necho mine\n');
    const r = install();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('-Force');
    expect(fs.readFileSync(launcher, 'utf8')).toContain('echo mine');
    expect(install('-Force').status).toBe(0);
    expect(fs.readFileSync(launcher, 'utf8')).toContain('apm-hub queue launcher');
  });

  it('needs -Force for a different older launcher', () => {
    fs.mkdirSync(target);
    fs.writeFileSync(launcher, '#!/bin/sh\n# apm-hub queue launcher\necho old\n');
    expect(install().status).not.toBe(0);
    expect(install('-Force').status).toBe(0);
    expect(fs.readFileSync(launcher, 'utf8')).not.toContain('echo old');
  });

  it('does not follow a symlinked launcher', () => {
    fs.mkdirSync(target);
    const real = path.join(tmp, 'real');
    fs.writeFileSync(real, 'x');
    fs.symlinkSync(real, launcher);
    const r = install('-Force');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('symlink');
    expect(fs.readFileSync(real, 'utf8')).toBe('x');
  });

  it('-Uninstall removes only our launcher', () => {
    install();
    expect(install('-Uninstall').status).toBe(0);
    expect(fs.existsSync(launcher)).toBe(false);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(launcher, '#!/bin/sh\necho mine\n');
    const r = install('-Uninstall');
    expect(r.status).toBe(0);
    expect(fs.readFileSync(launcher, 'utf8')).toContain('echo mine');
  });

  it('-WhatIf writes nothing', () => {
    const r = install('-WhatIf');
    expect(r.status).toBe(0);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('-Uninstall -WhatIf keeps our launcher', () => {
    install();
    expect(install('-Uninstall', '-WhatIf').status).toBe(0);
    expect(fs.existsSync(launcher)).toBe(true);
  });

  it('-Force -WhatIf leaves a foreign file untouched', () => {
    fs.mkdirSync(target);
    fs.writeFileSync(launcher, '#!/bin/sh\necho mine\n');
    expect(install('-Force', '-WhatIf').status).toBe(0);
    expect(fs.readFileSync(launcher, 'utf8')).toBe('#!/bin/sh\necho mine\n');
  });

  describe('the installed launcher', () => {
    let repo: string;
    const runner = (base: string, tag: string) => {
      const dir = path.join(base, 'skills', 'queue', 'scripts');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Invoke-OrchestratorQueue.ps1'), `Write-Output "${tag} $($args -join '|') $((Get-Location).Path)"\n`);
    };
    const call = (cwd: string, ...args: string[]) => spawnSync(launcher, args, { encoding: 'utf8', cwd, env: env() });
    beforeEach(() => {
      install();
      repo = path.join(tmp, 'repo');
      fs.mkdirSync(path.join(repo, 'sub'), { recursive: true });
      spawnSync('git', ['init', '-q'], { cwd: repo });
      repo = fs.realpathSync(repo);
    });

    it('runs the project runner from the git toplevel and passes args', () => {
      runner(path.join(repo, '.claude'), 'project');
      runner(path.join(home, '.claude'), 'global');
      const r = call(path.join(repo, 'sub'), '-DryRun', '-Mode', 'full', '12');
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe(`project -DryRun|-Mode|full|12 ${repo}`);
    });

    const lookup = (): [string, () => string][] => [
      ['project .claude', () => path.join(repo, '.claude')],
      ['project .opencode', () => path.join(repo, '.opencode')],
      ['project .agents', () => path.join(repo, '.agents')],
      ['project .github', () => path.join(repo, '.github')],
      ['global .claude', () => path.join(home, '.claude')],
      ['global .agents', () => path.join(home, '.agents')],
      ['global opencode', () => path.join(home, '.config', 'opencode')],
    ];
    it.each([0, 1, 2, 3, 4, 5, 6])('lookup dir %i wins over every later one and is used alone when it is the only one', (i) => {
      const dirs = lookup();
      const alone = call(repo, '1');
      expect(alone.status).toBe(1);
      for (let k = dirs.length - 1; k >= i; k--) runner(dirs[k][1](), dirs[k][0].replace(/ /g, '_'));
      expect(call(repo, '1').stdout.trim()).toBe(`${dirs[i][0].replace(/ /g, '_')} 1 ${repo}`);
    });

    it('announces a project-local runner on stderr, a global one silently', () => {
      runner(path.join(home, '.claude'), 'global');
      expect(call(repo, '1').stderr).not.toContain('project-local');
      runner(path.join(repo, '.claude'), 'project');
      expect(call(repo, '1').stderr).toContain(`queue: using project-local runner ${repo}/.claude/skills/queue/scripts/Invoke-OrchestratorQueue.ps1`);
    });

    it('QUEUE_RUNNER wins over every lookup dir and is not announced as project-local', () => {
      runner(path.join(repo, '.claude'), 'project');
      runner(path.join(tmp, 'custom'), 'custom');
      const custom = path.join(tmp, 'custom', 'skills', 'queue', 'scripts', 'Invoke-OrchestratorQueue.ps1');
      const r = spawnSync(launcher, ['7'], { encoding: 'utf8', cwd: repo, env: env({ QUEUE_RUNNER: custom }) });
      expect(r.stdout.trim()).toBe(`custom 7 ${repo}`);
      expect(r.stderr).not.toContain('project-local');
    });

    it('fails when QUEUE_RUNNER is not a file, without falling back', () => {
      runner(path.join(repo, '.claude'), 'project');
      const r = spawnSync(launcher, [], { encoding: 'utf8', cwd: repo, env: env({ QUEUE_RUNNER: path.join(tmp, 'nope.ps1') }) });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('QUEUE_RUNNER is not a file');
      expect(r.stdout).toBe('');
    });

    it('resolves a relative -IssueFile against the caller directory, not the git toplevel', () => {
      fs.writeFileSync(path.join(repo, 'sub', 'q.txt'), '7\n#8\n');
      const r = spawnSync(launcher, ['-IssueFile', 'q.txt', '-DryRun'], { encoding: 'utf8', cwd: path.join(repo, 'sub'), env: env({ QUEUE_RUNNER: SCRIPT }) });
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('-p "full 7"');
      expect(r.stdout).toContain('-p "full 8"');
    });

    it('errors when no runner is installed', () => {
      const r = call(repo);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('not found');
    });

    it('errors outside a git repository', () => {
      runner(path.join(home, '.claude'), 'global');
      const outside = path.join(tmp, 'plain');
      fs.mkdirSync(outside);
      const r = spawnSync(launcher, [], { encoding: 'utf8', cwd: outside, env: { ...env(), GIT_CEILING_DIRECTORIES: tmp } });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('not inside a git repository');
    });
  });
});

describe('orchestrator agent', () => {
  it('writes Ledger complete. through Add-LedgerLine.ps1 before the final report line', () => {
    const body = fs.readFileSync(AGENT, 'utf8');
    expect(body).toContain('Ledger complete.');
    expect(body).toContain('Add-LedgerLine.ps1');
  });
});
