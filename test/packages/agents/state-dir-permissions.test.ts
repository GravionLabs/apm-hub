import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

const agentsDir = path.resolve(__dirname, '../../../packages/agents/.apm/agents');
const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.agent.md'));

function split(file: string): { frontmatter: string; body: string } {
  const text = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fm) throw new Error(`No frontmatter found in ${file}`);
  return { frontmatter: fm[1], body: fm[2] };
}

function bashRules(file: string): [string, string][] {
  const bash = parse(split(file).frontmatter)?.metadata?.opencode?.permission?.bash;
  return bash && typeof bash === 'object' ? Object.entries(bash as Record<string, string>) : [];
}

// OpenCode pattern semantics (docs/working-mode.md, spike #222): `*` matches any characters including `/`, everything
// else is literal (`[0-9]` is no character class), and the last matching rule wins. The full command text is matched
// here, redirect included, which is stricter than OpenCode (it drops the redirect).
const matches = (pattern: string, command: string) =>
  new RegExp(
    '^' +
      pattern
        .split('*')
        .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
    's'
  ).test(command);
const allowedBy = (rules: [string, string][], command: string) => {
  let result = 'none';
  for (const [p, a] of rules) if (matches(p, command)) result = a;
  return result === 'allow';
};

// Commands that create, change or delete files, plus any redirect: such an allow rule must be rooted on the state dir.
const WRITERS = /^(mkdir|cat|tee|cp|mv|touch|rm|ln|install|echo|printf|sed|dd|truncate|chmod)\b|>/;
// Read-only allow rules of the two agents that write state (gh api writes are denied by the rules after it).
const READ_ONLY =
  /^(git (log|status|diff|show|remote get-url|fetch origin release\/|ls-remote --heads origin|merge-base --is-ancestor|rev-parse --abbrev-ref HEAD)|gh issue view \*$|gh api \*$|pwsh (\*\/)?scripts\/Detect-TechStack\.ps1 \*$)/;
const ROOT = '.git/agents';
const ABS = '/home/u/repo/.git/agents';

describe('OpenCode bash allow rules and the state directory', () => {
  it.each(agentFiles)('%s has no allow rule with a bare leading `*` or a `..`', (file) => {
    const allowed = bashRules(file)
      .filter(([, a]) => a === 'allow')
      .map(([p]) => p);
    expect(allowed.filter((p) => p.startsWith('*') || p.includes('..'))).toEqual([]);
  });

  it.each(['planner.agent.md', 'issue-reader.agent.md'])(
    '%s: every allow rule is read-only or a write rooted on .git/agents/',
    (file) => {
      const allowed = bashRules(file)
        .filter(([, a]) => a === 'allow')
        .map(([p]) => p);
      expect(allowed.length).toBeGreaterThan(5);
      const writes = allowed.filter((p) => WRITERS.test(p));
      expect(writes.length).toBeGreaterThan(0);
      for (const w of writes) {
        expect(w).toMatch(
          /^(mkdir -p |cat > |gh issue view \* > )\.git\/agents\/\*(\/(plan\.json|plan\.md|issue\.md))?$/
        );
      }
      expect(allowed.filter((p) => !WRITERS.test(p) && !READ_ONLY.test(p))).toEqual([]);
    }
  );

  describe('planner', () => {
    const rules = bashRules('planner.agent.md');

    it('allows the real commands for <state> passed cwd-relative', () => {
      for (const cmd of [
        `mkdir -p ${ROOT}/402`,
        `mkdir -p ${ROOT}/adhoc`,
        `cat > ${ROOT}/402/plan.json`,
        `cat > ${ROOT}/402/plan.md`,
        `cat > ${ROOT}/adhoc/plan.json`,
      ]) {
        expect(allowedBy(rules, cmd), cmd).toBe(true);
      }
    });

    it('denies `..` escapes, a second argument, other roots, other files and the absolute <state>', () => {
      for (const cmd of [
        `mkdir -p ${ROOT}/..`,
        `mkdir -p ${ROOT}/../hooks`,
        `mkdir -p ${ROOT}/402/../../../src`,
        `cat > ${ROOT}/../../src/plan.json`,
        `cat > ${ROOT}/402/../../../x/plan.md`,
        `mkdir -p ${ROOT}/402 /tmp/x`,
        `cat > ${ROOT}/402/plan.json /tmp/plan.json`,
        `cat > ${ROOT}/402/other.json`,
        `cat > ${ROOT}/402/plan.json.bak`,
        'cat > src/agents/402/plan.json',
        'mkdir -p .git/hooks',
        'cat > .git/hooks/pre-commit',
        `mkdir -p ${ABS}/402`,
        `cat > ${ABS}/402/plan.json`,
      ]) {
        expect(allowedBy(rules, cmd), cmd).toBe(false);
      }
    });
  });

  describe('issue-reader', () => {
    const rules = bashRules('issue-reader.agent.md');
    const redirectRules = rules.filter(([p]) => p.includes('>'));
    const { body } = split('issue-reader.agent.md');
    const mkdirTemplate = body.match(/`(mkdir -p <state>\/<nr>)`/)![1];
    const viewTemplate = body.match(
      /`(gh issue view <nr> --json title,body --jq [^`]+ > <state>\/<nr>\/issue\.md)`/
    )![1];
    const build = (template: string, state: string) =>
      template.replaceAll('<state>', state).replaceAll('<nr>', '402');

    it('allows the commands of rule 3 for <state> passed cwd-relative', () => {
      expect(allowedBy(rules, build(mkdirTemplate, ROOT))).toBe(true);
      expect(allowedBy(redirectRules, build(viewTemplate, ROOT))).toBe(true);
      expect(allowedBy(rules, build(viewTemplate, ROOT))).toBe(true);
    });

    it('does not root the absolute <state> (documented trade-off)', () => {
      expect(allowedBy(rules, build(mkdirTemplate, ABS))).toBe(false);
      expect(allowedBy(redirectRules, build(viewTemplate, ABS))).toBe(false);
    });

    it('denies `..` escapes and a second mkdir argument, even against the broad `gh issue view *`', () => {
      for (const cmd of [
        `mkdir -p ${ROOT}/../x`,
        `mkdir -p ${ROOT}/402/../../../src`,
        `mkdir -p ${ROOT}/402 /tmp/x`,
        `gh issue view 402 --json body > ${ROOT}/../../src/a.ts`,
        'gh issue view 402 --json body > ../outside/issue.md',
      ]) {
        expect(allowedBy(rules, cmd), cmd).toBe(false);
      }
    });

    it('roots the redirect rule: other roots and other file names do not match it', () => {
      for (const cmd of [
        'gh issue view 402 > src/agents/402/issue.md',
        `gh issue view 402 > ${ROOT}/402/plan.json`,
        'gh issue view 402 > .git/hooks/pre-commit',
      ]) {
        expect(allowedBy(redirectRules, cmd), cmd).toBe(false);
      }
    });
  });

  it.each(['planner.agent.md', 'issue-reader.agent.md'])(
    '%s explains the rooted rules in a comment line of the raw frontmatter',
    (file) => {
      const lines = split(file).frontmatter.split(/\r?\n/);
      const comment = lines.findIndex((l) => /^\s+# .*cwd-relative default \.git\/agents/.test(l));
      expect(comment).toBeGreaterThan(-1);
      expect(lines[comment]).toContain('docs/working-mode.md (Limits)');
      expect(lines[comment + 1]).toMatch(/^\s+"mkdir -p \.git\/agents\/\*": allow$/);
      // comments stay on their own line (docs/concepts/agent-frontmatter.md), never after a key
      expect(lines.filter((l) => /": (allow|deny|ask)\s+#/.test(l))).toEqual([]);
    }
  );

  it('the orchestrator passes <state> cwd-relative to issue-reader and planner only', () => {
    const orchestrator = split('orchestrator.agent.md').body;
    expect(orchestrator).toContain(
      'pass its absolute path in every subagent prompt, except to `issue-reader` and `planner`'
    );
    expect(orchestrator).toContain('they get it cwd-relative');
    const pipeline = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../packages/github/.apm/skills/github-issue/references/pbi-pipeline.md'
      ),
      'utf-8'
    );
    expect(pipeline).toContain(
      '`issue-reader` and `planner` get it cwd-relative when it lies under the cwd'
    );
  });

  it('documents the trade-off, the comment tolerance and the uncovered DROMOS_STATE_DIR override', () => {
    const doc = fs.readFileSync(path.resolve(__dirname, '../../../docs/working-mode.md'), 'utf-8');
    expect(doc).toMatch(/rooted on the cwd-relative default state dir `\.git\/agents\/`/);
    expect(doc).toMatch(/passes these two agents `<state>` cwd-relative/);
    expect(doc).toMatch(/do not cover\s+a linked worktree[\s\S]{0,120}`DROMOS_STATE_DIR` override/);
    const fmDoc = fs.readFileSync(
      path.resolve(__dirname, '../../../docs/concepts/agent-frontmatter.md'),
      'utf-8'
    );
    expect(fmDoc).toMatch(/YAML comment line inside `metadata\.opencode\.permission` is allowed/);
  });
});
