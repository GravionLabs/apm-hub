import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const skills = path.resolve(__dirname, '../../../packages/github/.apm/skills');
const read = (rel: string): string => readFileSync(path.join(skills, rel), 'utf8');

describe('github-issue without batch routing', () => {
  const skill = read('github-issue/SKILL.md');
  const routing = skill.slice(skill.indexOf('## Routing'), skill.indexOf('## Shared constraints'));

  it('has no batch-workflow reference file or mention', () => {
    expect(existsSync(path.join(skills, 'github-issue/references/batch-workflow.md'))).toBe(false);
    expect(skill).not.toMatch(/batch/i);
    expect(read('github-issue/references/task-issues.md')).not.toContain('batch-workflow');
  });

  it('routing has no batch row and keeps one issue per session', () => {
    expect(routing).not.toMatch(/batch|sequentially/i);
    expect(skill).toContain('One issue per session');
  });

  it('does not point at the package-level issue-templates directory', () => {
    expect(skill).not.toContain('`issue-templates/`');
    expect(skill).toContain('.github/ISSUE_TEMPLATE/');
  });
});

describe('github-pull-request reviewer fallback', () => {
  const step = read('github-pull-request/SKILL.md')
    .split('\n')
    .find((l) => l.startsWith('5. '))!;

  it('falls back to the REST requested_reviewers endpoint', () => {
    expect(step).toContain('gh pr edit <pr> --add-reviewer @copilot');
    expect(step).toContain('pulls/<pr>/requested_reviewers');
  });

  it('continues with "reviewer not added" when both fail', () => {
    expect(step).toContain('reviewer not added');
    expect(step).toMatch(/never fails the PR creation/);
  });
});
