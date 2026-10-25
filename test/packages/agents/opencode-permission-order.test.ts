import * as fs from 'fs';
import * as path from 'path';

const agentsDir = path.resolve(__dirname, '../../../packages/agents/.apm/agents');
const decisions = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fixtures/opencode-decisions.json'), 'utf-8')
);

type Rule = [string, string];

/** OpenCode: the last rule whose glob matches wins; no match means ask. */
function decide(rules: Rule[], command: string): string {
  let result = 'ask';
  for (const [glob, value] of rules) {
    const re = new RegExp(
      '^' + glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
    );
    if (re.test(command)) result = value;
  }
  return result;
}

/** Map-valued entries (bash, task, ...) of metadata.opencode.permission with their ordered rules. */
function permissionMaps(source: string): Record<string, Rule[]> {
  const lines = source
    .replace(/\r\n/g, '\n')
    .match(/^---\n([\s\S]*?)\n---\n/)![1]
    .split('\n');
  const start = lines.findIndex((l) => /^\s*permission:\s*$/.test(l));
  if (start < 0) return {};
  const base = lines[start].search(/\S/);
  const maps: Record<string, Rule[]> = {};
  let current: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const indent = line.search(/\S/);
    if (indent <= base) break;
    if (indent === base + 2) {
      const m = line.match(/^\s*([\w-]+):(.*)$/);
      if (!m) throw new Error(`unparsable permission line: ${line}`);
      current = m[2].trim() === '' ? m[1] : null;
      if (current) maps[current] = [];
    } else if (current) {
      const m = line.match(/^\s*"?([^":]+)"?:\s*(allow|deny|ask)\s*$/);
      if (!m) throw new Error(`unparsable rule line in ${current}: ${line}`);
      maps[current].push([m[1].trim(), m[2]]);
    }
  }
  return maps;
}

const agents = fs
  .readdirSync(agentsDir)
  .filter((f) => f.endsWith('.agent.md'))
  .map(
    (f) =>
      [
        f.replace('.agent.md', ''),
        permissionMaps(fs.readFileSync(path.join(agentsDir, f), 'utf-8')),
      ] as const
  );

describe('OpenCode permission map order (last matching rule wins)', () => {
  it('recorded probe: a catch-all deny last denies the allowed command, which removes the tool', () => {
    const probe = decisions['probe.catch-all-last'];
    const rules = Object.entries(probe.map) as Rule[];
    // observed on opencode 1.18.3: the allow is shadowed, the tool is gone
    expect(probe.outcome).toBe('tool-removed');
    expect(decide(rules, probe.command)).toBe('deny');
    // the same rules with the catch-all first keep the allow
    expect(decide([rules[1], rules[0]], probe.command)).toBe('allow');
  });

  it('fails on a rule line it cannot parse', () => {
    const bad =
      '---\nmetadata:\n  opencode:\n    permission:\n      bash:\n        git *: maybe\n---\n';
    expect(() => permissionMaps(bad)).toThrow(/unparsable/);
  });

  it('parses CRLF frontmatter', () => {
    const src =
      '---\r\nmetadata:\r\n  opencode:\r\n    permission:\r\n      bash:\r\n        "*": deny\r\n        "git *": allow\r\n---\r\n';
    expect(permissionMaps(src).bash).toEqual([
      ['*', 'deny'],
      ['git *', 'allow'],
    ]);
  });

  it('parses the bash map of the known agents', () => {
    const planner = agents.find(([n]) => n === 'planner')![1];
    expect(planner.bash[0]).toEqual(['*', 'deny']);
    expect(agents.length).toBeGreaterThanOrEqual(9);
  });

  it.each(agents)(
    '%s: every map keeps its tool reachable and a "*" rule comes first',
    (_n, maps) => {
      for (const rules of Object.values(maps)) {
        expect(rules.length).toBeGreaterThan(0);
        expect(rules[rules.length - 1]).not.toEqual(['*', 'deny']);
        const star = rules.findIndex(([k]) => k === '*');
        if (star >= 0) expect(star).toBe(0);
        // a map with a catch-all and specific allows must resolve at least one allow
        if (rules.some(([k, v]) => k !== '*' && v === 'allow')) {
          const allow = rules.find(([k, v]) => k !== '*' && v === 'allow')![0];
          expect(decide(rules, allow.replace(/\*/g, 'x'))).toBe('allow');
        }
      }
    }
  );

  it.each(['reviewer', 'review-lead'])(
    '%s: git diff/log/show cannot write files via --output',
    (name) => {
      const bash = agents.find(([n]) => n === name)![1].bash;
      expect(decide(bash, 'git diff --output=/tmp/x main')).toBe('deny');
      expect(decide(bash, 'git log --output=/tmp/x')).toBe('deny');
      expect(decide(bash, 'git show --output=/tmp/x HEAD')).toBe('deny');
      expect(decide(bash, 'git diff main...HEAD')).toBe('allow');
    }
  );

  it('pr-writer: bash allows are narrowed to the github-pull-request commands', () => {
    const bash = agents.find(([n]) => n === 'pr-writer')![1].bash;
    expect(decide(bash, 'gh pr create --title t --base b')).toBe('allow');
    expect(decide(bash, 'git push -u origin HEAD')).toBe('allow');
    expect(decide(bash, 'git log origin/main..HEAD --oneline')).toBe('allow');
    expect(decide(bash, 'git commit -m x')).toBe('deny');
    expect(decide(bash, 'git push --force origin main')).toBe('deny');
    expect(decide(bash, 'gh pr merge 1 --auto')).toBe('deny');
    expect(decide(bash, 'gh issue close 1')).toBe('deny');
    expect(decide(bash, 'git branch --show-current')).toBe('allow');
    expect(decide(bash, 'git branch -D main')).toBe('deny');
    expect(decide(bash, 'git branch -m old new')).toBe('deny');
    expect(decide(bash, 'git remote -v')).toBe('allow');
    expect(decide(bash, 'git remote set-url origin x')).toBe('deny');
    expect(decide(bash, 'git fetch origin release/next')).toBe('allow');
    expect(decide(bash, 'git fetch --upload-pack=x origin')).toBe('deny');
    expect(decide(bash, 'gh pr edit 5 --add-reviewer @copilot')).toBe('allow');
    expect(decide(bash, 'gh pr edit 5 --title x')).toBe('deny');
    expect(decide(bash, 'git diff --output=/tmp/x')).toBe('deny');
    expect(decide(bash, 'git log --output=/tmp/x')).toBe('deny');
  });
});
