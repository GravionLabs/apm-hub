import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const orchestrator = read('agents/.apm/agents/orchestrator.agent.md');
const pipeline = read('development-workflow/.apm/skills/orch-pipeline/SKILL.md');
const conventional = read('github/.apm/skills/github-issue/references/conventional-commits.md');
const subIssues = read('github/.apm/skills/github-issue/references/sub-issues.md');
const taskIssues = read('github/.apm/skills/github-issue/references/task-issues.md');
const githubIssue = read('github/.apm/skills/github-issue/SKILL.md');
const publish = read('development-workflow/.apm/skills/issue-planning/references/publish.md');

describe('task flow consistency', () => {
  it.each([
    ['orchestrator', orchestrator],
    ['orch-pipeline', pipeline],
  ])('%s describes the shared task flow', (_n, text) => {
    expect(text).toContain('Refs #<task>');
    expect(text).toContain('task-<nr>-report.md');
    expect(text).toContain('Task #<nr>: <status> — <sha>');
    expect(text).toContain('--grep "Refs #<task>"');
    expect(text).toContain('Closes #<pbi>');
    expect(text).toContain('<first BASE>..HEAD');
  });

  it('commit footer and routing rules are documented in github-issue', () => {
    expect(conventional).toContain('Refs #<task>');
    expect(conventional).toMatch(/not `Closes`/);
    expect(subIssues).toMatch(/Task sub-issues of a PBI never become separate branches or PRs/);
    expect(githubIssue).toContain('references/task-issues.md');
  });

  it('task format and publish agree on the sections', () => {
    for (const s of ['Parent PBI: #', 'Implementation Notes', 'Context', 'Depends on', 'Files', 'Done when']) {
      expect(taskIssues).toContain(s);
    }
    expect(publish).toContain('[Task]');
    expect(publish).toContain('task-issues.md');
  });

  it('task template copies stay identical and carry the agent-ready block', () => {
    const a = read('github/.apm/issue-templates/task.md');
    const b = fs.readFileSync(path.resolve(pk, '../.github/ISSUE_TEMPLATE/task.md'), 'utf-8');
    expect(a).toBe(b);
    expect(a).toContain('agent-ready:start');
  });
});
