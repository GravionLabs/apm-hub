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

    // Create domain structure
    const csDir = path.join(templatesDir, 'csharp');
    fs.mkdirSync(csDir, { recursive: true });
    fs.writeFileSync(
      path.join(csDir, 'csharp-expert.agent.md'),
      '---\nname: C# Expert\ndescription: Expert C# developer agent.\n---\nContent'
    );
    fs.writeFileSync(
      path.join(csDir, 'csharp-async.skill.md'),
      '---\nname: csharp-async\ndescription: Best practices for C# async/await.\n---\nContent'
    );
    fs.writeFileSync(
      path.join(csDir, 'csharp.instructions.md'),
      '---\ndescription: C# coding standards.\n---\nContent'
    );
    fs.writeFileSync(
      path.join(csDir, 'create-dotnet-solution.prompt.md'),
      '---\nname: create-dotnet-solution\ndescription: Scaffold a .NET solution.\n---\nContent'
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

  it('should include links to template files', () => {
    generateTemplateList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('csharp-expert.agent.md');
    expect(content).toContain('csharp-async.skill.md');
    expect(content).toContain('csharp.instructions.md');
    expect(content).toContain('create-dotnet-solution.prompt.md');
  });

  it('should generate table of contents with domain anchors', () => {
    generateTemplateList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('[Csharp](#csharp)');
    expect(content).toContain('[Shared](#shared)');
  });

  it('should skip non-template files and subdirectories', () => {
    const csDir = path.join(templatesDir, 'csharp');
    fs.writeFileSync(path.join(csDir, 'README.md'), '# Readme');
    const subDir = path.join(csDir, 'agents-md');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'some.md'), 'subdir file');

    generateTemplateList(templatesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    // README.md has no recognized extension type, should not appear as Agent/Skill/etc.
    expect(content).not.toContain('README.md');
  });
});

