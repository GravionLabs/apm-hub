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

    const csDir = path.join(templatesDir, 'csharp');
    fs.mkdirSync(csDir, { recursive: true });
    fs.writeFileSync(
      path.join(csDir, 'csharp-expert.agent.md'),
      '---\nname: C# Expert\ndescription: Expert C# developer agent.\n---\nContent'
    );
    fs.writeFileSync(
      path.join(csDir, 'dotnet-upgrade.agent.md'),
      '---\nname: .NET Upgrade\ndescription: Modernize and upgrade .NET projects.\n---\nContent'
    );
    // Non-agent files should be ignored
    fs.writeFileSync(
      path.join(csDir, 'csharp-async.skill.md'),
      '---\nname: csharp-async\n---\nContent'
    );

    const sharedDir = path.join(templatesDir, 'shared');
    fs.mkdirSync(sharedDir, { recursive: true });
    fs.writeFileSync(
      path.join(sharedDir, 'documentation-writer.agent.md'),
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

  it('should not include skills or instructions in agent list', () => {
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

  it('should link to template files', () => {
    generateAgentList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('csharp-expert.agent.md');
    expect(content).toContain('documentation-writer.agent.md');
  });
});
