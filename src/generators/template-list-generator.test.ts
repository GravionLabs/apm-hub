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
  let templatesDir: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-list-test-'));
    templatesDir = path.join(tmpDir, 'templates');
    outputFile = path.join(tmpDir, 'docs', 'template-list.md');

    // Create domain/type subdirectory structure (agentskills.io / copilot-hub layout)
    const agentsDir = path.join(templatesDir, 'csharp', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'csharp-expert.agent.md'),
      '---\nname: C# Expert\ndescription: Expert C# developer agent.\n---\nContent'
    );

    // Skill directory layout: skills/<name>/SKILL.md
    const skillDir = path.join(templatesDir, 'csharp', 'skills', 'csharp-async');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: csharp-async\ndescription: Best practices for C# async/await.\n---\nContent'
    );

    const instructionsDir = path.join(templatesDir, 'csharp', 'instructions');
    fs.mkdirSync(instructionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(instructionsDir, 'csharp.instructions.md'),
      '---\ndescription: C# coding standards.\n---\nContent'
    );

    const promptsDir = path.join(templatesDir, 'csharp', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(promptsDir, 'create-dotnet-solution.prompt.md'),
      '---\nname: create-dotnet-solution\ndescription: Scaffold a .NET solution.\n---\nContent'
    );

    // Shared domain with a skill
    const sharedSkillDir = path.join(templatesDir, 'shared', 'skills', 'write-tests');
    fs.mkdirSync(sharedSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(sharedSkillDir, 'SKILL.md'),
      '---\nname: write-tests\ndescription: Write unit tests.\n---\nContent'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate domain sections with all template types', () => {
    generateTemplateList(templatesDir, outputFile);

    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Template List');
    expect(content).toContain('## Csharp');
    expect(content).toContain('## Shared');
    expect(content).toContain('C# Expert');
    expect(content).toContain('Agent');
    expect(content).toContain('csharp-async');
    expect(content).toContain('Skill');
    expect(content).toContain('Instructions');
    expect(content).toContain('Prompt');
  });

  it('should include links to template files using correct paths', () => {
    generateTemplateList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    // Agents: flat file link
    expect(content).toContain('csharp/agents/csharp-expert.agent.md');
    // Skills: directory layout link
    expect(content).toContain('csharp/skills/csharp-async/SKILL.md');
    // Instructions: flat file link
    expect(content).toContain('csharp/instructions/csharp.instructions.md');
    // Prompts: flat file link
    expect(content).toContain('csharp/prompts/create-dotnet-solution.prompt.md');
  });

  it('should generate table of contents with domain anchors', () => {
    generateTemplateList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('[Csharp](#csharp)');
    expect(content).toContain('[Shared](#shared)');
  });

  it('should skip unknown subdirectories and non-template files', () => {
    // An unknown subdir (e.g. a scripts/ folder) should be ignored
    const unknownDir = path.join(templatesDir, 'csharp', 'scripts');
    fs.mkdirSync(unknownDir, { recursive: true });
    fs.writeFileSync(path.join(unknownDir, 'setup.ps1'), '# script');

    generateTemplateList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).not.toContain('setup.ps1');
  });

  it('should also handle legacy flat .skill.md files inside skills/ dir', () => {
    const csSkillsDir = path.join(templatesDir, 'csharp', 'skills');
    fs.writeFileSync(
      path.join(csSkillsDir, 'legacy-skill.skill.md'),
      '---\nname: legacy-skill\ndescription: A legacy flat skill.\n---\nContent'
    );

    generateTemplateList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('legacy-skill');
    expect(content).toContain('csharp/skills/legacy-skill.skill.md');
  });
});

