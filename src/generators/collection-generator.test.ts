import * as fs from 'fs';
import { generateMarkdown, CollectionConfig } from './collection-generator';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('collection-generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
  });

  const mockConfig: CollectionConfig = {
    id: 'test-collection',
    name: 'Test Collection',
    description: 'A test collection description',
    tags: ['test', 'jest'],
    items: [
      { path: 'prompts/test-prompt.prompt.md', kind: 'prompt' },
      { path: 'instructions/test-instruction.instructions.md', kind: 'instruction' },
      { path: 'agents/test-agent.agent.md', kind: 'agent' },
    ],
  };

  it('should generate markdown with title, description and tags', () => {
    const markdown = generateMarkdown(mockConfig);
    expect(markdown).toContain('# Test Collection');
    expect(markdown).toContain('A test collection description');
    expect(markdown).toContain('**Tags:** `test`, `jest`');
  });

  it('should generate a table with items including description column', () => {
    const markdown = generateMarkdown(mockConfig);
    expect(markdown).toContain('| Name | Description | Type | Path |');
    // Default when file does not exist
    expect(markdown).toContain(
      '| [test-prompt.prompt.md](../prompts/test-prompt.prompt.md) | - | prompt | `prompts/test-prompt.prompt.md` |'
    );
  });

  it('should use title and description from file if it exists', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(`---
description: 'Test Description'
---
# Actual Title
`);

    const markdown = generateMarkdown(mockConfig);
    expect(markdown).toContain(
      '| [Actual Title](../prompts/test-prompt.prompt.md) | Test Description | prompt | `prompts/test-prompt.prompt.md` |'
    );
  });

  it('should sort items alphabetically if ordering is alpha', () => {
    const alphaConfig: CollectionConfig = {
      ...mockConfig,
      items: [
        { path: 'prompts/b.prompt.md', kind: 'prompt' },
        { path: 'prompts/a.prompt.md', kind: 'prompt' },
        { path: 'prompts/c.prompt.md', kind: 'prompt' },
      ],
      display: {
        ordering: 'alpha',
      },
    };
    const markdown = generateMarkdown(alphaConfig);
    const lines = markdown.split('\n');
    const tableLines = lines.filter((l) => l.startsWith('| ['));

    expect(tableLines[0]).toContain('[a.prompt.md]');
    expect(tableLines[1]).toContain('[b.prompt.md]');
    expect(tableLines[2]).toContain('[c.prompt.md]');
  });

  it('should handle paths without standard folders correctly', () => {
    const customConfig: CollectionConfig = {
      ...mockConfig,
      items: [{ path: 'custom/file.md', kind: 'prompt' }],
    };
    const markdown = generateMarkdown(customConfig);
    expect(markdown).toContain('| [file.md](custom/file.md) | - | prompt | `custom/file.md` |');
  });
});
