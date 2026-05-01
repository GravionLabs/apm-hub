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

    // Agents are in packages/<domain>/.apm/agents/*.agent.md
    const csAgentsDir = path.join(packagesDir, 'csharp', '.apm', 'agents');
    fs.mkdirSync(csAgentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(csAgentsDir, 'csharp-expert.agent.md'),
      '---\nname: C# Expert\ndescription: Expert C# developer agent.\n---\nContent'
    );
    fs.writeFileSync(
      path.join(csAgentsDir, 'dotnet-upgrade.agent.md'),
      '---\nname: .NET Upgrade\ndescription: Modernize and upgrade .NET projects.\n---\nContent'
    );
    // Non-agent files in agents/ should be ignored
    fs.writeFileSync(path.join(csAgentsDir, 'README.md'), '# readme');

    // Skills should not appear in agent list
    const csSkillsDir = path.join(packagesDir, 'csharp', '.apm', 'skills', 'csharp-async');
    fs.mkdirSync(csSkillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(csSkillsDir, 'SKILL.md'),
      '---\nname: csharp-async\n---\nContent'
    );

    const sharedAgentsDir = path.join(packagesDir, 'shared', '.apm', 'agents');
    fs.mkdirSync(sharedAgentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(sharedAgentsDir, 'documentation-writer.agent.md'),
      '---\nname: Documentation Writer\ndescription: Write and update technical documentation.\n---\nContent'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate domain sections with only agent files', () => {
    generateAgentList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Agent List');
    expect(content).toContain('## Csharp');
    expect(content).toContain('## Shared');
    expect(content).toContain('C# Expert');
    expect(content).toContain('.NET Upgrade');
    expect(content).toContain('Documentation Writer');
  });

  it('should not include skills in agent list', () => {
    generateAgentList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).not.toContain('csharp-async');
  });

  it('should include overview table with domain links', () => {
    generateAgentList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('## Overview');
    expect(content).toContain('[Csharp](#csharp)');
    expect(content).toContain('[Shared](#shared)');
  });

  it('should link to package files using agents/ subdir path', () => {
    generateAgentList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('packages/csharp/.apm/agents/csharp-expert.agent.md');
    expect(content).toContain('packages/shared/.apm/agents/documentation-writer.agent.md');
  });
});
