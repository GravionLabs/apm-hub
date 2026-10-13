import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const pk = path.resolve(__dirname, '../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const orchestrator = read('agents/.apm/agents/orchestrator.agent.md');
const pipeline = read('delivery/.apm/skills/orch-pipeline/SKILL.md');
const conventional = read('github/.apm/skills/github-issue/references/conventional-commits.md');
const subIssues = read('github/.apm/skills/github-issue/references/sub-issues.md');
const taskIssues = read('github/.apm/skills/github-issue/references/task-issues.md');
const githubIssue = read('github/.apm/skills/github-issue/SKILL.md');
const publish = read('delivery/.apm/skills/issue-planning/references/publish.md');

const planSchemaDoc = read('delivery/.apm/skills/issue-planning/references/plan-schema.md');
const batch = read('github/.apm/skills/github-issue/references/batch-workflow.md');

describe('task flow consistency', () => {
  it.each([
    ['orchestrator', orchestrator],
    ['orch-pipeline', pipeline],
  ])('%s describes the shared task flow', (_n, text) => {
    expect(text).toContain('task-<nr>-report.md');
    expect(text).toContain('<first BASE>..HEAD');
    // footer paired with never-Closes, in the same sentence
    expect(text).toMatch(/footer `Refs #<task>`[^.]*never `Closes`/);
    // anchored resume grep against the remote ref, not a bare substring
    expect(text).toContain('git log -E --grep "^Refs #<task>$" origin/<integration-branch>..HEAD');
    expect(text).not.toMatch(/--grep "Refs #<task>"/);
    expect(text).toContain('git merge-base HEAD origin/<integration-branch>');
    // single task without Task issue: footer on the PBI, PR line on the PBI
    expect(text).toMatch(/single task[^.]*`Refs #<pbi>`/);
    expect(text).toContain('`#<pbi> — <sha>`');
    // PR closes the PBI, commits do not
    expect(text).toMatch(/`Closes #<pbi>`[^.]*task list/);
    // commits happen in the implement phase with the PBI number in the subject
    expect(text).toContain('`<type>: <desc> (#<pbi>)`');
  });

  it('orchestrator ledger line and task-only sub-issue handling', () => {
    expect(orchestrator).toContain('Task #<nr>: <status> — <sha>');
    expect(pipeline).toContain('Task #<nr>: <status> — <sha>');
    expect(orchestrator).toContain('select(any(.labels[];.name=="task"))');
    expect(orchestrator).toMatch(/implement mode when the issue has no Task sub-issues/);
    expect(orchestrator).toMatch(/Task sub-issues never get their own branch or PR/);
    expect(orchestrator).toMatch(/Existing Task sub-issues are used as they are/);
    expect(orchestrator).toMatch(/model` sonnet, no `size: L` review/);
    expect(orchestrator).toContain('`model` hint');
    expect(pipeline).toMatch(/Task sub-issues never get their own branch or PR/);
    expect(pipeline).not.toMatch(/Approved → `<type>: <desc> \(#<nr>\)` \(`feat`\/`fix`\)/);
    expect(pipeline).toMatch(/Task commits already exist/);
  });

  it('task-issues.md owns the commit, resume and single-task rules', () => {
    expect(taskIssues).toMatch(/footer is `Refs #<pbi>`/);
    expect(taskIssues).toContain('`<task>` is digits only');
    expect(taskIssues).toContain('git merge-base HEAD origin/<integration-branch>');
    expect(taskIssues).toContain('task-<plan id>-report.md');
    expect(taskIssues).toMatch(/labelled `task`/);
    expect(taskIssues).toMatch(/Hand-made Task issues have no `plan.json`/);
    expect(taskIssues).toMatch(/native blocked-by links/);
    expect(taskIssues).toMatch(/never `Closes`/);
    expect(taskIssues).toMatch(/never become separate branches or PRs/);
  });

  it('batch workflow exception applies to any runner and does not require Closes per Task', () => {
    expect(batch).toMatch(/Tasks of a PBI \(any runner/);
    expect(batch).toContain('Refs #<task>');
  });

  it('the Task section list agrees across template, task-issues.md and plan-schema.md', () => {
    const tpl = read('github/.apm/issue-templates/task.md');
    for (const s of ['Parent PBI: #', 'Overview', 'Implementation Notes', 'Context', 'Depends on', 'Files', 'Done when']) {
      expect(tpl).toContain(s);
      expect(taskIssues).toContain(s);
    }
    expect(tpl).not.toContain('Definition of Done');
    expect(taskIssues).not.toContain('Definition of Done');
    for (const s of ['Parent PBI', 'Overview', 'Implementation Notes', 'Context', 'Depends on', 'Files', 'Done when']) {
      expect(planSchemaDoc).toContain(s);
    }
    const marker = (t: string) => [t.indexOf('agent-ready:start'), t.indexOf('agent-ready:end')];
    for (const t of [tpl, taskIssues]) {
      const [st, en] = marker(t);
      expect(st).toBeGreaterThan(-1);
      expect(en).toBeGreaterThan(st);
      expect(t.slice(st, en)).toMatch(/Context[\s\S]*Depends on[\s\S]*Files[\s\S]*Done when/);
    }
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
    expect(publish).toMatch(/Label by `level`/);
    expect(publish).toMatch(/one quoted argument/);
  });

  it('task template copies stay identical and carry the agent-ready block', () => {
    const a = read('github/.apm/issue-templates/task.md');
    const b = fs.readFileSync(path.resolve(pk, '../.github/ISSUE_TEMPLATE/task.md'), 'utf-8');
    expect(a).toBe(b);
    expect(a).toContain('agent-ready:start');
  });

  it('resume uses the ledger DONE line cross-checked with git, and bugs are PBI-like', () => {
    for (const t of [orchestrator, pipeline]) {
      expect(t).toContain('`Task #<nr>: DONE`');
      expect(t).toMatch(/no duplicate task commits/);
    }
    expect(pipeline).toContain('Parent Bug: #<bug>');
    expect(pipeline).toMatch(/Load `implementation`/);
    expect(pipeline).not.toMatch(/\. load `implementation`/);
  });

  it('Parent Bug variant is consistent across publish, plan-schema, task-issues and template', () => {
    const tpl = read('github/.apm/issue-templates/task.md');
    for (const t of [publish, planSchemaDoc, taskIssues, tpl]) expect(t).toContain('Parent Bug: #');
    expect(taskIssues).toMatch(/LAST commit sha/);
  });

  it('the documented resume grep matches multi-line footers and not #123 for #12', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-grep-'));
    try {
      const git = (...a: string[]) =>
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf-8' });
      git('init', '-q');
      git('commit', '-q', '--allow-empty', '-m', 'chore: base');
      git('commit', '-q', '--allow-empty', '-m', 'feat: a (#1)\n\nbody text\n\nRefs #123');
      git('commit', '-q', '--allow-empty', '-m', 'feat: b (#1)\n\nbody text\n\nRefs #12');
      const find = (n: string) =>
        git('log', '-E', '--grep', `^Refs #${n}$`, '--format=%s', 'HEAD~2..HEAD').trim().split('\n').filter(Boolean);
      expect(find('12')).toEqual(['feat: b (#1)']);
      expect(find('123')).toEqual(['feat: a (#1)']);
      expect(find('1')).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
