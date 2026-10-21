import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AGENT, INSTALLER, SCRIPT, hasPwsh, isolatedEnv, posix, runBatch, type BatchCase, type BatchResult } from '../../helpers/queue.helpers';

// Fast project: validation, -DryRun, launcher text and the agent file. The -DryRun/validation cases of
// Invoke-OrchestratorQueue.ps1 run batched in ONE pwsh process (queue-batch.ps1), each case in its own
// working directory; every `it` below asserts on its own case result. Safety net: pwsh cold starts can be slow on CI.
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

describe.skipIf(!hasPwsh)('Invoke-OrchestratorQueue.ps1 (batched, one pwsh process)', () => {
  let root: string;
  let R: Record<string, BatchResult>;
  let dirOf: Record<string, string>;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-fast-'));
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    const defs: Record<string, { args: string[]; setup?: (dir: string) => void; withBin?: boolean }> = {};
    const add = (key: string, args: string[], setup?: (dir: string) => void, withBin = false) => (defs[key] = { args, setup, withBin });
    const ledger = (n: number, ...lines: string[]) => (dir: string) => {
      fs.mkdirSync(path.join(dir, '.agents', String(n)), { recursive: true });
      fs.writeFileSync(path.join(dir, '.agents', String(n), 'progress.md'), lines.join('\n') + '\n');
    };
    const file = (name: string, content: string) => (dir: string) => fs.writeFileSync(path.join(dir, name), content);

    add('default', ['12', '#13', '-DryRun']);
    add('allowAll', ['5', '-Mode', 'plan', '-AllowAll', '-DryRun']);
    add('issueFile', ['-IssueFile', 'q.txt', '-DryRun'], file('q.txt', '7\n\n#8\n7\n'));
    if (posix) {
      add('label', ['-Label', 'queue ready', '-DryRun'], (dir) => fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\necho "$@" > "${dir}/gh.args"\nprintf '30\\n4\\n'\n`, { mode: 0o755 }), true);
    }
    add('skipped', ['12', '13', '-DryRun'], ledger(12, '# orchestrator ledger', 'Ledger complete.'));
    add('notLast', ['12', '-DryRun'], ledger(12, 'Ledger complete.', 'Fix round 1: x'));
    // timestamp-prefixed lines (Add-LedgerLine.ps1 format) are read like the plain ones
    add('skippedTs', ['12', '13', '-DryRun'], ledger(12, '2026-10-21T15:19:46Z # orchestrator ledger', '2026-10-21T15:20:46Z Ledger complete.'));
    add('notLastTs', ['12', '-DryRun'], ledger(12, '2026-10-21T15:19:46Z Ledger complete.', '2026-10-21T15:20:46Z Fix round 1: x'));
    for (const a of [['abc'], ['0'], ['1;rm'], []]) add(`invalid ${JSON.stringify(a)}`, [...a, '-DryRun']);
    add('badLine', ['-IssueFile', 'q.txt', '-DryRun'], file('q.txt', '7\nfoo\n'));
    add('missingFile', ['-IssueFile', 'none.txt', '-DryRun']);
    add('copilotNarrow', ['12', '-Harness', 'copilot', '-DryRun']);
    add('copilotAll', ['12', '-Harness', 'copilot', '-Mode', 'plan', '-AllowAll', '-DryRun']);
    add('opencodeNarrow', ['12', '-Harness', 'opencode', '-DryRun']);
    add('opencodeAll', ['12', '-Harness', 'opencode', '-Mode', 'implement', '-AllowAll', '-DryRun']);
    add('adapter copilot', ['1', '-Harness', 'copilot', '-DryRun']);
    add('adapter opencode', ['1', '-Harness', 'opencode', '-DryRun']);
    add('unknownHarness', ['1', '-Harness', 'nope', '-DryRun']);
    add('modeNext', ['1', '-Mode', 'next', '-DryRun']);
    add('featureDry', ['-Feature', '10', '-DryRun']);
    add('epicCopilotDry', ['-Epic', '#11', '-Harness', 'copilot', '-DryRun']);
    add('featureAndEpic', ['-Feature', '1', '-Epic', '2', '-DryRun']);
    add('featureWithIssue', ['5', '-Feature', '1', '-DryRun']);
    add('advClaude', ['12', '-FixAdvisories', 'medium', '-DryRun']);
    add('advCopilot', ['12', '-Harness', 'copilot', '-FixAdvisories', 'all:security,perf', '-DryRun']);
    add('advOpencode', ['12', '-Harness', 'opencode', '-FixAdvisories', 'none', '-DryRun']);
    add('advFeature', ['-Feature', '10', '-FixAdvisories', 'medium', '-DryRun']);
    add('advEpicOpencode', ['-Epic', '11', '-Harness', 'opencode', '-FixAdvisories', 'medium', '-DryRun']);
    add('advBad', ['12', '-FixAdvisories', 'all;rm', '-DryRun']);
    add('advBadUpper', ['12', '-FixAdvisories', 'ALL', '-DryRun']);
    add('advBadDimCase', ['12', '-FixAdvisories', 'all:Sec', '-DryRun']);
    add('advBadDimUnderscore', ['12', '-FixAdvisories', 'all:a_b', '-DryRun']);
    add('advBadDimDigit', ['12', '-FixAdvisories', 'all:1x', '-DryRun']);
    add('advBadPolicy', ['12', '-FixAdvisories', 'high', '-DryRun']);
    add('statusDry', ['-Status', '248', '-DryRun']);
    add('statusCopilot', ['-Status', '#248', '-Harness', 'copilot', '-DryRun']);
    add('statusOpencode', ['-Status', '248', '-Harness', 'opencode', '-DryRun']);
    for (const [k, extra] of Object.entries({ Issue: ['5'], Feature: ['-Feature', '1'], Mode: ['-Mode', 'plan'], Merge: ['-MergeApproved'], Continue: ['-ContinueOnError'], Fix: ['-FixAdvisories', 'all'], Label: ['-Label', 'x'], Trusted: ['-TrustedOnly'] })) {
      add(`statusWith${k}`, ['-Status', '248', ...extra, '-DryRun']);
    }
    add('statusBad', ['-Status', 'abc', '-DryRun']);
    add('featureWithMode', ['-Feature', '1', '-Mode', 'plan', '-DryRun']);
    add('advAll', ['12', '-FixAdvisories', 'all', '-DryRun']);
    add('advOneDim', ['12', '-FixAdvisories', 'medium:security', '-DryRun']);
    add('advTwoDims', ['12', '-Harness', 'copilot', '-FixAdvisories', 'medium:dim-a,dim-b', '-DryRun']);
    add('advPlan', ['12', '-Mode', 'plan', '-FixAdvisories', 'all', '-DryRun']);
    add('advEpicClaude', ['-Epic', '11', '-FixAdvisories', 'all', '-DryRun']);
    add('advFeatureCopilot', ['-Feature', '10', '-Harness', 'copilot', '-FixAdvisories', 'none', '-DryRun']);
    add('advTwoIssues', ['12', '13', '-FixAdvisories', 'medium', '-DryRun']);
    for (const [i, v] of ['medium:', 'medium:a,', 'medium:a b', 'all --no-review', 'medium:a;b', 'none:$(x)', 'critical'].entries()) {
      add(`advBad${i}`, ['12', '-FixAdvisories', v, '-DryRun']);
    }

    const keys = Object.keys(defs);
    dirOf = {};
    const cases: BatchCase[] = keys.map((k, i) => {
      const dir = path.join(root, `c${i}`);
      fs.mkdirSync(dir);
      dirOf[k] = dir;
      defs[k].setup?.(dir);
      return { key: k, args: defs[k].args, cwd: dir, path: defs[k].withBin ? `${bin}${path.delimiter}${process.env.PATH}` : undefined };
    });
    const results = runBatch(cases);
    R = Object.fromEntries(keys.map((k, i) => [k, results[i]]));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  describe('input and dry run', () => {
    it('prints one claude command per positional issue with the default mode full', () => {
      const r = R.default;
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
      const r = R.allowAll;
      expect(r.stdout).toContain('-p "plan 5"');
      expect(r.stdout).toContain('--dangerously-skip-permissions');
    });

    it('reads issues from -IssueFile, ignoring blank lines and duplicates', () => {
      const r = R.issueFile;
      expect(r.status).toBe(0);
      expect(r.stdout.match(/\[dry-run\]/g)).toHaveLength(2);
      expect(r.stdout).toContain('-p "full 7"');
      expect(r.stdout).toContain('-p "full 8"');
    });

    it.skipIf(!posix)('resolves -Label through gh api GET, ascending, without pull requests', () => {
      const r = R.label;
      expect(r.status).toBe(0);
      expect(r.stdout.indexOf('full 4')).toBeLessThan(r.stdout.indexOf('full 30'));
      const args = fs.readFileSync(path.join(dirOf.label, 'gh.args'), 'utf8');
      expect(args).toContain('--method GET');
      expect(args).toContain('labels=queue%20ready');
    });

    it('lists an issue with a complete ledger as skipped and starts nothing', () => {
      const r = R.skipped;
      expect(r.stdout).not.toContain('-p "full 12"');
      expect(r.stdout).toContain('-p "full 13"');
      expect(r.stdout).toMatch(/^#12 skipped$/m);
    });

    it('skips a complete ledger whose lines carry a timestamp prefix', () => {
      expect(R.skippedTs.stdout).not.toContain('-p "full 12"');
      expect(R.skippedTs.stdout).toContain('-p "full 13"');
      expect(R.skippedTs.stdout).toMatch(/^#12 skipped$/m);
    });

    it('does not skip a timestamped ledger whose last line is not Ledger complete.', () => {
      expect(R.notLastTs.stdout).toContain('-p "full 12"');
    });

    it('does not skip when Ledger complete. is not the last line', () => {
      expect(R.notLast.stdout).toContain('-p "full 12"');
    });

    it.each([[['abc']], [['0']], [['1;rm']], [[]]])('rejects invalid input %j', (args) => {
      const r = R[`invalid ${JSON.stringify(args)}`];
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain(args.length ? `Cannot validate argument on parameter 'Issue'` : 'No issues: pass issue numbers');
    });

    it('rejects a bad line in -IssueFile and a missing file', () => {
      expect(R.badLine.stderr).toContain('q.txt line 2');
      expect(R.missingFile.status).not.toBe(0);
      expect(R.missingFile.stderr).toContain('Issue file not found: none.txt');
    });

    it('prints the narrow Copilot command, quoted for the shell, and --allow-all-tools only with -AllowAll', () => {
      const narrow = R.copilotNarrow.stdout;
      expect(narrow).toContain('[dry-run] #12: copilot -p "full 12" --agent=orchestrator --no-ask-user --allow-tool=write ');
      expect(narrow).toContain('"--allow-tool=shell(git status:*)"');
      expect(narrow).toContain('"--allow-tool=shell(gh pr create:*)"');
      expect(narrow).not.toContain('--allow-all-tools');
      expect(narrow).not.toContain('gh pr merge');
      const all = R.copilotAll;
      expect(all.status).toBe(0);
      expect(all.stdout).toContain('[dry-run] #12: copilot -p "plan 12" --agent=orchestrator --no-ask-user --allow-all-tools\n');
      expect(all.stdout).not.toContain('--allow-tool');
    });

    it('prints the narrow OpenCode command with OPENCODE_PERMISSION, and --auto without it with -AllowAll', () => {
      const narrow = R.opencodeNarrow.stdout;
      expect(narrow).toContain('[dry-run] #12: OPENCODE_PERMISSION=');
      expect(narrow).toContain('opencode run --agent orchestrator "full 12"');
      expect(narrow).toContain('\\"git status *\\":\\"allow\\"');
      expect(narrow).toContain('\\"*\\":\\"deny\\"');
      expect(narrow).not.toContain('--auto');
      // DROMOS_STATE_DIR=.agents (test helper) resolves against the case dir: absolute allow entry next to the .git deny
      expect(narrow).toMatch(/\\"\.git\/\*\*\\":\\"deny\\",\\"[^"\\]*\/\.agents\/\*\*\\":\\"allow\\"/);
      const all = R.opencodeAll;
      expect(all.status).toBe(0);
      expect(all.stdout).toContain('[dry-run] #12: opencode run --agent orchestrator --auto "implement 12"\n');
      expect(all.stdout).not.toContain('OPENCODE_PERMISSION');
    });

    it.skipIf(!hasPwsh)('opencode harness allows <git common dir>/agents/** (absolute) after the .git deny when no override is set', () => {
      const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-perm-'));
      try {
        spawnSync('git', ['init', '-q'], { cwd: repo });
        const adapter = path.resolve(path.dirname(SCRIPT), 'harness/opencode.ps1');
        const env = { ...process.env };
        delete env.DROMOS_STATE_DIR;
        const r = spawnSync('pwsh', ['-NoProfile', '-Command', `& '${adapter}' -Issue 1 | ForEach-Object { $_.Environment.OPENCODE_PERMISSION }`], { encoding: 'utf8', cwd: repo, env });
        expect(r.status).toBe(0);
        const edit = JSON.parse(r.stdout.trim()).edit;
        expect(Object.entries(edit)).toEqual([
          ['*', 'allow'],
          ['.git/**', 'deny'],
          [`${fs.realpathSync(repo)}/.git/agents/**`, 'allow'],
        ]);
      } finally {
        fs.rmSync(repo, { recursive: true, force: true });
      }
    });

    describe.skipIf(!hasPwsh)('opencode harness edit allow entry for the state directory', () => {
      const adapter = path.resolve(path.dirname(SCRIPT), 'harness/opencode.ps1');
      const perm = (cwd: string, override?: string) => {
        const env = { ...process.env };
        delete env.DROMOS_STATE_DIR;
        if (override !== undefined) env.DROMOS_STATE_DIR = override;
        return spawnSync('pwsh', ['-NoProfile', '-Command', `& '${adapter}' -Issue 1 | ForEach-Object { $_.Environment.OPENCODE_PERMISSION }`], { encoding: 'utf8', cwd, env });
      };
      it.each(['/tmp/st*', '/tmp/a?b', '/tmp/{x,y}', '/tmp/[ab]', '/'])('refuses the override %s', (o) => {
        const r = perm(os.tmpdir(), o);
        expect(r.status).not.toBe(0);
        expect(r.stdout + r.stderr).toContain('Refusing the edit allow entry');
      });
      describe('refuses an override that equals or contains the repository, HOME or the git dir', () => {
        let base: string;
        let repo: string;
        let home: string;
        const permIn = (override: string) => {
          const env = { ...process.env, HOME: home, DROMOS_STATE_DIR: override };
          return spawnSync('pwsh', ['-NoProfile', '-Command', `& '${adapter}' -Issue 1 | ForEach-Object { $_.Environment.OPENCODE_PERMISSION }`], { encoding: 'utf8', cwd: repo, env });
        };
        beforeAll(() => {
          base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'oc-guard-')));
          home = path.join(base, 'home');
          repo = path.join(home, 'src', 'repo');
          fs.mkdirSync(repo, { recursive: true });
          spawnSync('git', ['init', '-q'], { cwd: repo });
          fs.symlinkSync(repo, path.join(base, 'link'));
        });
        afterAll(() => fs.rmSync(base, { recursive: true, force: true }));
        it.each([
          ['the repository', () => repo],
          ['a parent of the repository', () => path.join(home, 'src') + '/'],
          ['HOME', () => home],
          ['the git dir', () => path.join(repo, '.git')],
          ['the repository through a symlink', () => path.join(base, 'link')],
          ['a relative parent of the repository', () => '..'],
        ])('%s', (_label, override) => {
          const r = permIn(override());
          expect(r.status).not.toBe(0);
          expect(r.stdout + r.stderr).toContain('equals or contains');
        });
        it('accepts a subdirectory of the git dir and one next to the repository', () => {
          for (const o of [path.join(repo, '.git', 'agents'), path.join(home, 'src', 'state')]) {
            const r = permIn(o);
            expect(r.status, r.stderr).toBe(0);
            expect(JSON.parse(r.stdout.trim()).edit[`${o}/**`]).toBe('allow');
          }
        });
      });
      it('gives the default state dir no allow entry when its path holds * or ?', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-star-'));
        try {
          const repo = path.join(base, 'a*b');
          fs.mkdirSync(repo);
          spawnSync('git', ['init', '-q'], { cwd: repo });
          const r = perm(repo);
          expect(r.status, r.stderr).toBe(0);
          expect(r.stdout + r.stderr).toContain("No edit allow entry for the state dir");
          expect(Object.entries(JSON.parse(r.stdout.trim().split('\n').pop()!).edit)).toEqual([
            ['*', 'allow'],
            ['.git/**', 'deny'],
          ]);
        } finally {
          fs.rmSync(base, { recursive: true, force: true });
        }
      });
      it('accepts a plain override and keeps its trailing slash out of the glob', () => {
        const r = perm(os.tmpdir(), '/tmp/plain-state/');
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout.trim()).edit['/tmp/plain-state/**']).toBe('allow');
      });
      it('does not refuse the default state dir of a repository whose path has glob characters', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-glob-'));
        try {
          const repo = path.join(base, 'a[1]{x}');
          fs.mkdirSync(repo);
          spawnSync('git', ['init', '-q'], { cwd: repo });
          const r = perm(repo);
          expect(r.status, r.stderr).toBe(0);
          expect(Object.keys(JSON.parse(r.stdout.trim()).edit).pop()).toMatch(/a\[1\]\{x\}\/\.git\/agents\/\*\*$/);
        } finally {
          fs.rmSync(base, { recursive: true, force: true });
        }
      });
    });

    it.each(['copilot', 'opencode'])('does not report "No adapter" for %s', (h) => {
      const r = R[`adapter ${h}`];
      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain('No adapter');
    });

    it('fails clearly for an unknown harness adapter and an invalid mode', () => {
      expect(R.unknownHarness.stderr).toContain("No adapter for harness 'nope'");
      expect(R.modeNext.status).not.toBe(0);
      expect(R.modeNext.stderr).toContain("Cannot validate argument on parameter 'Mode'");
      expect(R.modeNext.stderr).toContain('"next"');
    });
  });

  describe('-FixAdvisories', () => {
    it('puts the flag before the mode word for every harness in list mode', () => {
      expect(R.advClaude.stdout).toContain('-p "--fix-advisories medium full 12"');
      expect(R.advCopilot.stdout).toContain('-p "--fix-advisories all:security,perf full 12"');
      expect(R.advOpencode.stdout).toContain('"--fix-advisories none full 12"');
    });

    it('puts the flag before next in -Feature and -Epic mode', () => {
      expect(R.advFeature.stdout).toContain('-p "--fix-advisories medium next 10"');
      expect(R.advEpicOpencode.stdout).toContain('"--fix-advisories medium next 11"');
    });

    it('leaves the command line unchanged without the parameter', () => {
      expect(R.default.stdout).not.toContain('--fix-advisories');
      expect(R['adapter copilot'].stdout).not.toContain('--fix-advisories');
    });

    it('accepts the bare all policy and dimension lists', () => {
      expect(R.advAll.status).toBe(0);
      expect(R.advAll.stdout).toContain('-p "--fix-advisories all full 12"');
      expect(R.advOneDim.stdout).toContain('-p "--fix-advisories medium:security full 12"');
      expect(R.advTwoDims.stdout).toContain('-p "--fix-advisories medium:dim-a,dim-b full 12"');
    });

    it('keeps the flag before an explicit mode word', () => {
      expect(R.advPlan.stdout).toContain('-p "--fix-advisories all plan 12"');
    });

    it('puts the flag before next for claude -Epic and copilot -Feature', () => {
      expect(R.advEpicClaude.stdout).toContain('-p "--fix-advisories all next 11"');
      expect(R.advFeatureCopilot.stdout).toContain('-p "--fix-advisories none next 10"');
    });

    it('applies the flag to every issue of a multi-issue list', () => {
      expect(R.advTwoIssues.stdout).toContain('-p "--fix-advisories medium full 12"');
      expect(R.advTwoIssues.stdout).toContain('-p "--fix-advisories medium full 13"');
    });

    it.each([0, 1, 2, 3, 4, 5, 6])('rejects injection or malformed value (advBad%i)', (i) => {
      expect(R[`advBad${i}`].status).not.toBe(0);
      expect(R[`advBad${i}`].stderr).toContain(`Cannot validate argument on parameter 'FixAdvisories'`);
    });

    it.each(['advBad', 'advBadPolicy', 'advBadUpper', 'advBadDimCase', 'advBadDimUnderscore', 'advBadDimDigit'])('rejects invalid value (%s)', (k) => {
      expect(R[k].status).not.toBe(0);
      expect(R[k].stderr).toContain(`Cannot validate argument on parameter 'FixAdvisories'`);
    });
  });

  describe('-Status (dry run and validation)', () => {
    it('prints the status command per harness and writes nothing', () => {
      expect(R.statusDry.status).toBe(0);
      expect(R.statusDry.stdout).toContain('[dry-run] Status #248: claude --agent orchestrator -p "status 248" --allowedTools ');
      expect(R.statusCopilot.stdout).toContain('[dry-run] Status #248: copilot -p "status 248"');
      expect(R.statusOpencode.stdout).toContain('opencode run --agent orchestrator');
      expect(R.statusOpencode.stdout).toContain('"status 248"');
      expect(fs.existsSync(path.join(dirOf.statusDry, '.agents'))).toBe(false);
    });

    it.each([
      ['statusWithIssue', 'issue numbers'],
      ['statusWithFeature', '-Feature/-Epic'],
      ['statusWithMode', '-Mode'],
      ['statusWithMerge', '-MergeApproved'],
      ['statusWithContinue', '-ContinueOnError'],
      ['statusWithFix', '-FixAdvisories'],
      ['statusWithLabel', '-Label'],
      ['statusWithTrusted', '-TrustedOnly'],
    ])('rejects %s', (key, word) => {
      expect(R[key].status).not.toBe(0);
      expect(R[key].stderr).toContain('-Status cannot be combined with');
      expect(R[key].stderr).toContain(word);
    });

    it('rejects a non-numeric number', () => {
      expect(R.statusBad.status).not.toBe(0);
    });
  });

  describe('Feature and Epic queue mode (dry run and validation)', () => {
    it('dry run prints one next command and writes nothing', () => {
      const r = R.featureDry;
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('[dry-run] Feature #10: claude --agent orchestrator -p "next 10" --allowedTools ');
      expect(fs.existsSync(path.join(dirOf.featureDry, '.agents'))).toBe(false);
      // nothing leaked into the test process' own working directory either
      for (const f of ['queue-10.json', 'queue-11.json']) expect(fs.existsSync(path.join(process.cwd(), '.agents', f))).toBe(false);
      expect(R.epicCopilotDry.stdout).toContain('copilot -p "next 11"');
    });

    it('rejects -Feature with -Epic, issue numbers or an explicit -Mode', () => {
      expect(R.featureAndEpic.status).not.toBe(0);
      expect(R.featureAndEpic.stderr).toContain('Pass either -Feature or -Epic');
      expect(R.featureWithIssue.status).not.toBe(0);
      expect(R.featureWithIssue.stderr).toContain('cannot be combined with issue numbers');
      const r = R.featureWithMode;
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('-Mode cannot be combined');
    });
  });
});

describe.skipIf(!hasPwsh || !posix)('Install-QueueLauncher.ps1 launcher text (-Show), also the Windows variant, text-level only', () => {
  // both flavors from one pwsh process
  let sh: string;
  let cmd: string;
  let home: string;
  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'qshow-'));
    const r = spawnSync(
      'pwsh',
      ['-NoProfile', '-Command', `& '${INSTALLER}' -Show -Flavor sh; '<<<SPLIT>>>'; & '${INSTALLER}' -Show -Flavor cmd`],
      { encoding: 'utf8', cwd: home, env: isolatedEnv(home) },
    );
    expect(r.status).toBe(0);
    [sh, cmd] = r.stdout.split(/<<<SPLIT>>>\r?\n?/);
  });
  afterAll(() => fs.rmSync(home, { recursive: true, force: true }));
  const norm = (d: string) => d.replace(/\$top|%TOP%/g, 'TOP').replace(/\$HOME|%USERPROFILE%/g, 'HOME').replace(/\\/g, '/');
  const dirsOf = (text: string, re: RegExp) => [...(text.match(re)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => norm(m[1]));

  it('the cmd launcher uses setlocal so cd /d does not leak, and returns the exit code', () => {
    expect(cmd).toMatch(/^@echo off\r\nsetlocal\r\n/);
    expect(cmd.indexOf('setlocal')).toBeLessThan(cmd.indexOf('cd /d'));
    expect(cmd).toContain('endlocal & exit /b %ERRORLEVEL%');
    expect(cmd).toContain('QUEUE_RUNNER');
  });

  it('sh and cmd search the same seven directories in the same order', () => {
    const fromSh = dirsOf(sh, /for base in([\s\S]*?); do/);
    const fromCmd = dirsOf(cmd, /for %%b in \((.*)\) do/);
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

describe('orchestrator agent', () => {
  it('writes Ledger complete. through Add-LedgerLine.ps1 before the final report line', () => {
    const body = fs.readFileSync(AGENT, 'utf8');
    expect(body).toContain('Ledger complete.');
    expect(body).toContain('Add-LedgerLine.ps1');
  });
});
