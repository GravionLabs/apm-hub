import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateSkillList } from './skill-list-generator';

describe('generateSkillList', () => {
  let tmpDir: string;
  let templatesDir: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-list-test-'));
    templatesDir = path.join(tmpDir, 'templates');
    outputFile = path.join(tmpDir, 'docs', 'skill-list.md');

    // csharp/skills/<name>/SKILL.md — agentskills.io directory layout
    const csSkillsDir = path.join(templatesDir, 'csharp', 'skills');
    fs.mkdirSync(path.join(csSkillsDir, 'csharp-async'), { recursive: true });
    fs.writeFileSync(
      path.join(csSkillsDir, 'csharp-async', 'SKILL.md'),
      '---\nname: csharp-async\ndescription: Best practices for async/await in C#.\n---\nContent'
    );
    fs.mkdirSync(path.join(csSkillsDir, 'csharp-docs'), { recursive: true });
    fs.writeFileSync(
      path.join(csSkillsDir, 'csharp-docs', 'SKILL.md'),
      '---\nname: csharp-docs\ndescription: Document C# types with XML comments.\n---\nContent'
    );
    // Agents/instructions in csharp domain should be ignored by skill-list
    const csAgentsDir = path.join(templatesDir, 'csharp', 'agents');
    fs.mkdirSync(csAgentsDir, { recursive: true });
    fs.writeFileSync(path.join(csAgentsDir, 'csharp-expert.agent.md'), '---\nname: C# Expert\n---\n');
    const csInstrDir = path.join(templatesDir, 'csharp', 'instructions');
    fs.mkdirSync(csInstrDir, { recursive: true });
    fs.writeFileSync(path.join(csInstrDir, 'csharp.instructions.md'), '---\ndescription: C# standards.\n---\n');

    // shared/skills/write-tests/SKILL.md
    const sharedSkillsDir = path.join(templatesDir, 'shared', 'skills');
    fs.mkdirSync(path.join(sharedSkillsDir, 'write-tests'), { recursive: true });
    fs.writeFileSync(
      path.join(sharedSkillsDir, 'write-tests', 'SKILL.md'),
      '---\nname: write-tests\ndescription: Write unit tests.\n---\nContent'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate domain sections with only skill files', () => {
    generateSkillList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Skill List');
    expect(content).toContain('## Csharp');
    expect(content).toContain('## Shared');
    expect(content).toContain('csharp-async');
    expect(content).toContain('csharp-docs');
    expect(content).toContain('write-tests');
  });

  it('should not include agents or instructions in skill list', () => {
    generateSkillList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).not.toContain('C# Expert');
    expect(content).not.toContain('csharp.instructions');
  });

  it('should include overview table with domain links', () => {
    generateSkillList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('## Overview');
    expect(content).toContain('[Csharp](#csharp)');
    expect(content).toContain('[Shared](#shared)');
  });

  it('should link to skill directory layout template files', () => {
    generateSkillList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('skills/csharp-async/SKILL.md');
    expect(content).toContain('skills/write-tests/SKILL.md');
  });
});
