import * as fs from 'fs';
import * as path from 'path';

const agentsDir = path.resolve(__dirname, '../../../packages/agents/.apm/agents');
const decisions = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fixtures/opencode-decisions.json'), 'utf-8')
);

type Rule = [string, string];

/** Map-valued entries (bash, task, ...) of metadata.opencode.permission with their ordered rules. */
function permissionMaps(source: string): Record<string, Rule[]> {
  const lines = source.match(/^---\n([\s\S]*?)\n---\n/)![1].split('\n');
  const start = lines.findIndex((l) => /^\s*permission:\s*$/.test(l));
  if (start < 0) return {};
  const base = lines[start].search(/\S/);
  const maps: Record<string, Rule[]> = {};
  let current: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue;
    const indent = line.search(/\S/);
    if (indent <= base) break;
    if (indent === base + 2) {
      const m = line.match(/^\s*([\w-]+):\s*$/);
      current = m ? m[1] : null;
      if (current) maps[current] = [];
    } else if (current) {
      const m = line.match(/^\s*"?([^":]+)"?:\s*(allow|deny|ask)\s*$/);
      if (m) maps[current].push([m[1], m[2]]);
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
  it('recorded probe: a catch-all deny last removes the tool', () => {
    // Why the order rule exists: observed on opencode 1.18.3, not derived from our code.
    expect(decisions['probe.catch-all-last'].outcome).toBe('tool-removed');
  });

  it('parses the bash map of the known agents', () => {
    const planner = agents.find(([n]) => n === 'planner')![1];
    expect(planner.bash[0]).toEqual(['*', 'deny']);
    expect(agents.length).toBeGreaterThanOrEqual(9);
  });

  it.each(agents)(
    '%s: no map ends with a catch-all deny and a "*" rule comes first',
    (_n, maps) => {
      for (const [, rules] of Object.entries(maps)) {
        if (rules.length < 2) continue;
        expect(rules[rules.length - 1]).not.toEqual(['*', 'deny']);
        const star = rules.findIndex(([k]) => k === '*');
        if (star >= 0) expect(star).toBe(0);
      }
    }
  );
});
