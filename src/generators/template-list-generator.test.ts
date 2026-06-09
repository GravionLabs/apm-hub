import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseFrontmatter, getTitle } from '../utils/markdown-parser';
import { generateTemplateList } from './template-list-generator';

describe('template-list-generator helpers', () => {
  describe('parseFrontmatter', () => {
    it('should parse simple frontmatter', () => {
      const content = '---\nkey: value\nname: "Test Name"\n---';
      const fm = parseFrontmatter(content);
      expect(fm).toEqual({
        key: 'value',
        name: 'Test Name',
      });
    });

    it('should handle quoted values', () => {
      const content = '---\ndescription: \'A description with "quotes"\'\n---';
      const fm = parseFrontmatter(content);
      expect(fm).toEqual({
        description: 'A description with "quotes"',
      });
    });

    it('should return empty object if no frontmatter', () => {
      const content = '# No Frontmatter';
      const fm = parseFrontmatter(content);
      expect(fm).toEqual({});
    });

    it('should handle colon in values', () => {
      const content = '---\nurl: https://example.com\n---';
      const fm = parseFrontmatter(content);
      expect(fm).toEqual({
        url: 'https://example.com',
      });
    });
  });

  describe('getTitle', () => {
    it('should extract title from H1', () => {
      const content = '# My Title\nSome content';
      expect(getTitle(content, 'file.md')).toBe('My Title');
    });

    it('should return filename if no H1 found', () => {
      const content = 'Some content without H1';
      expect(getTitle(content, 'file.md')).toBe('file.md');
    });

    it('should find H1 even if not on first line', () => {
      const content = '---\nfm: true\n---\n\n# Real Title';
      expect(getTitle(content, 'file.md')).toBe('Real Title');
    });
  });
});

describe('generateTemplateList', () => {
  let tmpDir: string;
  let packagesDir: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-list-test-'));
    packagesDir = path.join(tmpDir, 'packages');
    outputFile = path.join(tmpDir, 'docs', 'template-list.md');

    // Create packages/<domain>/.apm/ subdirectory structure
    const agentsDir = path.join(packagesDir, 'csharp', '.apm', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'csharp-expert.agent.md'),
      '---\nname: C# Expert\ndescription: Expert C# developer agent.\n---\nContent'
    );

    // Skill directory layout: .apm/skills/<name>/SKILL.md
    const skillDir = path.join(packagesDir, 'csharp', '.apm', 'skills', 'csharp-async');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: csharp-async\ndescription: Best practices for C# async/await.\n---\nContent'
    );

    const instructionsDir = path.join(packagesDir, 'csharp', '.apm', 'instructions');
    fs.mkdirSync(instructionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(instructionsDir, 'csharp.instructions.md'),
      '---\ndescription: C# coding standards.\n---\nContent'
    );

    // Shared domain with a skill
    const sharedSkillDir = path.join(packagesDir, 'shared', '.apm', 'skills', 'ts-write-tests');
    fs.mkdirSync(sharedSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(sharedSkillDir, 'SKILL.md'),
      '---\nname: ts-write-tests\ndescription: Write unit tests.\n---\nContent'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate domain sections with all package types', () => {
    generateTemplateList(packagesDir, outputFile);

    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Package List');
    expect(content).toContain('## Csharp');
    expect(content).toContain('## Shared');
    expect(content).toContain('C# Expert');
    expect(content).toContain('### Agents');
    expect(content).toContain('### Skills');
    expect(content).toContain('### Instructions');
    expect(content).not.toContain('### Prompts');
    expect(content).toContain('csharp-async');
  });

  it('should not include a Type column header in tables', () => {
    generateTemplateList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).not.toContain('| Type |');
    expect(content).not.toContain('| :--- | :--- | :---------- |');
  });

  it('should include links to package files using correct paths', () => {
    generateTemplateList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    // Agents: flat file link
    expect(content).toContain('packages/csharp/.apm/agents/csharp-expert.agent.md');
    // Skills: directory layout link
    expect(content).toContain('packages/csharp/.apm/skills/csharp-async/SKILL.md');
    // Instructions: flat file link
    expect(content).toContain('packages/csharp/.apm/instructions/csharp.instructions.md');
  });

  it('should generate table of contents with domain anchors', () => {
    generateTemplateList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('[Csharp](#csharp)');
    expect(content).toContain('[Shared](#shared)');
  });

  it('should skip unknown subdirectories and non-package files', () => {
    // An unknown subdir (e.g. a scripts/ folder) should be ignored
    const unknownDir = path.join(packagesDir, 'csharp', '.apm', 'scripts');
    fs.mkdirSync(unknownDir, { recursive: true });
    fs.writeFileSync(path.join(unknownDir, 'setup.ps1'), '# script');

    generateTemplateList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).not.toContain('setup.ps1');
  });
});
