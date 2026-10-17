import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { countBodyLines } from './agent-size-validator';

const pk = path.resolve(__dirname, '../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const orchestratorAgent = read('agents/.apm/agents/orchestrator.agent.md');
// steps 0-6 and per-PBI rules live in the pipeline reference
const orchestrator = orchestratorAgent + '\n' + read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
const issueReader = read('agents/.apm/agents/issue-reader.agent.md');
const conventional = read('github/.apm/skills/github-issue/references/conventional-commits.md');
const subIssues = read('github/.apm/skills/github-issue/references/sub-issues.md');
const taskIssues = read('github/.apm/skills/github-issue/references/task-issues.md');
const githubIssue = read('github/.apm/skills/github-issue/SKILL.md');
const publish = read('delivery/.apm/skills/issue-planning/references/publish.md');

const planSchemaDoc = read('delivery/.apm/skills/issue-planning/references/plan-schema.md');
const batch = read('github/.apm/skills/github-issue/references/batch-workflow.md');

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe.skipIf(!hasPwsh)('ledger format agreement with Get-RunMetrics', () => {
  it('parses the exact Task and Fix round lines the pipeline spec documents', () => {
    const spec = read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
    const taskFmt = /`(Task #<nr>: <status> — <sha> — model <name>)`/.exec(spec)?.[1];
    const fixFmt = /`(Fix round <r> \(#<task>\): <result> — model <name>)`/.exec(spec)?.[1];
    expect(taskFmt).toBeDefined();
    expect(fixFmt).toBeDefined();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-fmt-'));
    try {
      const t = path.join(dir, 't.jsonl');
      fs.writeFileSync(t, '');
      const l = path.join(dir, 'progress.md');
      const values: Record<string, string> = { nr: '7', status: 'DONE', sha: 'abc1234', task: '7', r: '1', result: 'DONE', name: 'opus' };
      const fill = (f: string) => f.replace(/<(\w+)>/g, (m, k) => values[k] ?? m);
      fs.writeFileSync(l, [fill(taskFmt!), fill(fixFmt!)].join('\n') + '\n');
      const script = path.join(pk, 'delivery/.apm/skills/retro/scripts/Get-RunMetrics.ps1');
      const out = execFileSync('pwsh', ['-NoProfile', '-File', script, '-Transcript', t, '-Ledger', l], { encoding: 'utf-8' });
      expect(JSON.parse(out).tasks[0]).toMatchObject({ task: 7, model: 'opus', fixRounds: 1, escalated: false, escalatedTo: null });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fills the retro Escalation line from the script output of an escalated plan-id task', () => {
    const retro = read('delivery/.apm/skills/retro/SKILL.md');
    const lineFmt = /`(Escalation: #<task> <kind> — <model> -> <model> after <n> fix rounds)`/.exec(retro)?.[1];
    expect(lineFmt).toBeDefined();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-esc-'));
    try {
      const t = path.join(dir, 't.jsonl');
      fs.writeFileSync(t, '');
      const l = path.join(dir, 'progress.md');
      fs.writeFileSync(l, ['Task #p1: DONE — abc1234 — model sonnet', 'Fix round 1 (#p1): DONE — model sonnet', 'Fix round 2 (#p1): DONE — model opus'].join('\n') + '\n');
      const script = path.join(pk, 'delivery/.apm/skills/retro/scripts/Get-RunMetrics.ps1');
      const task = JSON.parse(execFileSync('pwsh', ['-NoProfile', '-File', script, '-Transcript', t, '-Ledger', l], { encoding: 'utf-8' })).tasks[0];
      expect(task.escalated).toBe(true);
      const models = [task.model, task.escalatedTo];
      const line = lineFmt!
        .replace('<task>', String(task.task))
        .replace('<kind>', 'feat')
        .replace(/<model>/g, () => models.shift())
        .replace('<n>', String(task.fixRounds));
      expect(line).toBe('Escalation: #p1 feat — sonnet -> opus after 2 fix rounds');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('orch-pipeline deprecation stub', () => {
  const stub = read('delivery/.apm/skills/orch-pipeline/SKILL.md');
  const frontmatter = stub.split(/^---$/m)[1];

  it('is deprecated, hidden from model invocation and points to the agent', () => {
    expect(frontmatter).toMatch(/^description: 'Deprecated, use the orchestrator agent/m);
    expect(frontmatter).toContain('disable-model-invocation: true');
    expect(frontmatter).toContain("opencode/autoinvoke: 'false'");
    expect(countBodyLines(stub)).toBeLessThanOrEqual(10);
    for (const c of ['claude', 'copilot', 'opencode']) expect(stub).toContain(`${c} --agent orchestrator`);
    expect(stub).toContain('https://github.com/GravionLabs/apm-hub/blob/main/docs/working-mode.md');
    expect(stub).toContain('3.0.0');
  });

  it('has no leftover references or scripts', () => {
    const dir = path.join(pk, 'delivery/.apm/skills/orch-pipeline');
    expect(fs.readdirSync(dir)).toEqual(['SKILL.md']);
  });
});

describe('task flow consistency', () => {
  it('orchestrator describes the shared task flow', () => {
    const text = orchestrator;
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
    expect(orchestrator).toContain('Task #<nr>: <status> — <sha> — model <name>');
    expect(orchestrator).toContain('Fix round <r> (#<task>): <result> — model <name>');
    expect(orchestrator).toContain('the plan id (e.g. `p1`) for a single task without issue');
    expect(issueReader).toContain('select(any(.labels[];.name=="task"))');
    expect(orchestrator).toMatch(/`pbi` children are separate PBIs/);
    expect(orchestrator).toMatch(/implement mode when the issue has no Task sub-issues/);
    expect(orchestrator).toMatch(/Task sub-issues never get their own branch or PR/);
    expect(orchestrator).toMatch(/Existing Task sub-issues are used as they are/);
    expect(orchestrator).toMatch(/model` sonnet, no `size: L` review/);
    expect(orchestrator).toContain('`model` hint');
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
    expect(orchestrator).toContain('`Task #<nr>: DONE`');
    expect(orchestrator).toMatch(/no duplicate task commits/);
    // the PR phase never re-commits: Task commits already exist from the implement phase
    expect(orchestrator).toMatch(/Task commits are already made, no extra commit/);
    // bugs: the implementer loads diagnose first; Task bodies under a Bug carry `Parent Bug: #<bug>`
    expect(orchestrator).toMatch(/bug = label `bug`[^)]*load `diagnose` first/);
    expect(taskIssues).toContain('`Parent Bug: #<bug>`');
  });

  it('the implementer loads the implementation skill for every task', () => {
    const implementer = read('agents/.apm/agents/implementer.agent.md');
    expect(implementer).toMatch(/Load the `implementation` skill/);
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
