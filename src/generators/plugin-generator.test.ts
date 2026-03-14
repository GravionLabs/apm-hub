import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { generatePlugin, resolveSkillSource, resolveTemplatePath } from './plugin-generator';

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
    copyFileSync: (src: string, dest: string) => {
      if (!existingFiles.has(src)) throw new Error(`ENOENT: no such file: ${src}`);
      writtenFiles.set(dest, existingFiles.get(src)!);
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveTemplatePath', () => {
  it('agents/ without extension → appends .agent.md', () => {
    expect(resolveTemplatePath('agents/gfog-helm')).toBe('agents/gfog-helm.agent.md');
  });

  it('agents/ with extension → unchanged', () => {
    expect(resolveTemplatePath('agents/gfog-helm.agent.md')).toBe('agents/gfog-helm.agent.md');
  });

  it('prompts/ without extension → appends .prompt.md', () => {
    expect(resolveTemplatePath('prompts/csharp-nunit')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('prompts/ with extension → unchanged', () => {
    expect(resolveTemplatePath('prompts/csharp-nunit.prompt.md')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('instructions/ without extension → appends .instructions.md', () => {
    expect(resolveTemplatePath('instructions/csharp')).toBe('instructions/csharp.instructions.md');
  });

  it('instructions/ with extension → unchanged', () => {
    expect(resolveTemplatePath('instructions/csharp.instructions.md')).toBe('instructions/csharp.instructions.md');
  });

  it('bare name → prompts/<name>.prompt.md', () => {
    expect(resolveTemplatePath('csharp-nunit')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('bare name with extension → prompts/<name>', () => {
    expect(resolveTemplatePath('csharp-nunit.prompt.md')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('unknown directory without extension → appends .prompt.md as fallback', () => {
    expect(resolveTemplatePath('custom/my-template')).toBe('custom/my-template.prompt.md');
  });
});

describe('resolveSkillSource', () => {
  it('no source → prompts/<name>.prompt.md', () => {
    expect(resolveSkillSource('csharp-nunit')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('bare name as source → prompts/<source>.prompt.md', () => {
    expect(resolveSkillSource('my-skill', 'csharp-nunit')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('name with .prompt.md suffix → prompts/<source>', () => {
    expect(resolveSkillSource('my-skill', 'csharp-nunit.prompt.md')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('full path with .prompt.md → unchanged', () => {
    expect(resolveSkillSource('my-skill', 'prompts/csharp-nunit.prompt.md')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('agent path with extension → unchanged', () => {
    expect(resolveSkillSource('gfog-helm', 'agents/gfog-helm.agent.md')).toBe('agents/gfog-helm.agent.md');
  });

  it('agent path without extension → appends .agent.md', () => {
    expect(resolveSkillSource('gfog-helm', 'agents/gfog-helm')).toBe('agents/gfog-helm.agent.md');
  });

  it('path without extension → appends .prompt.md', () => {
    expect(resolveSkillSource('my-skill', 'prompts/my-skill')).toBe('prompts/my-skill.prompt.md');
  });

  it('bare name without source equals bare name as source', () => {
    expect(resolveSkillSource('dotnet-best-practices')).toBe(
      resolveSkillSource('dotnet-best-practices', 'dotnet-best-practices'),
    );
  });
});

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

  describe('skill source resolution in generatePlugin', () => {
    it('resolves skill without source from name (prompts/<name>.prompt.md)', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'csharp-nunit.prompt.md');
      existingFiles.set(CONFIG_PATH, makeConfig({
        skills: [{ name: 'csharp-nunit' }],
      }));
      existingFiles.set(promptPath, '---\ndescription: NUnit\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'csharp-nunit', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('resolves skill with bare source name (prompts/<source>.prompt.md)', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'csharp-nunit.prompt.md');
      existingFiles.set(CONFIG_PATH, makeConfig({
        skills: [{ name: 'my-nunit-skill', source: 'csharp-nunit' }],
      }));
      existingFiles.set(promptPath, '---\ndescription: NUnit\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'my-nunit-skill', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('resolves skill with source name including .prompt.md suffix', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'csharp-nunit.prompt.md');
      existingFiles.set(CONFIG_PATH, makeConfig({
        skills: [{ name: 'my-skill', source: 'csharp-nunit.prompt.md' }],
      }));
      existingFiles.set(promptPath, '---\ndescription: NUnit\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'my-skill', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('still resolves explicit agent path unchanged', () => {
      const agentPath = path.join(TEMPLATES_DIR, 'agents', 'gfog-helm.agent.md');
      existingFiles.set(CONFIG_PATH, makeConfig({
        skills: [{ name: 'gfog-helm', source: 'agents/gfog-helm.agent.md' }],
      }));
      existingFiles.set(agentPath, '---\ndescription: Helm\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'gfog-helm', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('resolves agents/ source without extension', () => {
      const agentPath = path.join(TEMPLATES_DIR, 'agents', 'gfog-helm.agent.md');
      existingFiles.set(CONFIG_PATH, makeConfig({
        skills: [{ name: 'gfog-helm', source: 'agents/gfog-helm' }],
      }));
      existingFiles.set(agentPath, '---\ndescription: Helm\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'gfog-helm', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('resolves extend entry without extension', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'csharp-code-review.prompt.md');
      const agentPath = path.join(TEMPLATES_DIR, 'agents', 'code-review-cli.agent.md');
      existingFiles.set(CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
        '  - name: csharp-code-review\n    extend:\n      - agents/code-review-cli\n',
      );
      existingFiles.set(promptPath, '---\ndescription: Review\n---\n\nReview content.\n');
      existingFiles.set(agentPath, '---\ndescription: CLI\n---\n\nCLI content.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'csharp-code-review', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
      expect(writtenFiles.get(skillPath)).toContain('CLI content.');
    });
  });

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
  // Files — arbitrary file copy
  // -------------------------------------------------------------------------

  describe('plugin with files', () => {
    const REPO_ROOT = path.dirname(TEMPLATES_DIR); // /fake
    const editorConfigSource = path.join(REPO_ROOT, 'editor-configs', '.editorconfig-csharp');
    const editorConfigContent = '# editorconfig\nroot = true\n';

    it('copies a file to the plugin directory using destination', () => {
      existingFiles.set(CONFIG_PATH, makeConfig({
        files: [{ source: 'editor-configs/.editorconfig-csharp', destination: '.editorconfig' }],
      }));
      existingFiles.set(editorConfigSource, editorConfigContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destPath = path.join(PLUGIN_DIR, '.editorconfig');
      expect(writtenFiles.has(destPath)).toBe(true);
      expect(writtenFiles.get(destPath)).toBe(editorConfigContent);
    });

    it('uses basename of source when no destination is specified', () => {
      existingFiles.set(CONFIG_PATH, makeConfig({
        files: [{ source: 'editor-configs/.editorconfig-csharp' }],
      }));
      existingFiles.set(editorConfigSource, editorConfigContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destPath = path.join(PLUGIN_DIR, '.editorconfig-csharp');
      expect(writtenFiles.has(destPath)).toBe(true);
    });

    it('warns and skips when source file does not exist', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      existingFiles.set(CONFIG_PATH, makeConfig({
        files: [{ source: 'editor-configs/nonexistent.editorconfig', destination: '.editorconfig' }],
      }));

      expect(() => generatePlugin(CONFIG_PATH, TEMPLATES_DIR)).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    });

    it('plugin.json does not include files field', () => {
      existingFiles.set(CONFIG_PATH, makeConfig({
        files: [{ source: 'editor-configs/.editorconfig-csharp', destination: '.editorconfig' }],
      }));
      existingFiles.set(editorConfigSource, editorConfigContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('files');
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
