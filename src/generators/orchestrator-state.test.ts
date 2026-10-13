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

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe('orchestrator state: merged tasks and stack cache (docs)', () => {
  it('orchestrator filters open Task sub-issues and closes merged ones', () => {
    expect(orchestrator).toContain('select(.state=="open")');
    expect(orchestrator).toContain('git log -E --grep "^Refs #<task>$" origin/<integration-branch> --format=%h -1');
    expect(orchestrator).toContain('gh issue close <task> --comment "Merged into <branch> in <sha>"');
    expect(orchestrator).toMatch(/merged check of step 1/);
  });

  it('orchestrator runs the cached stack detection in the main context with a NoCache retry', () => {
    expect(orchestrator).toContain('Detect-TechStack.ps1');
    expect(orchestrator).toContain('.agents/techstack.json');
    expect(orchestrator).toContain('-NoCache');
    expect(orchestrator).toMatch(/never a forked subagent/);
    expect(orchestrator).toMatch(/`Ruling:`/);
  });

  it('task-issues, issue-planning and detect-techstack document the rule', () => {
    expect(taskIssues).toContain('Task merged (any run)');
    expect(taskIssues).toContain('Merged into <branch> in <sha>');
    expect(planning).toContain('select(.state=="open")');
    expect(planning).toMatch(/skip Task issues already merged/);
    expect(detect).toContain('.agents/techstack.json');
    expect(detect).toContain('manifest_hash');
    expect(detect).toContain('-NoCache');
  });

  it('the merged check finds a Task commit on the remote branch beyond ..HEAD', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merged-'));
    try {
      const git = (...a: string[]) =>
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf-8' });
      git('init', '-q', '-b', 'release/1.0');
      git('commit', '-q', '--allow-empty', '-m', 'feat: a (#1)\n\nRefs #7');
      git('update-ref', 'refs/remotes/origin/release/1.0', 'HEAD');
      git('commit', '-q', '--allow-empty', '-m', 'feat: b (#2)\n\nRefs #8');
      const find = (n: string, range: string) =>
        git('log', '-E', '--grep', `^Refs #${n}$`, '--format=%h', '-1', range).trim();
      expect(find('7', 'origin/release/1.0')).not.toBe('');
      expect(find('7', 'origin/release/1.0..HEAD')).toBe('');
      expect(find('8', 'origin/release/1.0')).toBe('');
      expect(find('8', 'origin/release/1.0..HEAD')).not.toBe('');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!hasPwsh)('Detect-TechStack.ps1 cache', () => {
  let dir: string;
  const run = (...extra: string[]) => {
    const out = execFileSync('pwsh', ['-NoProfile', '-File', script, '-ProjectRoot', dir, ...extra], { encoding: 'utf-8' });
    return JSON.parse(out) as { languages: string[]; manifest_hash: string };
  };
  const cacheFile = () => path.join(dir, '.agents/techstack.json');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'techstack-'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('writes the cache, excludes .agents/ and reuses it while manifests are unchanged', () => {
    const first = run();
    expect(first.languages).toEqual(['ts']);
    expect(first.manifest_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).manifest_hash).toBe(first.manifest_hash);
    expect(fs.readFileSync(path.join(dir, '.git/info/exclude'), 'utf-8')).toContain('.agents/');

    // a tampered cache with the matching hash is served as is
    const tampered = { ...first, languages: ['cached'] };
    fs.writeFileSync(cacheFile(), JSON.stringify(tampered));
    expect(run().languages).toEqual(['cached']);
  });

  it('recomputes when a manifest changes and with -NoCache', () => {
    const first = run();
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...first, languages: ['cached'] }));
    expect(run('-NoCache').languages).toEqual(['ts']);

    fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]');
    const changed = run();
    expect(changed.manifest_hash).not.toBe(first.manifest_hash);
    expect(changed.languages).toContain('py');
  });

  it('recovers from a corrupt cache and reports an empty stack as arrays', () => {
    fs.rmSync(path.join(dir, 'package.json'));
    fs.rmSync(path.join(dir, 'tsconfig.json'));
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.writeFileSync(cacheFile(), 'not json');
    const r = run();
    expect(r.languages).toEqual([]);
    expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).languages).toEqual([]);
  });

  it('fails for a missing project root', () => {
    const res = spawnSync('pwsh', ['-NoProfile', '-File', script, '-ProjectRoot', path.join(dir, 'nope')]);
    expect(res.status).not.toBe(0);
  });
});
