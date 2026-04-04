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

    const csDir = path.join(templatesDir, 'csharp');
    fs.mkdirSync(csDir, { recursive: true });
    fs.writeFileSync(
      path.join(csDir, 'csharp-async.skill.md'),
      '---\nname: csharp-async\ndescription: Best practices for async/await in C#.\n---\nContent'
    );
    fs.writeFileSync(
      path.join(csDir, 'csharp-docs.skill.md'),
      '---\nname: csharp-docs\ndescription: Document C# types with XML comments.\n---\nContent'
    );
    // Non-skill files should be ignored
    fs.writeFileSync(path.join(csDir, 'csharp-expert.agent.md'), '---\nname: C# Expert\n---\n');
    fs.writeFileSync(
      path.join(csDir, 'csharp.instructions.md'),
      '---\ndescription: C# standards.\n---\n'
    );

    const sharedDir = path.join(templatesDir, 'shared');
    fs.mkdirSync(sharedDir, { recursive: true });
    fs.writeFileSync(
      path.join(sharedDir, 'write-tests.skill.md'),
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

  it('should link to template files', () => {
    generateSkillList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('csharp-async.skill.md');
    expect(content).toContain('write-tests.skill.md');
  });
});
