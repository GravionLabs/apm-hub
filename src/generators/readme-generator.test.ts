import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  injectBlock,
  buildTemplateStatsBlock,
  buildPluginTableBlock,
  updateReadme,
  updateFileBlock,
} from './readme-generator';

vi.mock('fs');
vi.mock('yaml');

import * as fs from 'fs';
import { parse } from 'yaml';

const mockFs = vi.mocked(fs);
const mockParse = vi.mocked(parse);

describe('injectBlock', () => {
  it('replaces the content between markers', () => {
    const content = [
      '# README',
      '<!-- AUTO:start my-block -->',
      'old content',
      '<!-- AUTO:end my-block -->',
      'after',
    ].join('\n');

    const result = injectBlock(content, 'my-block', 'new content');
    expect(result).toContain(
      '<!-- AUTO:start my-block -->\nnew content\n<!-- AUTO:end my-block -->'
    );
    expect(result).not.toContain('old content');
    expect(result).toContain('after');
  });

  it('works when block was previously empty', () => {
    const content = '<!-- AUTO:start x -->\n<!-- AUTO:end x -->';
    const result = injectBlock(content, 'x', 'inserted');
    expect(result).toBe('<!-- AUTO:start x -->\ninserted\n<!-- AUTO:end x -->');
  });

  it('throws when start marker is missing', () => {
    const content = '<!-- AUTO:end my-block -->';
    expect(() => injectBlock(content, 'my-block', 'x')).toThrow(
      "AUTO markers for 'my-block' not found"
    );
  });

  it('throws when end marker is missing', () => {
    const content = '<!-- AUTO:start my-block -->';
    expect(() => injectBlock(content, 'my-block', 'x')).toThrow(
      "AUTO markers for 'my-block' not found"
    );
  });
});

describe('buildTemplateStatsBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts .md files in each subdirectory', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFs.readdirSync = vi.fn((dir: unknown, opts?: unknown) => {
      const d = dir as string;
      // Top-level templates dir → return domain entries (withFileTypes: true)
      if (d === 'templates' && (opts as Record<string, unknown>)?.withFileTypes) {
        return [{ name: 'csharp', isDirectory: () => true }] as unknown as fs.Dirent[];
      }
      if (d.endsWith('agents')) return ['a.agent.md', 'b.agent.md'] as unknown as fs.Dirent[];
      if (d.endsWith('prompts')) return ['p.prompt.md'] as unknown as fs.Dirent[];
      if (d.endsWith('instructions'))
        return [
          'i.instructions.md',
          'j.instructions.md',
          'k.instructions.md',
        ] as unknown as fs.Dirent[];
      if (d.endsWith('skills')) return [] as unknown as fs.Dirent[];
      return [] as unknown as fs.Dirent[];
    }) as any;

    const result = buildTemplateStatsBlock('templates');
    expect(result).toContain('| **Agents** | 2 |');
    expect(result).toContain('| **Prompts** | 1 |');
    expect(result).toContain('| **Instructions** | 3 |');
  });

  it('counts 0 when directory does not exist', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);
    const result = buildTemplateStatsBlock('templates');
    expect(result).toContain('| **Agents** | 0 |');
    expect(result).toContain('| **Prompts** | 0 |');
    expect(result).toContain('| **Instructions** | 0 |');
  });

  it('ignores non-.agent.md files in agents dir', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFs.readdirSync = vi.fn((dir: unknown, opts?: unknown) => {
      const d = dir as string;
      if (d === 'templates' && (opts as Record<string, unknown>)?.withFileTypes) {
        return [{ name: 'shared', isDirectory: () => true }] as unknown as fs.Dirent[];
      }
      if (d.endsWith('agents')) return ['agent.agent.md', 'readme.md', 'config.yml'] as unknown as fs.Dirent[];
      return [] as unknown as fs.Dirent[];
    }) as any;
    const result = buildTemplateStatsBlock('templates');
    expect(result).toContain('| **Agents** | 1 |');
  });
});

describe('buildPluginTableBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds a table row per plugin', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'my-plugin', isDirectory: () => true }] as unknown as fs.Dirent[]);
    mockFs.readFileSync = vi.fn().mockReturnValue('yaml');
    mockParse.mockReturnValue({ name: 'my-plugin', description: 'A cool plugin' });

    const result = buildPluginTableBlock('plugins');
    expect(result).toContain('| Plugin | Description |');
    expect(result).toContain('[`my-plugin`](plugins/my-plugin)');
    expect(result).toContain('A cool plugin');
  });

  it('returns header-only table when plugins dir missing', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);
    const result = buildPluginTableBlock('plugins');
    expect(result).toContain('| Plugin | Description |');
    expect(result.split('\n').length).toBe(2); // header + separator only
  });

  it('collapses multi-line descriptions', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'p', isDirectory: () => true }] as unknown as fs.Dirent[]);
    mockFs.readFileSync = vi.fn().mockReturnValue('yaml');
    mockParse.mockReturnValue({ name: 'p', description: 'Line one\nLine two\n  extra spaces' });

    const result = buildPluginTableBlock('plugins');
    expect(result).toContain('Line one Line two extra spaces');
    // Verify the description row itself has no embedded newlines
    const descRow = result.split('\n').find((l) => l.includes('Line one'));
    expect(descRow).toBeDefined();
    expect(descRow).not.toContain('\n');
  });
});

describe('updateReadme', () => {
  beforeEach(() => vi.clearAllMocks());

  const makeReadme = () =>
    [
      '# copilot-hub',
      '',
      '<!-- AUTO:start template-stats -->',
      'old stats',
      '<!-- AUTO:end template-stats -->',
      '',
      '<!-- AUTO:start plugin-table -->',
      'old table',
      '<!-- AUTO:end plugin-table -->',
    ].join('\n');

  it('updates both blocks and writes the file', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFs.readFileSync = vi.fn((p: unknown) => {
      if ((p as string).endsWith('README.md')) return makeReadme();
      return '';
    }) as any;
    mockFs.readdirSync = vi.fn().mockReturnValue([] as unknown as fs.Dirent[]);
    mockFs.writeFileSync = vi.fn();

    const changed = updateReadme('README.md', 'templates', 'plugins');
    expect(changed).toBe(true);
    expect(mockFs.writeFileSync).toHaveBeenCalledWith('README.md', expect.any(String), 'utf8');
    const written = vi.mocked(mockFs.writeFileSync).mock.calls[0][1] as string;
    expect(written).not.toContain('old stats');
    expect(written).not.toContain('old table');
  });

  it('returns false and does not write if no changes', () => {
    // Pre-build the exact output to simulate idempotency
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readdirSync = vi.fn().mockReturnValue([] as unknown as fs.Dirent[]);
    mockFs.writeFileSync = vi.fn();

    // File that already contains the generated content (new domain-based structure)
    const statsBlock = [
      '| Category | Count | Location | Purpose |',
      '| :--- | :---: | :--- | :--- |',
      '| **Agents** | 0 | `templates/<domain>/agents/` | Specialized expert roles (@-mentions) |',
      '| **Skills** | 0 | `templates/<domain>/skills/<name>/` | Reusable task-specific workflows |',
      '| **Prompts** | 0 | `templates/<domain>/prompts/` | Task-specific workflows (slash commands) |',
      '| **Instructions** | 0 | `templates/<domain>/instructions/` | Persistent project rules and standards |',
    ].join('\n');
    const pluginBlock = '| Plugin | Description |\n| :--- | :--- |';
    const alreadyGenerated = [
      '<!-- AUTO:start template-stats -->',
      statsBlock,
      '<!-- AUTO:end template-stats -->',
      '<!-- AUTO:start plugin-table -->',
      pluginBlock,
      '<!-- AUTO:end plugin-table -->',
    ].join('\n');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFs.readFileSync = vi.fn((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('README.md')) return alreadyGenerated;
      return '';
    }) as any;

    const changed = updateReadme('README.md', 'templates', 'plugins');
    expect(changed).toBe(false);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('returns false and warns when README.md does not exist', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);
    mockFs.writeFileSync = vi.fn();
    const changed = updateReadme('README.md', 'templates', 'plugins');
    expect(changed).toBe(false);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
});

describe('updateFileBlock', () => {
  const FILE_PATH = 'docs/overview.md';
  const fileWithMarkers =
    '# Overview\n\n<!-- AUTO:start version -->\nWelcome to **copilot-hub** v1.0.0 👋\n<!-- AUTO:end version -->\n\nSome content.\n';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.writeFileSync = vi.fn();
  });

  it('updates the block content and returns true when changed', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readFileSync = vi.fn().mockReturnValue(fileWithMarkers);

    const result = updateFileBlock(FILE_PATH, 'version', 'Welcome to **copilot-hub** v2.0.0 👋');

    expect(result).toBe(true);
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('v2.0.0');
  });

  it('returns false and does not write when content is unchanged', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readFileSync = vi.fn().mockReturnValue(fileWithMarkers);

    const result = updateFileBlock(FILE_PATH, 'version', 'Welcome to **copilot-hub** v1.0.0 👋');

    expect(result).toBe(false);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('returns false and warns when file does not exist', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);

    const result = updateFileBlock(FILE_PATH, 'version', 'Welcome to **copilot-hub** v2.0.0 👋');

    expect(result).toBe(false);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('returns false and warns when AUTO markers are missing', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readFileSync = vi.fn().mockReturnValue('# Overview\n\nNo markers here.\n');

    const result = updateFileBlock(FILE_PATH, 'version', 'Welcome to **copilot-hub** v2.0.0 👋');

    expect(result).toBe(false);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
});
