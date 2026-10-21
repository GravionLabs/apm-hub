import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const agentsDir = path.resolve(__dirname, '../../../packages/agents/.apm/agents');
const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.agent.md'));

function bashRules(file: string): [string, string][] {
  const text = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fm) throw new Error(`No frontmatter found in ${file}`);
  const bash = parse(fm[1])?.metadata?.opencode?.permission?.bash;
  return bash && typeof bash === 'object' ? Object.entries(bash as Record<string, string>) : [];
}

// OpenCode pattern semantics (docs/working-mode.md, spike #222): `*` matches any characters including `/`, everything else is literal.
const matches = (pattern: string, command: string) =>
  new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 's').test(command);
const allowedBy = (rules: [string, string][], command: string) => {
  let result = 'none';
  for (const [p, a] of rules) if (matches(p, command)) result = a;
  return result === 'allow';
};

describe('OpenCode bash allow rules and the state directory', () => {
  it.each(agentFiles)('%s has no allow rule with a bare leading `*` or a `..`', (file) => {
    const allowed = bashRules(file).filter(([, a]) => a === 'allow').map(([p]) => p);
    expect(allowed.filter((p) => p.startsWith('*') || p.includes('..'))).toEqual([]);
  });

  it.each([
    ['planner.agent.md', ['mkdir -p ', 'cat > ']],
    ['issue-reader.agent.md', ['mkdir -p ', 'gh issue view * > ']],
  ])('%s roots every state write rule on the cwd-relative .git/agents/', (file, prefixes) => {
    const writes = bashRules(file)
      .filter(([p, a]) => a === 'allow' && (p.startsWith('mkdir') || p.includes('>')))
      .map(([p]) => p);
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(prefixes.some((pre) => w.startsWith(pre + '.git/agents/'))).toBe(true);
      expect(w).toMatch(/\.git\/agents\/(\[0-9\]\*|adhoc)(\/(plan\.(json|md|\*)|issue\.md))?$/);
    }
  });

  it('planner rules do not match a write outside the rooted state dir', () => {
    const rules = bashRules('planner.agent.md');
    // `[0-9]` is literal on OpenCode; written literally here so only the location differs from an allowed command
    expect(allowedBy(rules, 'cat > .git/agents/[0-9]1/plan.json')).toBe(true);
    expect(allowedBy(rules, 'mkdir -p .git/agents/adhoc')).toBe(true);
    for (const cmd of [
      'cat > /home/u/src/agents/[0-9]1/plan.json',
      'cat > src/agents/[0-9]1/plan.json',
      'cat > ../x/.git/agents/[0-9]1/plan.json',
      'mkdir -p /etc/agents/[0-9]1',
      'mkdir -p src/agents/adhoc',
      'cat > .git/agents/[0-9]1/other.json',
    ]) {
      expect(allowedBy(rules, cmd)).toBe(false);
    }
  });

  it('issue-reader rules do not match a redirect outside the rooted state dir', () => {
    const rules = bashRules('issue-reader.agent.md').filter(([p]) => p.includes('>'));
    expect(allowedBy(rules, 'gh issue view 1 --json title,body > .git/agents/[0-9]1/issue.md')).toBe(true);
    for (const cmd of [
      'gh issue view 1 > /home/u/src/agents/[0-9]1/issue.md',
      'gh issue view 1 > src/agents/[0-9]1/issue.md',
      'gh issue view 1 > .git/agents/[0-9]1/plan.json',
    ]) {
      expect(allowedBy(rules, cmd)).toBe(false);
    }
  });

  it('documents the trade-off and the uncovered DROMOS_STATE_DIR override', () => {
    const doc = fs.readFileSync(path.resolve(__dirname, '../../../docs/working-mode.md'), 'utf-8');
    expect(doc).toMatch(/rooted on the cwd-relative default state dir `\.git\/agents\/`/);
    expect(doc).toMatch(/do not cover a linked worktree[\s\S]{0,120}`DROMOS_STATE_DIR` override/);
  });
});
