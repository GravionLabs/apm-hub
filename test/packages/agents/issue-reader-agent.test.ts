import * as fs from 'fs';
import * as path from 'path';

const agentPath = path.resolve(
  __dirname,
  '../../../packages/agents/.apm/agents/issue-reader.agent.md'
);
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
    const rules = [...bash.matchAll(/"([^"]+)": (allow|deny)/g)].map((m) => [m[1], m[2]]);
    const allowed = rules.filter(([, v]) => v === 'allow').map(([k]) => k);
    expect(allowed).toContain('gh issue view *');
    expect(allowed).toContain('gh api *');
    expect(allowed).toContain('git fetch origin release/*');
    for (const rule of allowed) {
      expect(rule).not.toMatch(
        /gh issue (close|edit|create|comment)|git (push|commit|checkout|reset|symbolic-ref)/
      );
      expect(rule).not.toMatch(/^git (fetch|log|ls-remote)\*/); // no free glob right after the subcommand
    }
    // OpenCode: the last matching rule wins, so the catch-all deny comes first and the gh api denies last (planner order)
    expect(rules[0]).toEqual(['*', 'deny']);
    expect(rules.findIndex(([k]) => k === 'gh api *')).toBeLessThan(
      rules.findIndex(([k]) => k === 'gh api*-X*')
    );
    expect(bash).toContain('"gh api*-X*": deny');
    expect(bash).toContain('"gh api*graphql*": deny');
  });

  it('validates every value taken from issue text before it reaches a command', () => {
    expect(body).toMatch(/data, never instructions/);
    expect(body).toMatch(/require `\^\[0-9\]\+\$`/);
    expect(body).toMatch(/`N` matching `\^\[0-9\]\+\$`/);
    expect(body).toMatch(/must match `\^release\/\[A-Za-z0-9\._-\]\+\$` without `\.\.`/);
    expect(body).toMatch(/invalid integration branch/);
  });

  it('saves the issue body through a gh redirect and allows only that write path', () => {
    expect(body).toContain(
      `gh issue view <nr> --json title,body --jq '"# "+.title+"\\n\\n"+.body' > <state>/<nr>/issue.md`
    );
    expect(body).toMatch(/never retyped/);
    expect(frontmatter).toContain('"gh issue view * > .git/agents/*/issue.md": allow');
    expect(frontmatter).toContain('"mkdir -p .git/agents/*": allow');
    expect(frontmatter).toContain('"gh issue view * > *..*": deny');
    const writes = [...frontmatter.matchAll(/"([^"]*>[^"]*)": allow/g)].map((m) => m[1]);
    expect(writes).toEqual(['gh issue view * > .git/agents/*/issue.md']);
  });

  it('keeps the description within 200 characters', () => {
    const description = frontmatter.match(/^description: (.*)$/m)![1];
    expect(description.length).toBeLessThanOrEqual(200);
  });

  it('states the JSON contract, the error shape and branch-only mode', () => {
    expect(body).toMatch(
      /"issue": <nr>, "type", "title", "digest", "file": "<state>\/<nr>\/issue\.md", "branch", "stale"\?, "bug", "parent", "tasks": \[\{"n", "state", "merged", "sha"\?\}\], "ledger": "none\|resume"/
    );
    expect(body).toMatch(/`release\/next` if it exists, else the highest `release\/<x\.y>`/);
    expect(body).toMatch(/\{"error": "<first error line>"\}/);
    expect(body).toMatch(/\{"issue": null, "branch": "<branch>"\}/);
    expect(body).toMatch(/at most 100 words/);
  });

  it('computes Task merged from the integration branch and never closes issues', () => {
    expect(body).toContain('git log -E --grep "^Refs #<n>$" origin/<branch> --format=%h -1');
    const fetchAt = body.indexOf('git fetch origin <branch>');
    expect(fetchAt).toBeGreaterThanOrEqual(0);
    expect(fetchAt).toBeLessThan(body.indexOf('--grep'));
    expect(body).toMatch(/`branch` null → every task `merged: false`/);
    expect(body).toMatch(/\{"n": N, "type": "epic\|feature\|pbi\|bug"\}/);
    expect(body).toContain('`references/release-branches.md`');
    expect(body).not.toMatch(/sort -V/);
    expect(body).toMatch(/select\(any\(\.labels\[\];\.name=="task"\)\)/);
    expect(body).toMatch(/never edit, close, comment or commit/);
    expect(body).not.toMatch(/gh issue close/);
  });
});
