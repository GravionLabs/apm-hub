import * as fs from 'fs';
import * as path from 'path';
import {
  detect,
  issueReader,
  orchestrator,
  orchestratorAgent,
  pk,
  read,
} from './orchestrator-state.helpers';

describe('agent prose: worktree-shared state directory (#402)', () => {
  const agentsDir = path.join(pk, 'agents/.apm/agents');
  const refsDir = path.join(pk, 'github/.apm/skills/github-issue/references');
  const proseFiles = [
    ...fs.readdirSync(agentsDir).map((f) => path.join(agentsDir, f)),
    ...fs.readdirSync(refsDir).map((f) => path.join(refsDir, f)),
  ];

  it('defines <state> once in the orchestrator as state_dir with the override and passes it to subagents', () => {
    expect(orchestratorAgent).toContain('`state_dir` of the `detect-techstack` JSON');
    expect(orchestratorAgent).toContain('`<git-common-dir>/agents/`');
    expect(orchestratorAgent).toContain('`DROMOS_STATE_DIR`');
    expect(orchestratorAgent).toContain('absolute `<state>`');
  });

  it('keeps state_dir from step 0 and hands it to issue-reader', () => {
    const pipeline = read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
    expect(pipeline).toContain('its `state_dir` (`<state>`');
    expect(pipeline).toContain('with `<issue>`, `<state>` and');
    expect(issueReader).toContain(
      'the `<state>` directory (cwd-relative such as `.git/agents` when it lies under the cwd, else absolute'
    );
  });

  it('no longer mentions the .git/info/exclude step in agents or references', () => {
    for (const file of proseFiles) {
      expect(fs.readFileSync(file, 'utf-8'), file).not.toContain('info/exclude');
    }
  });

  it('references the working-tree .agents/ directory only as an install path (.agents/skills)', () => {
    for (const file of proseFiles) {
      const stray = fs
        .readFileSync(file, 'utf-8')
        .replace(/\.agents\/skills/g, '')
        .match(/\.agents\b/);
      expect(stray, file).toBeNull();
    }
  });
});
