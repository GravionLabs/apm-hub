import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { countBodyLines } from '../../../src/generators/agent-size-validator';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const skill = read('agents/.apm/skills/orchestrator/SKILL.md');
const frontmatter = skill.split(/^---$/m)[1];
const agent = read('agents/.apm/agents/orchestrator.agent.md');

describe('orchestrator launcher skill', () => {
  it('is a gated skill with exactly the allowed frontmatter keys', () => {
    expect(frontmatter).toMatch(/^name: orchestrator$/m);
    expect(frontmatter).toContain('disable-model-invocation: true');
    expect(frontmatter).toContain("opencode/autoinvoke: 'false'");
    const keys = Object.keys(parse(frontmatter));
    expect(keys.sort()).toEqual(['description', 'disable-model-invocation', 'metadata', 'name']);
    expect(countBodyLines(skill)).toBeLessThanOrEqual(100);
  });

  it('lists the same modes as the agent, extracted so they cannot drift', () => {
    const modes = /\b(plan\|implement\|full\|next\|loop\|status)\b/.exec(agent)?.[1];
    expect(modes).toBeDefined();
    expect(parse(frontmatter).description).toContain(modes!);
    expect(parse(frontmatter).description.length).toBeLessThanOrEqual(200);
  });

  it('names all six lookup paths, project paths before global ones', () => {
    const paths = [
      '.claude/agents/orchestrator.md',
      '.github/agents/orchestrator.agent.md',
      '.opencode/agents/orchestrator.md',
      '~/.claude/agents/orchestrator.md',
      '~/.copilot/agents/orchestrator.agent.md',
      '~/.config/opencode/agents/orchestrator.md',
    ];
    const idx = paths.map((p) => skill.indexOf(`\`${p}\``));
    idx.forEach((i) => expect(i).toBeGreaterThanOrEqual(0));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('announces a project-level agent file and a differing global copy, never overrides the guardrails', () => {
    expect(skill).toMatch(/project-level[^\n]*print its path/i);
    expect(skill).toMatch(/global copy[^\n]*differs/i);
    expect(skill).toMatch(/git guardrails/);
  });

  it('says next, loop and status take no description and names the client subagent mechanisms', () => {
    expect(skill).toMatch(/`next`, `loop` and `status` take no description/);
    expect(skill).not.toContain('via the Agent tool');
    expect(skill).toMatch(/Claude Code `Agent`/);
    expect(skill).toMatch(/OpenCode[^\n]*`task`/);
    expect(skill).toMatch(/VS Code Copilot `runSubagent`/);
  });

  it('recommends the primary agent and the install hint', () => {
    expect(skill).toContain('--agent orchestrator');
    expect(skill).toContain('apmw install -p <client> GravionLabs/apm-hub/packages/agents');
  });

  it('documents --fix-advisories in the description and the input list', () => {
    expect(parse(frontmatter).description).toContain('--fix-advisories');
    expect(skill).toMatch(/## 3\. Input[\s\S]*--fix-advisories none\|medium\|all/);
  });

  it('documents --advisory-rounds in the description and the input list', () => {
    expect(parse(frontmatter).description).toContain('--advisory-rounds');
    expect(skill).toMatch(/## 3\. Input[\s\S]*--advisory-rounds <0-5>/);
  });

  it('documents --no-tasks and --tasks in the input list (#580)', () => {
    expect(skill).toMatch(/## 3\. Input[\s\S]*`--no-tasks` \/ `--tasks`/);
  });

  it('is listed in the agents package manifest', () => {
    const manifest = parse(read('agents/apm.yml'));
    expect(manifest.skills).toContain('orchestrator');
  });
});
