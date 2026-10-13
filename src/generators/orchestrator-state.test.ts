import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, spawnSync } from 'child_process';

const pk = path.resolve(__dirname, '../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');
const script = path.join(pk, 'shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1');

const orchestrator = read('agents/.apm/agents/orchestrator.agent.md');
const taskIssues = read('github/.apm/skills/github-issue/references/task-issues.md');
const planning = read('delivery/.apm/skills/issue-planning/SKILL.md');
const detect = read('shared/.apm/skills/detect-techstack/SKILL.md');

const pwshStatus = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
if (!pwshStatus && process.env.CI) {
  throw new Error('pwsh is required in CI for the orchestrator-state tests');
}
const hasPwsh = pwshStatus;
const T = 30000;

/** First `git ...` command line found in a fenced or inline code span of the markdown that matches `needle`. */
function commandFrom(md: string, needle: string): string {
  const m = md.match(new RegExp('`(git [^`]*' + needle + '[^`]*)`'));
  if (!m) throw new Error('command not found in markdown: ' + needle);
  return m[1];
}

describe('orchestrator state: contract strings (docs)', () => {
  it('orchestrator refers to the one merged-task rule and never re-plans when all tasks are merged', () => {
    expect(orchestrator).toContain('"Task merged"');
    expect(orchestrator).toContain('task-issues.md');
    expect(orchestrator).toMatch(/never re-plan/);
    expect(orchestrator).toContain('open or closed');
    expect(orchestrator.indexOf('Resolve the integration branch')).toBeLessThan(orchestrator.indexOf('Task merged'));
  });

  it('orchestrator loads detect-techstack inline without hard-coding the script', () => {
    expect(orchestrator).toContain('`detect-techstack` inline (never a forked subagent)');
    expect(orchestrator).toContain('`Ruling:`');
    expect(orchestrator).not.toContain('Detect-TechStack.ps1');
  });

  it('the merged-task rule lives once in task-issues.md; issue-planning refers to it', () => {
    expect(taskIssues).toContain('gh issue close <task> --comment "Merged into <branch> in <sha>"');
    expect(taskIssues).toContain('git fetch origin <integration-branch>');
    expect(taskIssues).toContain('`^[0-9]+$`');
    expect(orchestrator).not.toContain('gh issue close');
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
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf-8' });
  const grepArgs = (task: string, range: string) => {
    const cmd = commandFrom(taskIssues, '--grep');
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
    git('commit', '-q', '--allow-empty', '-m', 'feat: c (#1)\n\nsome body\nmore body\n\nRefs #123\nCo-Authored-By: x <x@x>');
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
  const run = (...extra: string[]) => {
    const out = execFileSync('pwsh', ['-NoProfile', '-File', script, '-ProjectRoot', dir, ...extra], { encoding: 'utf-8' });
    return JSON.parse(out) as { languages: string[]; manifest_hash: string };
  };
  const cacheFile = () => path.join(dir, '.agents/techstack.json');
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

  it('writes the cache, excludes .agents/ and reuses it while manifests are unchanged', { timeout: T }, () => {
    const first = run();
    expect(first.languages).toEqual(['ts']);
    expect(first.manifest_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).manifest_hash).toBe(first.manifest_hash);
    expect(fs.readFileSync(excludeFile(), 'utf-8')).toContain('.agents/');
    poison();
    expect(run().languages).toEqual(['cached']);
  });

  it('recomputes with -NoCache and when a manifest is edited', { timeout: T }, () => {
    const first = run();
    poison();
    expect(run('-NoCache').languages).toEqual(['ts']);
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}');
    poison();
    const edited = run();
    expect(edited.manifest_hash).not.toBe(first.manifest_hash);
    expect(edited.languages).toEqual(['ts']);
  });

  it('recomputes when a manifest is added, nested or removed', { timeout: T }, () => {
    const first = run();
    fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]');
    poison();
    const added = run();
    expect(added.manifest_hash).not.toBe(first.manifest_hash);
    expect(added.languages).toContain('py');

    fs.mkdirSync(path.join(dir, 'svc/api'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'svc/api/App.csproj'), '<Project/>');
    poison();
    const nested = run();
    expect(nested.manifest_hash).not.toBe(added.manifest_hash);
    expect(nested.languages).toContain('dotnet');

    fs.rmSync(path.join(dir, 'pyproject.toml'));
    poison();
    const removed = run();
    expect(removed.manifest_hash).not.toBe(nested.manifest_hash);
    expect(removed.languages).not.toContain('py');
  });

  it('ignores a cache with the wrong shape or hash', { timeout: T }, () => {
    const first = run();
    const cur = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
    const { languages, ...noLanguages } = cur;
    void languages;
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...noLanguages, test: ['x'] }));
    expect(run().languages).toEqual(['ts']);
    poison({ manifest_hash: 'deadbeef' });
    expect(run().languages).toEqual(['ts']);
    const { test: t, ...noTest } = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
    void t;
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...noTest, languages: ['cached'] }));
    expect(run().languages).toEqual(['ts']);
    expect(run().manifest_hash).toBe(first.manifest_hash);
  });

  it('adds .agents/ to the exclude file once, also after a last line without newline', { timeout: T }, () => {
    fs.mkdirSync(path.dirname(excludeFile()), { recursive: true });
    fs.writeFileSync(excludeFile(), '*.log');
    run();
    run('-NoCache');
    const lines = fs.readFileSync(excludeFile(), 'utf-8').split('\n');
    expect(lines).toContain('*.log');
    expect(lines.filter((l) => l === '.agents/')).toHaveLength(1);
  });

  it('does not touch an exclude file that already lists .agents', { timeout: T }, () => {
    fs.mkdirSync(path.dirname(excludeFile()), { recursive: true });
    fs.writeFileSync(excludeFile(), '/.agents\n');
    run();
    expect(fs.readFileSync(excludeFile(), 'utf-8')).toBe('/.agents\n');
  });

  it.skipIf(process.platform === 'win32')('does not write through a symlinked exclude file and leaves no *.tmp', { timeout: T }, () => {
    const target = path.join(dir, 'target-exclude');
    fs.writeFileSync(target, '*.log\n');
    fs.mkdirSync(path.dirname(excludeFile()), { recursive: true });
    fs.rmSync(excludeFile(), { force: true });
    fs.symlinkSync(target, excludeFile());
    run();
    expect(fs.readFileSync(target, 'utf-8')).toBe('*.log\n');
    expect(fs.readdirSync(path.join(dir, '.agents')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('recovers from a corrupt cache and reports an empty stack as arrays', { timeout: T }, () => {
    fs.rmSync(path.join(dir, 'package.json'));
    fs.rmSync(path.join(dir, 'tsconfig.json'));
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(cacheFile(), 'not json');
    const r = run();
    expect(r.languages).toEqual([]);
    expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).languages).toEqual([]);
  });

  it('fails for a missing project root', { timeout: T }, () => {
    const res = spawnSync('pwsh', ['-NoProfile', '-File', script, '-ProjectRoot', path.join(dir, 'nope')]);
    expect(res.status).not.toBe(0);
  });
});
