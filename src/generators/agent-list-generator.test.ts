import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateAgentList } from './agent-list-generator';

describe('generateAgentList', () => {
  let tmpDir: string;
  let templatesDir: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-list-test-'));
    templatesDir = path.join(tmpDir, 'templates');
    outputFile = path.join(tmpDir, 'docs', 'agent-list.md');

    // Agents are in templates/<domain>/agents/*.agent.md
    const csAgentsDir = path.join(templatesDir, 'csharp', 'agents');
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
    const csSkillsDir = path.join(templatesDir, 'csharp', 'skills', 'csharp-async');
    fs.mkdirSync(csSkillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(csSkillsDir, 'SKILL.md'),
      '---\nname: csharp-async\n---\nContent'
    );

    const sharedAgentsDir = path.join(templatesDir, 'shared', 'agents');
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
    generateAgentList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Agent List');
    expect(content).toContain('## Csharp');
    expect(content).toContain('## Shared');
    expect(content).toContain('C# Expert');
    expect(content).toContain('.NET Upgrade');
    expect(content).toContain('Documentation Writer');
  });

  it('should not include skills in agent list', () => {
    generateAgentList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).not.toContain('csharp-async');
  });

  it('should include overview table with domain links', () => {
    generateAgentList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('## Overview');
    expect(content).toContain('[Csharp](#csharp)');
    expect(content).toContain('[Shared](#shared)');
  });

  it('should link to template files using agents/ subdir path', () => {
    generateAgentList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('csharp/agents/csharp-expert.agent.md');
    expect(content).toContain('shared/agents/documentation-writer.agent.md');
  });
});
