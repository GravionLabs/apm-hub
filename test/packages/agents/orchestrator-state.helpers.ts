import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

export const pk = path.resolve(__dirname, '../../../packages');
export const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');
export const script = path.join(
  pk,
  'shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1'
);

export const orchestratorAgent = read('agents/.apm/agents/orchestrator.agent.md');
// steps 0-6 and per-PBI rules live in the pipeline reference
export const orchestrator =
  orchestratorAgent + '\n' + read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
export const issueReader = read('agents/.apm/agents/issue-reader.agent.md');
export const taskIssues = read('github/.apm/skills/github-issue/references/task-issues.md');
export const planning = read('delivery/.apm/skills/issue-planning/SKILL.md');
export const detect = read('shared/.apm/skills/detect-techstack/SKILL.md');

export const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
export const T = 30000;

/** First `git ...` command line found in a fenced or inline code span of the markdown that matches `needle`. */
export function commandFrom(md: string, needle: string): string {
  const m = md.match(new RegExp('`(git [^`]*' + needle + '[^`]*)`'));
  if (!m) throw new Error('command not found in markdown: ' + needle);
  expect(m[1]).toContain('<task>');
  expect(m[1]).toContain('<integration-branch>');
  return m[1];
}
