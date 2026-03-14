import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { generateMarketplace } from './marketplace-generator';

vi.mock('fs');

const mockPluginA = `
name: alpha-plugin
description: Alpha plugin description
version: "1.2.0"
keywords: [alpha, test]
`;

const mockPluginB = `
name: beta-plugin
description: >-
  Beta plugin with
  multiline description
version: "2.0.0"
keywords: [beta]
`;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('generateMarketplace', () => {
  it('generates marketplace.json with all plugins sorted by directory', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (p === 'plugins') return true;
      if (String(p).endsWith('plugin.config.yml')) return true;
      if (p === 'marketplace.json') return false;
      return false;
    });
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'beta-plugin', isDirectory: () => true },
      { name: 'alpha-plugin', isDirectory: () => true },
    ]);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p).includes('alpha-plugin')) return mockPluginA;
      if (String(p).includes('beta-plugin')) return mockPluginB;
      return '';
    });

    let written = '';
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation((_p: unknown, data: unknown) => {
      written = data as string;
    });

    generateMarketplace('plugins', 'marketplace.json');

    expect(fs.writeFileSync).toHaveBeenCalled();
    const parsed = JSON.parse(written);
    expect(parsed.name).toBe('copilot-hub');
    expect(parsed.plugins).toHaveLength(2);
    // sorted alphabetically
    expect(parsed.plugins[0].name).toBe('alpha-plugin');
    expect(parsed.plugins[1].name).toBe('beta-plugin');
  });

  it('collapses multiline description to single line', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (p === 'plugins') return true;
      if (String(p).endsWith('plugin.config.yml')) return true;
      if (p === 'marketplace.json') return false;
      return false;
    });
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'beta-plugin', isDirectory: () => true },
    ]);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(mockPluginB);

    let written = '';
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation((_p: unknown, data: unknown) => {
      written = data as string;
    });

    generateMarketplace('plugins', 'marketplace.json');

    const parsed = JSON.parse(written);
    expect(parsed.plugins[0].description).not.toContain('\n');
  });

  it('sets correct path for each plugin', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (p === 'plugins') return true;
      if (String(p).endsWith('plugin.config.yml')) return true;
      if (p === 'marketplace.json') return false;
      return false;
    });
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'my-plugin', isDirectory: () => true },
    ]);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(mockPluginA);
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    generateMarketplace('plugins', 'marketplace.json');

    const calls = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
    const parsed = JSON.parse(calls[0][1] as string);
    expect(parsed.plugins[0].path).toBe('plugins/my-plugin');
  });

  it('skips directories without plugin.config.yml', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (p === 'plugins') return true;
      if (String(p).includes('good-plugin') && String(p).endsWith('plugin.config.yml')) return true;
      if (String(p).includes('empty-dir') && String(p).endsWith('plugin.config.yml')) return false;
      if (p === 'marketplace.json') return false;
      return false;
    });
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'good-plugin', isDirectory: () => true },
      { name: 'empty-dir', isDirectory: () => true },
    ]);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(mockPluginA);

    let written = '';
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation((_p: unknown, data: unknown) => {
      written = data as string;
    });

    generateMarketplace('plugins', 'marketplace.json');

    const parsed = JSON.parse(written);
    expect(parsed.plugins).toHaveLength(1);
  });

  it('does not write if content is unchanged', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (p === 'plugins') return true;
      if (String(p).endsWith('plugin.config.yml')) return true;
      return true; // marketplace.json exists
    });
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'alpha-plugin', isDirectory: () => true },
    ]);

    // Return same content that would be generated
    const expected = JSON.stringify(
      {
        name: 'copilot-hub',
        description:
          "A curated hub for sharing GitHub Copilot instructions, agents, prompts, and CLI plugins — your team's Copilot marketplace.",
        repository: 'GravionLabs/copilot-hub',
        plugins: [
          {
            name: 'alpha-plugin',
            path: 'plugins/alpha-plugin',
            description: 'Alpha plugin description',
            version: '1.2.0',
            keywords: ['alpha', 'test'],
          },
        ],
      },
      null,
      2
    ) + '\n';

    (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      if (String(p) === 'marketplace.json') return expected;
      return mockPluginA;
    });

    generateMarketplace('plugins', 'marketplace.json');

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('warns and returns if plugins dir does not exist', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    generateMarketplace('plugins', 'marketplace.json');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
