import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const agentPath = path.resolve(__dirname, '../../packages/agents/.apm/agents/orchestrator.agent.md');
const frontmatter = fs.readFileSync(agentPath, 'utf-8').match(/^---\n([\s\S]*?)\n---\n/)![1];
const permission = parse(frontmatter).metadata.opencode.permission as Record<string, unknown>;
const bash = permission.bash as Record<string, string>;
const rules = Object.entries(bash);

// OpenCode matches the command text without redirects (spike, docs/working-mode.md): `echo x >> f` is matched as `echo x`,
// so the ledger append needs `echo *`; the redirect target cannot be restricted by a pattern.
// OpenCode wildcard: `*` matches any characters (including `/`), everything else is literal; the last matching rule wins.
function decide(command: string): string {
  let result = 'ask';
  for (const [pattern, action] of rules) {
    const re = new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    if (re.test(command)) result = action;
  }
  return result;
}

describe('orchestrator OpenCode permissions', () => {
  it('keeps edit denied for source files', () => {
    expect(permission.edit).toBe('deny');
  });

  it('keeps the catch-all bash rule at ask and first, so later rules win', () => {
    expect(bash['*']).toBe('ask');
    expect(rules[0][0]).toBe('*');
  });

  it('allows creating the issue directory and appending to the ledger', () => {
    expect(decide('mkdir -p .agents/222')).toBe('allow');
    expect(decide('mkdir -p .agents/adhoc')).toBe('allow');
    expect(decide('echo "Phase plan: complete — n/a" >> .agents/222/progress.md')).toBe('allow');
    expect(decide('tee -a .agents/222/progress.md')).toBe('allow');
  });

  it('still allows git and gh', () => {
    expect(decide('git status --short')).toBe('allow');
    expect(decide('gh issue view 222')).toBe('allow');
  });

  it('asks for writes outside .agents/', () => {
    expect(decide('mkdir -p src/foo')).toBe('ask');
    expect(decide('tee -a src/index.ts')).toBe('ask');
    expect(decide('rm -rf .agents')).toBe('ask');
  });

  it('has no allow rule other than git, gh and .agents/ ledger commands', () => {
    const allowed = rules.filter(([, a]) => a === 'allow').map(([p]) => p);
    const offenders = allowed.filter((p) => !/^(git|gh|echo) \*$/.test(p) && !/\.agents\//.test(p));
    expect(offenders).toEqual([]);
  });
});
