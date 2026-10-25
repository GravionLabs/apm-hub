import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
import { PwshWorker } from '../../helpers/pwsh-worker';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');
const script = path.join(pk, 'shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1');

const orchestratorAgent = read('agents/.apm/agents/orchestrator.agent.md');
// steps 0-6 and per-PBI rules live in the pipeline reference
const orchestrator =
  orchestratorAgent + '\n' + read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
const issueReader = read('agents/.apm/agents/issue-reader.agent.md');
const taskIssues = read('github/.apm/skills/github-issue/references/task-issues.md');
const planning = read('delivery/.apm/skills/issue-planning/SKILL.md');
const detect = read('shared/.apm/skills/detect-techstack/SKILL.md');

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
const T = 30000;

/** First `git ...` command line found in a fenced or inline code span of the markdown that matches `needle`. */
function commandFrom(md: string, needle: string): string {
  const m = md.match(new RegExp('`(git [^`]*' + needle + '[^`]*)`'));
  if (!m) throw new Error('command not found in markdown: ' + needle);
  expect(m[1]).toContain('<task>');
  expect(m[1]).toContain('<integration-branch>');
  return m[1];
}

describe('orchestrator state: contract strings (docs)', () => {
  it('pwsh is available (required in CI)', () => {
    if (process.env.CI) expect(hasPwsh).toBe(true);
  });

  it('orchestrator refers to the one merged-task rule and never re-plans when all tasks are merged', () => {
    expect(orchestrator).toContain('"Task merged"');
    expect(orchestrator).toContain('task-issues.md');
    expect(orchestrator).toContain('none open (all merged)');
    // the sub-issue query and the merged grep run in the issue-reader; the orchestrator keeps only the flags
    expect(orchestrator).toContain('`issue-reader`');
    expect(orchestrator).toContain('merged: true');
    expect(orchestrator).not.toContain('api --paginate');
    expect(issueReader).toContain('{n:.number,state:.state}');
    expect(issueReader).toContain('api --paginate');
    expect(issueReader).toContain('"Task merged"');
    expect(orchestrator.indexOf('Read the issue')).toBeLessThan(
      orchestrator.indexOf('Task merged')
    );
  });

  it('orchestrator loads detect-techstack inline without hard-coding the script', () => {
    expect(orchestrator).toContain('`detect-techstack` inline (never a forked subagent)');
    expect(orchestrator).toContain('`Ruling:`');
    // the body must not hard-code it; the permission map in the frontmatter allows the scan like planner does
    expect(orchestrator.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')).not.toContain(
      'Detect-TechStack.ps1'
    );
  });

  it('the merged-task rule lives once in task-issues.md; issue-planning refers to it', () => {
    expect(taskIssues).toContain('gh issue close <task> --comment "Merged into <branch> in <sha>"');
    const fetchAt = taskIssues.indexOf('git fetch origin <integration-branch>');
    expect(fetchAt).toBeGreaterThanOrEqual(0);
    expect(fetchAt).toBeLessThan(taskIssues.indexOf('--grep'));
    expect(taskIssues).toContain('`^[0-9]+$`');
    expect(orchestrator).not.toContain('gh issue close');
    expect(issueReader).not.toContain('gh issue close');
    expect(planning).toContain('Task merged');
    expect(planning).not.toContain('--grep');
  });

  it('the SKILL.md manifest list matches the script list', () => {
    const list = detect.match(/manifests the script reads \(([^)]*)\)/)![1];
    const docList = [...list.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    expect([...docList].sort()).toEqual([...script_manifests()].sort());
  });
});

function script_manifests(): string[] {
  const src = fs.readFileSync(script, 'utf-8');
  const block = src.match(/\$manifestFilters = @\(([\s\S]*?)\n\)/)![1];
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('merged-task check (command read from task-issues.md)', () => {
  let dir: string;
  const git = (...a: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
      cwd: dir,
      encoding: 'utf-8',
    });
  const grepArgs = (task: string, range: string) => {
    const cmd = commandFrom(taskIssues, '--grep');
    expect(cmd).toContain('"^Refs #<task>$"');
    expect(cmd).toContain('origin/<integration-branch>');
    const words = cmd
      .replace('git ', '')
      .replace('"^Refs #<task>$"', `"^Refs #${task}$"`)
      .replace('origin/<integration-branch>', range)
      .match(/"[^"]*"|\S+/g)!;
    return words.map((w) => w.replace(/^"|"$/g, ''));
  };
  const find = (task: string, range: string) => git(...grepArgs(task, range)).trim();

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merged-'));
    git('init', '-q', '-b', 'release/1.0');
    git('commit', '-q', '--allow-empty', '-m', 'feat: a (#1)\n\nRefs #7');
    git(
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'feat: c (#1)\n\nsome body\nmore body\n\nRefs #123\nCo-Authored-By: x <x@x>'
    );
    git('update-ref', 'refs/remotes/origin/release/1.0', 'HEAD');
    git('commit', '-q', '--allow-empty', '-m', 'feat: b (#2)\n\nRefs #8');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('finds a Task commit on the remote branch beyond ..HEAD', () => {
    expect(find('7', 'origin/release/1.0')).not.toBe('');
    expect(find('8', 'origin/release/1.0')).toBe('');
    expect(find('8', 'origin/release/1.0..HEAD')).not.toBe('');
    expect(find('7', 'origin/release/1.0..HEAD')).toBe('');
  });

  it('does not match #12 against #123 and finds footers in multi-line bodies', () => {
    expect(find('12', 'origin/release/1.0')).toBe('');
    expect(find('123', 'origin/release/1.0')).not.toBe('');
  });
});

describe.skipIf(!hasPwsh)('Detect-TechStack.ps1 cache', () => {
  let dir: string;
  // One pwsh worker for the whole describe runs the script in-process for every call (instead of one pwsh start per call).
  let worker: PwshWorker;
  beforeAll(() => {
    worker = new PwshWorker(script);
  });
  afterAll(() => worker.close());
  const run = async (...extra: string[]) => {
    const r = await worker.run(['-ProjectRoot', dir, ...extra], { cwd: dir });
    if (r.status !== 0) throw new Error(`Detect-TechStack exited ${r.status}: ${r.stderr}`);
    return JSON.parse(r.stdout) as { languages: string[]; tools: string[]; manifest_hash: string };
  };
  const cacheFile = () => path.join(dir, '.git/agents/techstack.json');
  const excludeFile = () => path.join(dir, '.git/info/exclude');
  const poison = (extra: object = {}) => {
    const cur = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...cur, languages: ['cached'], ...extra }));
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'techstack-'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it(
    'writes the cache under the git dir, leaves the exclude file alone and reuses it while manifests are unchanged',
    { timeout: T },
    async () => {
      const first = await run();
      expect(first.languages).toEqual(['ts']);
      expect(first.manifest_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).manifest_hash).toBe(
        first.manifest_hash
      );
      expect(fs.readFileSync(excludeFile(), 'utf-8')).not.toContain('.agents');
      poison();
      expect((await run()).languages).toEqual(['cached']);
    }
  );

  it('recomputes with -NoCache and when a manifest is edited', { timeout: T }, async () => {
    const first = await run();
    poison();
    expect((await run('-NoCache')).languages).toEqual(['ts']);
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}');
    poison();
    const edited = await run();
    expect(edited.manifest_hash).not.toBe(first.manifest_hash);
    expect(edited.languages).toEqual(['ts']);
  });

  it('recomputes when a manifest is added, nested or removed', { timeout: T }, async () => {
    const first = await run();
    fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]');
    poison();
    const added = await run();
    expect(added.manifest_hash).not.toBe(first.manifest_hash);
    expect(added.languages).toContain('py');

    fs.mkdirSync(path.join(dir, 'svc/api'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'svc/api/App.csproj'), '<Project/>');
    poison();
    const nested = await run();
    expect(nested.manifest_hash).not.toBe(added.manifest_hash);
    expect(nested.languages).toContain('dotnet');

    fs.rmSync(path.join(dir, 'pyproject.toml'));
    poison();
    const removed = await run();
    expect(removed.manifest_hash).not.toBe(nested.manifest_hash);
    expect(removed.languages).not.toContain('py');
  });

  it('recomputes when a tool config file appears', { timeout: T }, async () => {
    const first = await run();
    expect(first.tools).toEqual([]);
    fs.writeFileSync(path.join(dir, 'biome.json'), '{}');
    poison();
    const added = await run();
    expect(added.tools).toEqual(['biome']);
    expect(added.manifest_hash).not.toBe(first.manifest_hash);
    expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).tools).toEqual(['biome']);
  });

  it('ignores a cache with the wrong shape or hash', { timeout: T }, async () => {
    const first = await run();
    const cur = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
    const { languages, ...noLanguages } = cur;
    void languages;
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...noLanguages, test: ['x'] }));
    expect((await run()).languages).toEqual(['ts']);
    poison({ manifest_hash: 'deadbeef' });
    expect((await run()).languages).toEqual(['ts']);
    const { test: t, ...noTest } = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
    void t;
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...noTest, languages: ['cached'] }));
    expect((await run()).languages).toEqual(['ts']);
    expect((await run()).manifest_hash).toBe(first.manifest_hash);
  });

  it(
    'invalidates a cache holding the hash computed without the schema version prefix',
    { timeout: T },
    async () => {
      const first = await run();
      const entries = ['package.json', 'tsconfig.json'].map(
        (f) =>
          `${f}:${createHash('sha256')
            .update(fs.readFileSync(path.join(dir, f)))
            .digest('hex')
            .toUpperCase()}`
      );
      const legacy = createHash('sha256').update(entries.sort().join('\n')).digest('hex');
      expect(legacy).not.toBe(first.manifest_hash);
      poison({ manifest_hash: legacy });
      const r = await run();
      expect(r.languages).toEqual(['ts']);
      expect(r.manifest_hash).toBe(first.manifest_hash);
    }
  );

  it.each([
    ['uppercase entry', { languages: ['TS'] }],
    ['entry with a path', { implementation: ['../evil'] }],
    ['entry with a space', { test: ['ts-test rm'] }],
    ['non-string entry', { languages: [1] }],
    ['scalar instead of array', { test: 'ts-test' }],
    ['bad packageManager', { packageManager: ['pnpm; x'] }],
    ['bad tools', { tools: ['Vitest; x'] }],
  ])(
    'recomputes and rewrites a cache with an invalid value (%s)',
    { timeout: T },
    async (_n, bad) => {
      const first = await run();
      poison(bad);
      expect((await run()).languages).toEqual(['ts']);
      const rewritten = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
      expect(rewritten.languages).toEqual(['ts']);
      expect(rewritten.manifest_hash).toBe(first.manifest_hash);
    }
  );

  it.skipIf(process.platform === 'win32')(
    'does not read or write through a symlinked state directory',
    { timeout: T },
    async () => {
      const target = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-target-'));
      try {
        fs.symlinkSync(target, path.join(dir, '.git/agents'));
        expect((await run()).languages).toEqual(['ts']);
        expect(fs.readdirSync(target)).toEqual([]);
        fs.writeFileSync(
          path.join(target, 'techstack.json'),
          JSON.stringify({
            languages: ['cached'],
            test: [],
            implementation: [],
            manifest_hash: 'x',
          })
        );
        expect((await run()).languages).toEqual(['ts']);
        expect(fs.readdirSync(target)).toEqual(['techstack.json']);
      } finally {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  );

  it(
    'recovers from a corrupt cache and reports an empty stack as arrays',
    { timeout: T },
    async () => {
      fs.rmSync(path.join(dir, 'package.json'));
      fs.rmSync(path.join(dir, 'tsconfig.json'));
      fs.mkdirSync(path.join(dir, '.git/agents'));
      fs.writeFileSync(cacheFile(), 'not json');
      const r = await run();
      expect(r.languages).toEqual([]);
      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).languages).toEqual([]);
    }
  );

  // runs in the shared worker: the script ends with `exit 1`, which the worker reports like `pwsh -File` (status 1)
  it('fails for a missing project root', { timeout: T }, async () => {
    const res = await worker.run(['-ProjectRoot', path.join(dir, 'nope')], { cwd: dir });
    expect(res.status).toBe(1);
  });
});

describe('orchestrator flags: overview and review summary', () => {
  const gates = read('github/.apm/skills/github-issue/references/orchestrator-gates.md');
  const prompt = read('delivery/.apm/prompts/orch.prompt.md');
  const working = fs.readFileSync(
    path.resolve(__dirname, '../../../docs/working-mode.md'),
    'utf-8'
  );

  it.each([
    ['agent', orchestrator],
    ['working-mode', working],
    ['gates reference', gates],
  ])('%s documents both flags', (_n, md) => {
    expect(md).toContain('--no-overview');
    expect(md).toContain('--no-review-summary');
  });

  it.each([
    ['working-mode', working],
    [
      'orchestrator doc',
      fs.readFileSync(path.resolve(__dirname, '../../../docs/orchestrator.md'), 'utf-8'),
    ],
    ['launcher skill', read('agents/.apm/skills/orchestrator/SKILL.md')],
  ])('%s documents --fix-advisories', (_n, md) => {
    expect(md).toContain('--fix-advisories');
  });

  it('working-mode lists the policies and the headless Gate removal', () => {
    expect(working).toMatch(/--fix-advisories none\\\|medium\\\|all/);
    expect(working).toMatch(
      /--fix-advisories` set or the `--advisory-rounds` limit reached, the review summary writes no `Gate:`/
    );
    expect(working).toContain('documented there once #227 lands');
  });

  it('orch prompt is a one-line deprecation pointing to the agent', () => {
    const [, frontmatter, ...rest] = prompt.split(/^---$/m);
    expect(frontmatter).toMatch(/^description: "Deprecated, use the orchestrator agent/m);
    expect(prompt).toContain('--agent orchestrator');
    expect(rest.join('---').trim().split('\n')).toHaveLength(1);
  });

  it('agent states the defaults and delegates to the reference', () => {
    expect(orchestrator).toContain('neither an issue number nor a description');
    expect(orchestrator).toContain('orchestrator-gates.md');
  });

  it('overview runs only without issue number and description', () => {
    expect(gates).toContain('only when the first message has no issue number and no description');
    expect(gates).not.toContain('a sentence without');
    expect(working).toContain('neither an issue number nor a description');
  });

  it('--no-review-summary: only blocking findings trigger fix rounds', () => {
    expect(gates).toMatch(/With `--no-review-summary` only blocking findings trigger fix rounds/);
    expect(gates).toContain('`incomplete: true` stays blocking');
    expect(gates).toContain('followed by a re-review');
  });

  it('--fix-advisories policy table, ledger line, alias and validation', () => {
    expect(gates).toContain('--fix-advisories none|medium|all[:dim,dim]');
    expect(gates).toContain('| `none` | no advisory | all advisories |');
    expect(gates).toContain('| `medium` | MEDIUM and above (CRITICAL, HIGH, MEDIUM) | LOW |');
    expect(gates).toContain('| `all` | every advisory | none |');
    expect(gates).toContain('Advisory policy: <policy> — fixing <n>, PR body <m>');
    expect(gates).toContain('Ruling: advisory policy <policy> — <n> fixed, <m> to PR body');
    expect(gates).toContain('alias of `--fix-advisories none`');
    expect(gates).toContain('^(none|medium|all)(:[a-z][a-z-]*(,[a-z][a-z-]*)*)?$');
    expect(gates).toContain('`--fix-advisories=medium` is not accepted');
    expect(gates).toMatch(/Unknown policy or dimension[^\n]*never guess/);
    expect(gates).toMatch(/Blocking findings and `incomplete: true` always go to the fix round/);
    expect(gates).toContain('never from a description, issue body or ledger content');
  });

  it('explicit policy wins over --no-review-summary, which then only hides the summary', () => {
    expect(gates).toContain(
      'the explicit policy wins and `--no-review-summary` only hides the summary display'
    );
    expect(orchestrator).toContain('it wins over `--no-review-summary`');
  });

  it('policy is re-applied per re-review and leftovers never gate', () => {
    expect(gates).toContain('re-applied to the advisories of each re-review');
    expect(gates).toContain('never trigger a `Gate:`');
  });

  it.each([
    ['working-mode', working],
    [
      'orchestrator doc',
      fs.readFileSync(path.resolve(__dirname, '../../../docs/orchestrator.md'), 'utf-8'),
    ],
  ])('%s documents --advisory-rounds', (_n, md) => {
    expect(md).toContain('--advisory-rounds');
  });

  it('agent applies the policy in step 5 and exempts it from the headless gate', () => {
    expect(orchestrator).toContain('with `--fix-advisories` apply that policy without asking');
    expect(orchestrator).toMatch(
      /Exempt: the review summary when `--fix-advisories` is set or the `--advisory-rounds` limit is reached/
    );
    expect(orchestrator).toContain('never from a description, issue body or ledger');
  });

  it('headless Gate rule in overview and review-summary sections', () => {
    const [, overview, summary] = gates.split(/^## /m);
    expect(overview).toContain('Headless:');
    expect(overview).toContain('Gate: Which issue?');
    expect(summary).toContain('Headless');
    expect(summary).toContain('Gate: <question>');
  });

  it('headless overview uses a ledger path without an issue directory', () => {
    expect(gates).toContain('`<state>/overview.md`');
    expect(gates).not.toContain('info/exclude');
  });

  it('reference reuses the merged-task rule and lists findings by severity', () => {
    expect(gates).toContain('"Task merged"');
    expect(gates).toContain('task-issues.md');
    expect(gates).toContain('severity file:line issue');
    expect(gates).toContain('blocking first');
    expect(gates).toContain('MEDIUM');
  });

  it('gates point PBIs and Features at the one merged definition in next-selection.md', () => {
    const selection = read('github/.apm/skills/github-issue/references/next-selection.md');
    expect(gates).toContain('next-selection.md');
    expect(gates).toContain('Merged (closes at release)');
    expect(selection.match(/^## Merged \(closes at release\)$/gm)).toHaveLength(1);
    expect(gates).not.toContain('git log');
    expect(gates).not.toContain('gh pr list');
    expect(gates).toMatch(/Task[^.]*"Task merged"[^.]*`task-issues\.md`/);
    expect(gates).toMatch(/PBI or Feature `Merged \(closes at release\)`/);
  });

  it('docs mention the merged drop in the end line and the next mode', () => {
    const docs = (f: string) => fs.readFileSync(path.join(pk, '../docs', f), 'utf-8');
    expect(docs('orchestrator.md')).toContain('merged, closes at release');
    expect(docs('working-mode.md')).toContain('merged, closes at release');
  });

  it('github-issue links the gates reference', () => {
    expect(read('github/.apm/skills/github-issue/SKILL.md')).toContain(
      'references/orchestrator-gates.md'
    );
  });
});

describe('agent prose: worktree-shared state directory (#402)', () => {
  const agentsDir = path.join(pk, 'agents/.apm/agents');
  const refsDir = path.join(pk, 'github/.apm/skills/github-issue/references');
  const proseFiles = [
    ...fs.readdirSync(agentsDir).map((f) => path.join(agentsDir, f)),
    ...fs.readdirSync(refsDir).map((f) => path.join(refsDir, f)),
  ];

  it('defines <state> once in the orchestrator as state_dir with the override and passes it to subagents', () => {
    expect(orchestratorAgent).toContain('`state_dir` of the `detect-techstack` JSON');
    expect(orchestratorAgent).toContain('`<git-common-dir>/agents/`');
    expect(orchestratorAgent).toContain('`DROMOS_STATE_DIR`');
    expect(orchestratorAgent).toContain('absolute `<state>`');
  });

  it('keeps state_dir from step 0 and hands it to issue-reader', () => {
    const pipeline = read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
    expect(pipeline).toContain('its `state_dir` (`<state>`');
    expect(pipeline).toContain('with `<issue>`, `<state>` and');
    expect(issueReader).toContain(
      'the `<state>` directory (cwd-relative such as `.git/agents` when it lies under the cwd, else absolute'
    );
  });

  it('no longer mentions the .git/info/exclude step in agents or references', () => {
    for (const file of proseFiles) {
      expect(fs.readFileSync(file, 'utf-8'), file).not.toContain('info/exclude');
    }
  });

  it('references the working-tree .agents/ directory only as an install path (.agents/skills)', () => {
    for (const file of proseFiles) {
      const stray = fs
        .readFileSync(file, 'utf-8')
        .replace(/\.agents\/skills/g, '')
        .match(/\.agents\b/);
      expect(stray, file).toBeNull();
    }
  });
});
