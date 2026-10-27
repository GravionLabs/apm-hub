import * as fs from 'fs';
import {
  detect,
  hasPwsh,
  issueReader,
  orchestrator,
  planning,
  script,
  taskIssues,
} from './orchestrator-state.helpers';

describe('orchestrator state: contract strings (docs)', () => {
  it('pwsh is available (required in CI)', () => {
    if (process.env.CI) expect(hasPwsh).toBe(true);
  });

  it('orchestrator refers to the one merged-task rule and never re-plans when all tasks are merged', () => {
    expect(orchestrator).toContain('"Task merged"');
    expect(orchestrator).toContain('task-issues.md');
    expect(orchestrator).toContain('none open (all merged)');
    // the sub-issue query and the merged grep run in the issue-reader; the orchestrator keeps only the flags
    expect(orchestrator).toContain('`issue-reader`');
    expect(orchestrator).toContain('merged: true');
    expect(orchestrator).not.toContain('api --paginate');
    expect(issueReader).toContain('{n:.number,state:.state}');
    expect(issueReader).toContain('api --paginate');
    expect(issueReader).toContain('"Task merged"');
    expect(orchestrator.indexOf('Read the issue')).toBeLessThan(
      orchestrator.indexOf('Task merged')
    );
  });

  it('orchestrator loads detect-techstack inline without hard-coding the script', () => {
    expect(orchestrator).toContain('`detect-techstack` inline (never a forked subagent)');
    expect(orchestrator).toContain('`Ruling:`');
    // the body must not hard-code it; the permission map in the frontmatter allows the scan like planner does
    expect(orchestrator.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')).not.toContain(
      'Detect-TechStack.ps1'
    );
  });

  it('the merged-task rule lives once in task-issues.md; issue-planning refers to it', () => {
    expect(taskIssues).toContain('gh issue close <task> --comment "Merged into <branch> in <sha>"');
    const fetchAt = taskIssues.indexOf('git fetch origin <integration-branch>');
    expect(fetchAt).toBeGreaterThanOrEqual(0);
    expect(fetchAt).toBeLessThan(taskIssues.indexOf('--grep'));
    expect(taskIssues).toContain('`^[0-9]+$`');
    expect(orchestrator).not.toContain('gh issue close');
    expect(issueReader).not.toContain('gh issue close');
    expect(planning).toContain('Task merged');
    expect(planning).not.toContain('--grep');
  });

  it('the SKILL.md manifest list matches the script list', () => {
    const list = detect.match(/manifests the script reads \(([^)]*)\)/)![1];
    const docList = [...list.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    expect([...docList].sort()).toEqual([...script_manifests()].sort());
  });
});

function script_manifests(): string[] {
  const src = fs.readFileSync(script, 'utf-8');
  const block = src.match(/\$manifestFilters = @\(([\s\S]*?)\n\)/)![1];
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}
