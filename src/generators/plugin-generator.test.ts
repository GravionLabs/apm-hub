import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { generatePlugin } from './plugin-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLUGIN_DIR = '/fake/plugins/my-plugin';
const TEMPLATES_DIR = '/fake/templates';
const CONFIG_PATH = path.join(PLUGIN_DIR, 'plugin.config.yml');

function makeConfig(overrides: Record<string, unknown> = {}): string {
  const base = {
    name: 'my-plugin',
    description: 'Test plugin',
    version: '1.0.0',
    agents: [],
    skills: [],
    ...overrides,
  };
  // Build minimal YAML manually to avoid adding yaml as a test dependency concern
  const lines = Object.entries(base).map(([k, v]) => {
    if (Array.isArray(v)) {
      if (v.length === 0) return `${k}: []`;
      return `${k}:\n` + (v as Record<string, unknown>[]).map((item) => {
        const entries = Object.entries(item).map(([ik, iv]) => `    ${ik}: ${iv}`).join('\n');
        return `  -\n${entries}`;
      }).join('\n');
    }
    return `${k}: ${JSON.stringify(v)}`;
  });
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// FS mock
// ---------------------------------------------------------------------------

const writtenFiles = new Map<string, string>();
const createdDirs = new Set<string>();
const existingFiles = new Map<string, string>();

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (p: string) => existingFiles.has(p),
    readFileSync: (p: string, _enc: string) => {
      if (existingFiles.has(p)) return existingFiles.get(p)!;
      throw new Error(`ENOENT: no such file: ${p}`);
    },
    mkdirSync: (p: string, _opts?: unknown) => { createdDirs.add(p); },
    writeFileSync: (p: string, content: string, _enc: string) => { writtenFiles.set(p, content); },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plugin-generator', () => {
  beforeEach(() => {
    writtenFiles.clear();
    createdDirs.clear();
    existingFiles.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Existing behaviour — plugin without instructions
  // -------------------------------------------------------------------------

  describe('plugin without instructions', () => {
    it('plugin.json omits instructions field when no instructions configured', () => {
      const yaml = makeConfig({ agents: [], skills: [] });
      existingFiles.set(CONFIG_PATH, yaml);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      expect(writtenFiles.has(pluginJsonPath)).toBe(true);
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('instructions');
    });

    it('plugin.json omits instructions field when instructions array is empty', () => {
      const yaml = makeConfig({ agents: [], skills: [], instructions: [] });
      existingFiles.set(CONFIG_PATH, yaml);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('instructions');
    });
  });

  // -------------------------------------------------------------------------
  // Instructions — happy path
  // -------------------------------------------------------------------------

  describe('plugin with instructions', () => {
    const instructionSourcePath = path.join(TEMPLATES_DIR, 'instructions', 'csharp.instructions.md');
    const instructionContent = '---\ndescription: C# rules\napplyTo: "**/*.cs"\n---\n\nUse C# best practices.\n';

    it('creates the instructions/ directory', () => {
      existingFiles.set(CONFIG_PATH, makeConfig({
        instructions: [{ source: 'csharp' }],
      }));
      existingFiles.set(instructionSourcePath, instructionContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const expectedDir = path.join(PLUGIN_DIR, 'instructions');
      expect(createdDirs.has(expectedDir)).toBe(true);
    });

    it('copies the instruction file to instructions/<source>.instructions.md', () => {
      existingFiles.set(CONFIG_PATH, makeConfig({
        instructions: [{ source: 'csharp' }],
      }));
      existingFiles.set(instructionSourcePath, instructionContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destPath = path.join(PLUGIN_DIR, 'instructions', 'csharp.instructions.md');
      expect(writtenFiles.has(destPath)).toBe(true);
      expect(writtenFiles.get(destPath)).toBe(instructionContent);
    });

    it('supports source with full .instructions.md extension', () => {
      existingFiles.set(CONFIG_PATH, makeConfig({
        instructions: [{ source: 'csharp.instructions.md' }],
      }));
      existingFiles.set(instructionSourcePath, instructionContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destPath = path.join(PLUGIN_DIR, 'instructions', 'csharp.instructions.md');
      expect(writtenFiles.has(destPath)).toBe(true);
    });

    it('plugin.json includes instructions array with relative paths', () => {
      existingFiles.set(CONFIG_PATH, makeConfig({
        instructions: [{ source: 'csharp' }],
      }));
      existingFiles.set(instructionSourcePath, instructionContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest.instructions).toEqual(['./instructions/csharp.instructions.md']);
    });

    it('plugin.json includes multiple instruction paths', () => {
      const nunitPath = path.join(TEMPLATES_DIR, 'instructions', 'csharp-nunit.instructions.md');
      existingFiles.set(CONFIG_PATH, makeConfig({
        instructions: [{ source: 'csharp' }, { source: 'csharp-nunit' }],
      }));
      existingFiles.set(instructionSourcePath, instructionContent);
      existingFiles.set(nunitPath, '---\ndescription: NUnit rules\n---\n\nUse NUnit.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest.instructions).toEqual([
        './instructions/csharp.instructions.md',
        './instructions/csharp-nunit.instructions.md',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Instructions — missing source file
  // -------------------------------------------------------------------------

  describe('missing instruction source file', () => {
    it('logs a warning but does not throw', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      existingFiles.set(CONFIG_PATH, makeConfig({
        instructions: [{ source: 'nonexistent' }],
      }));
      // source file is NOT in existingFiles

      expect(() => generatePlugin(CONFIG_PATH, TEMPLATES_DIR)).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    });

    it('omits the missing file from plugin.json instructions array', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      existingFiles.set(CONFIG_PATH, makeConfig({
        instructions: [{ source: 'nonexistent' }],
      }));

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('instructions');
    });

    it('continues generating remaining instructions after a missing file', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const csharpPath = path.join(TEMPLATES_DIR, 'instructions', 'csharp.instructions.md');
      existingFiles.set(CONFIG_PATH, makeConfig({
        instructions: [{ source: 'nonexistent' }, { source: 'csharp' }],
      }));
      existingFiles.set(csharpPath, '---\ndescription: C#\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest.instructions).toEqual(['./instructions/csharp.instructions.md']);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('throws when config file does not exist', () => {
    expect(() => generatePlugin('/does/not/exist/plugin.config.yml', TEMPLATES_DIR)).toThrow(
      'Plugin config not found',
    );
  });
});
