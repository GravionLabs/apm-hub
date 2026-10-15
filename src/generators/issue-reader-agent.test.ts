import * as fs from 'fs';
import * as path from 'path';

const agentPath = path.resolve(__dirname, '../../packages/agents/.apm/agents/issue-reader.agent.md');
const source = fs.readFileSync(agentPath, 'utf-8');
const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/)![1];
const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');

describe('issue-reader agent contract', () => {
  it('runs on haiku on every platform with read-only tools', () => {
    expect(frontmatter).toContain('name: issue-reader');
    expect(frontmatter).toContain('model: haiku');
    expect(frontmatter).toContain('model: anthropic/claude-haiku-5-5');
    expect(frontmatter).toContain('tools: [Read, Grep, Glob, Bash]');
    expect(frontmatter).toContain('user-invocable: false');
    expect(frontmatter).not.toMatch(/\b(Edit|Write)\b/);
    expect(frontmatter).toContain('edit: deny');
    expect(frontmatter).toContain('task: deny');
  });

  it('allows only read-only gh and git in the OpenCode bash map', () => {
    const bash = frontmatter.slice(frontmatter.indexOf('bash:'));
    const allowed = [...bash.matchAll(/"([^"]+)": allow/g)].map((m) => m[1]);
    expect(allowed).toContain('gh issue view *');
    expect(allowed).toContain('gh api *');
    expect(allowed).toContain('git fetch origin *');
    for (const rule of allowed) {
      expect(rule).not.toMatch(/gh issue (close|edit|create|comment)|git (push|commit|checkout|reset)/);
    }
    expect(bash).toContain('"gh api*-X*": deny');
    expect(bash).toContain('"gh api*graphql*": deny');
    expect(bash).toContain('"*": deny');
  });

  it('states the JSON contract, the error shape and branch-only mode', () => {
    expect(body).toMatch(/"issue": <nr>, "type", "title", "digest", "branch", "stale"\?, "bug", "parent", "tasks": \[\{"n", "state", "merged", "sha"\?\}\], "ledger": "none\|resume"/);
    expect(body).toMatch(/`release\/next` if it exists, else the highest `release\/<x\.y>`/);
    expect(body).toMatch(/\{"error": "<first error line>"\}/);
    expect(body).toMatch(/\{"issue": null, "branch": "<branch>"\}/);
    expect(body).toMatch(/at most 100 words/);
  });

  it('computes Task merged from the integration branch and never closes issues', () => {
    expect(body).toContain('git log -E --grep "^Refs #<n>$" origin/<branch> --format=%h -1');
    expect(body).toMatch(/select\(any\(\.labels\[\];\.name=="task"\)\)/);
    expect(body).toMatch(/never edit, close, comment or commit/);
    expect(body).not.toMatch(/gh issue close/);
  });
});
