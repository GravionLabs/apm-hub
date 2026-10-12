import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateAgentList } from './agent-list-generator';

describe('generateAgentList', () => {
  let tmpDir: string;
  let packagesDir: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-list-test-'));
    packagesDir = path.join(tmpDir, 'packages');
    outputFile = path.join(tmpDir, 'docs', 'agent-list.md');

    const agentsDir = path.join(packagesDir, 'agents', '.apm', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'lead.agent.md'),
      '---\nname: lead\ndescription: Issue orchestrator.\nuser-invocable: true\n---\nBody'
    );
    fs.writeFileSync(
      path.join(agentsDir, 'explorer.agent.md'),
      '---\nname: explorer\ndescription: Read-only exploration.\nuser-invocable: false\n---\nBody'
    );
    fs.writeFileSync(path.join(agentsDir, 'notes.md'), '# not an agent\n');

    // a skills-only domain must not appear
    const skillsDir = path.join(packagesDir, 'ts', '.apm', 'skills', 'ts-test');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'SKILL.md'), '---\nname: ts-test\ndescription: x\n---\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists agents by package and marks subagents', () => {
    generateAgentList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Agent List');
    expect(content).toContain('## Agents');
    expect(content).toContain('| [`lead`](../packages/agents/.apm/agents/lead.agent.md) | Issue orchestrator. |');
    expect(content).toContain('Read-only exploration. *(subagent)*');
    expect(content).not.toContain('## Ts');
    expect(content).not.toContain('notes');
  });
});
