import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateInstructionList } from './instruction-list-generator';

describe('generateInstructionList', () => {
  let tmpDir: string;
  let packagesDir: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'instruction-list-test-'));
    packagesDir = path.join(tmpDir, 'packages');
    outputFile = path.join(tmpDir, 'docs', 'instruction-list.md');

    const csDir = path.join(packagesDir, 'csharp', '.apm', 'instructions');
    fs.mkdirSync(csDir, { recursive: true });
    fs.writeFileSync(
      path.join(csDir, 'csharp.instructions.md'),
      '---\ndescription: C# coding standards and best practices.\n---\nContent',
    );
    fs.writeFileSync(
      path.join(csDir, 'csharp-nunit.instructions.md'),
      '---\ndescription: NUnit testing conventions for C#.\n---\nContent',
    );
    // Non-instruction files should be ignored
    const csAgentsDir = path.join(packagesDir, 'csharp', '.apm', 'agents');
    fs.mkdirSync(csAgentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(csAgentsDir, 'csharp-expert.agent.md'),
      '---\nname: C# Expert\n---\nContent',
    );

    const devopsDir = path.join(packagesDir, 'devops', '.apm', 'instructions');
    fs.mkdirSync(devopsDir, { recursive: true });
    fs.writeFileSync(
      path.join(devopsDir, 'shell.instructions.md'),
      '---\ndescription: Shell scripting best practices.\n---\nContent',
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate domain sections with only instruction files', () => {
    generateInstructionList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Instruction List');
    expect(content).toContain('## Csharp');
    expect(content).toContain('## Devops');
    expect(content).toContain('csharp');
    expect(content).toContain('csharp-nunit');
    expect(content).toContain('shell');
  });

  it('should not include agents or skills in instruction list', () => {
    generateInstructionList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).not.toContain('C# Expert');
  });

  it('should include overview table with domain links', () => {
    generateInstructionList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('## Overview');
    expect(content).toContain('[Csharp](#csharp)');
    expect(content).toContain('[Devops](#devops)');
  });

  it('should link to package files', () => {
    generateInstructionList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('packages/csharp/.apm/instructions/csharp.instructions.md');
    expect(content).toContain('packages/devops/.apm/instructions/shell.instructions.md');
  });
});
