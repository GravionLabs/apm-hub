import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import {
  generatePlugin,
  updatePluginConfigVersion,
  resolveSkillSource,
  resolveTemplatePath,
} from './plugin-generator';

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
      return (
        `${k}:\n` +
        (v as Record<string, unknown>[])
          .map((item) => {
            const entries = Object.entries(item)
              .map(([ik, iv]) => `    ${ik}: ${iv}`)
              .join('\n');
            return `  -\n${entries}`;
          })
          .join('\n')
      );
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
const existingDirs = new Set<string>();

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (p: string) => existingFiles.has(p) || existingDirs.has(p),
    readFileSync: (p: string, _enc: string) => {
      if (existingFiles.has(p)) return existingFiles.get(p)!;
      throw new Error(`ENOENT: no such file: ${p}`);
    },
    mkdirSync: (p: string, _opts?: unknown) => {
      createdDirs.add(p);
    },
    writeFileSync: (p: string, content: string, _enc: string) => {
      writtenFiles.set(p, content);
    },
    copyFileSync: (src: string, dest: string) => {
      if (!existingFiles.has(src)) throw new Error(`ENOENT: no such file: ${src}`);
      writtenFiles.set(dest, existingFiles.get(src)!);
    },
    statSync: (p: string) => ({
      isDirectory: () => existingDirs.has(p),
    }),
    readdirSync: (p: string, _opts?: unknown) => {
      const fileEntries = [...existingFiles.keys()]
        .filter((k) => path.dirname(k) === p)
        .map((k) => ({ name: path.basename(k), isDirectory: () => false }));
      const dirEntries = [...existingDirs]
        .filter((d) => path.dirname(d) === p)
        .map((d) => ({ name: path.basename(d), isDirectory: () => true }));
      return [...fileEntries, ...dirEntries];
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
    expect(resolveTemplatePath('prompts/csharp-nunit.prompt.md')).toBe(
      'prompts/csharp-nunit.prompt.md'
    );
  });

  it('instructions/ without extension → appends .instructions.md', () => {
    expect(resolveTemplatePath('instructions/csharp')).toBe('instructions/csharp.instructions.md');
  });

  it('instructions/ with extension → unchanged', () => {
    expect(resolveTemplatePath('instructions/csharp.instructions.md')).toBe(
      'instructions/csharp.instructions.md'
    );
  });

  it('bare name → prompts/<name>.prompt.md', () => {
    expect(resolveTemplatePath('csharp-nunit')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('bare name with extension → prompts/<name>', () => {
    expect(resolveTemplatePath('csharp-nunit.prompt.md')).toBe('prompts/csharp-nunit.prompt.md');
  });

  it('domain path without templatesDir → appends .skill.md as fallback', () => {
    expect(resolveTemplatePath('custom/my-template')).toBe('custom/my-template.skill.md');
  });

  it('skills/ without extension → appends .skill.md', () => {
    expect(resolveTemplatePath('skills/write-tests')).toBe('skills/write-tests.skill.md');
  });

  it('skills/ with extension → unchanged', () => {
    expect(resolveTemplatePath('skills/write-tests.skill.md')).toBe('skills/write-tests.skill.md');
  });

  it('domain path with templatesDir → discovers .skill.md extension', () => {
    existingFiles.set('/fake/templates/shared/write-tests.skill.md', 'content');
    expect(resolveTemplatePath('shared/write-tests', '/fake/templates')).toBe(
      'shared/write-tests.skill.md'
    );
    existingFiles.clear();
  });

  it('domain path with templatesDir → discovers .agent.md extension', () => {
    existingFiles.set('/fake/templates/devops/create-pr.agent.md', 'content');
    expect(resolveTemplatePath('devops/create-pr', '/fake/templates')).toBe(
      'devops/create-pr.agent.md'
    );
    existingFiles.clear();
  });

  it('domain path with templatesDir → discovers .instructions.md extension', () => {
    existingFiles.set('/fake/templates/csharp/csharp.instructions.md', 'content');
    expect(resolveTemplatePath('csharp/csharp', '/fake/templates')).toBe(
      'csharp/csharp.instructions.md'
    );
    existingFiles.clear();
  });

  it('domain path with templatesDir → fallback to .skill.md when no file found', () => {
    expect(resolveTemplatePath('unknown/no-match', '/fake/templates')).toBe(
      'unknown/no-match.skill.md'
    );
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
    expect(resolveSkillSource('my-skill', 'csharp-nunit.prompt.md')).toBe(
      'prompts/csharp-nunit.prompt.md'
    );
  });

  it('full path with .prompt.md → unchanged', () => {
    expect(resolveSkillSource('my-skill', 'prompts/csharp-nunit.prompt.md')).toBe(
      'prompts/csharp-nunit.prompt.md'
    );
  });

  it('agent path with extension → unchanged', () => {
    expect(resolveSkillSource('gfog-helm', 'agents/gfog-helm.agent.md')).toBe(
      'agents/gfog-helm.agent.md'
    );
  });

  it('agent path without extension → appends .agent.md', () => {
    expect(resolveSkillSource('gfog-helm', 'agents/gfog-helm')).toBe('agents/gfog-helm.agent.md');
  });

  it('skills/ path without extension → appends .skill.md', () => {
    expect(resolveSkillSource('write-tests', 'skills/write-tests')).toBe(
      'skills/write-tests.skill.md'
    );
  });

  it('skills/ path with extension → unchanged', () => {
    expect(resolveSkillSource('write-tests', 'skills/write-tests.skill.md')).toBe(
      'skills/write-tests.skill.md'
    );
  });

  it('path without extension → appends .prompt.md', () => {
    expect(resolveSkillSource('my-skill', 'prompts/my-skill')).toBe('prompts/my-skill.prompt.md');
  });

  it('bare name without source equals bare name as source', () => {
    expect(resolveSkillSource('dotnet-best-practices')).toBe(
      resolveSkillSource('dotnet-best-practices', 'dotnet-best-practices')
    );
  });
});

describe('plugin-generator', () => {
  beforeEach(() => {
    writtenFiles.clear();
    createdDirs.clear();
    existingFiles.clear();
    existingDirs.clear();
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
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          skills: [{ name: 'csharp-nunit' }],
        })
      );
      existingFiles.set(promptPath, '---\ndescription: NUnit\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'csharp-nunit', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('resolves skill with bare source name (prompts/<source>.prompt.md)', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'csharp-nunit.prompt.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          skills: [{ name: 'my-nunit-skill', source: 'csharp-nunit' }],
        })
      );
      existingFiles.set(promptPath, '---\ndescription: NUnit\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'my-nunit-skill', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('resolves skill with source name including .prompt.md suffix', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'csharp-nunit.prompt.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          skills: [{ name: 'my-skill', source: 'csharp-nunit.prompt.md' }],
        })
      );
      existingFiles.set(promptPath, '---\ndescription: NUnit\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'my-skill', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('still resolves explicit agent path unchanged', () => {
      const agentPath = path.join(TEMPLATES_DIR, 'agents', 'gfog-helm.agent.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          skills: [{ name: 'gfog-helm', source: 'agents/gfog-helm.agent.md' }],
        })
      );
      existingFiles.set(agentPath, '---\ndescription: Helm\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'gfog-helm', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('resolves agents/ source without extension', () => {
      const agentPath = path.join(TEMPLATES_DIR, 'agents', 'gfog-helm.agent.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          skills: [{ name: 'gfog-helm', source: 'agents/gfog-helm' }],
        })
      );
      existingFiles.set(agentPath, '---\ndescription: Helm\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'gfog-helm', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
    });

    it('resolves extend entry without extension', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'csharp-code-review.prompt.md');
      const agentPath = path.join(TEMPLATES_DIR, 'agents', 'code-review-cli.agent.md');
      existingFiles.set(
        CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
          '  - name: csharp-code-review\n    extend:\n      - agents/code-review-cli\n'
      );
      existingFiles.set(promptPath, '---\ndescription: Review\n---\n\nReview content.\n');
      existingFiles.set(agentPath, '---\ndescription: CLI\n---\n\nCLI content.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'csharp-code-review', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
      expect(writtenFiles.get(skillPath)).toContain('CLI content.');
    });

    it('resolves domain skill source to .skill.md when file exists (e.g. csharp/csharp-code-review)', () => {
      const skillTemplatePath = path.join(TEMPLATES_DIR, 'csharp', 'csharp-code-review.skill.md');
      const SKILL_CONTENT =
        "---\nname: csharp-code-review\ndescription: 'C# code review'\nallowed-tools: codebase editFiles\n---\n\nReview C# code.\n";
      existingFiles.set(
        CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
          '  - name: csharp-code-review\n    source: csharp/csharp-code-review\n'
      );
      existingFiles.set(skillTemplatePath, SKILL_CONTENT);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'csharp-code-review', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
      expect(writtenFiles.get(skillPath)).toBe(SKILL_CONTENT);
    });

    it('maps tools: array to allowed-tools in SKILL.md', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'my-tool-skill.prompt.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({ skills: [{ name: 'my-tool-skill' }] })
      );
      existingFiles.set(
        promptPath,
        "---\ndescription: Skill with tools\ntools: ['codebase', 'runCommands', 'editFiles']\n---\n\nContent.\n"
      );

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'my-tool-skill', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
      const content = writtenFiles.get(skillPath)!;
      expect(content).toContain('allowed-tools: codebase runCommands editFiles');
      expect(content).not.toContain("tools: ['codebase'");
    });

    it('passes through argument-hint to SKILL.md', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'my-arg-skill.prompt.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({ skills: [{ name: 'my-arg-skill' }] })
      );
      existingFiles.set(
        promptPath,
        "---\ndescription: Skill with arg-hint\nargument-hint: '<issue-number>'\n---\n\nContent.\n"
      );

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'my-arg-skill', 'SKILL.md');
      const content = writtenFiles.get(skillPath)!;
      expect(content).toContain('argument-hint:');
    });

    it('omits allowed-tools when tools field is absent', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'no-tools-skill.prompt.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({ skills: [{ name: 'no-tools-skill' }] })
      );
      existingFiles.set(promptPath, '---\ndescription: Simple skill\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'no-tools-skill', 'SKILL.md');
      const content = writtenFiles.get(skillPath)!;
      expect(content).not.toContain('allowed-tools');
    });
  });

  describe('.skill.md passthrough (domain source)', () => {
    const SKILL_CONTENT =
      "---\nname: write-tests\ndescription: 'Write unit tests'\nallowed-tools: codebase editFiles\n---\n\nWrite tests.\n";

    it('copies .skill.md content as-is when source is domain/<name>', () => {
      const skillTemplatePath = path.join(TEMPLATES_DIR, 'shared', 'write-tests.skill.md');
      existingFiles.set(
        CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
          '  - name: write-tests\n    source: shared/write-tests\n'
      );
      existingFiles.set(skillTemplatePath, SKILL_CONTENT);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'write-tests', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
      expect(writtenFiles.get(skillPath)).toBe(SKILL_CONTENT);
    });

    it('does NOT apply prompt→skill transform for .skill.md source (preserves original frontmatter)', () => {
      const skillTemplatePath = path.join(TEMPLATES_DIR, 'shared', 'write-tests.skill.md');
      existingFiles.set(
        CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
          '  - name: write-tests\n    source: shared/write-tests\n'
      );
      existingFiles.set(skillTemplatePath, SKILL_CONTENT);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'write-tests', 'SKILL.md');
      const content = writtenFiles.get(skillPath)!;
      // Frontmatter must be exactly as in the template — no re-generation
      expect(content).toContain("allowed-tools: codebase editFiles");
      // Should NOT have been re-wrapped with a new frontmatter block (2 --- markers = original open+close)
      expect(content.match(/^---/gm)?.length).toBe(2);
    });

    it('copies .skill.md with explicit .skill.md extension in domain source', () => {
      const skillTemplatePath = path.join(TEMPLATES_DIR, 'shared', 'write-tests.skill.md');
      existingFiles.set(
        CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
          '  - name: write-tests\n    source: shared/write-tests.skill.md\n'
      );
      existingFiles.set(skillTemplatePath, SKILL_CONTENT);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'write-tests', 'SKILL.md');
      expect(writtenFiles.get(skillPath)).toBe(SKILL_CONTENT);
    });

    it('discovers .agent.md extension for domain skill source (e.g. devops/create-pr)', () => {
      const agentTemplatePath = path.join(TEMPLATES_DIR, 'devops', 'create-pr.agent.md');
      existingFiles.set(
        CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
          '  - name: create-pr\n    source: devops/create-pr\n'
      );
      existingFiles.set(agentTemplatePath, '---\ndescription: Create PR\n---\n\nCreate a PR.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const skillPath = path.join(PLUGIN_DIR, 'skills', 'create-pr', 'SKILL.md');
      expect(writtenFiles.has(skillPath)).toBe(true);
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
    const instructionSourcePath = path.join(
      TEMPLATES_DIR,
      'csharp',
      'csharp.instructions.md'
    );
    const instructionContent =
      '---\ndescription: C# rules\napplyTo: "**/*.cs"\n---\n\nUse C# best practices.\n';

    it('creates the instructions/ directory', () => {
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          instructions: [{ source: 'csharp/csharp' }],
        })
      );
      existingFiles.set(instructionSourcePath, instructionContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const expectedDir = path.join(PLUGIN_DIR, 'instructions');
      expect(createdDirs.has(expectedDir)).toBe(true);
    });

    it('copies the instruction file to instructions/<name>.instructions.md', () => {
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          instructions: [{ source: 'csharp/csharp' }],
        })
      );
      existingFiles.set(instructionSourcePath, instructionContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destPath = path.join(PLUGIN_DIR, 'instructions', 'csharp.instructions.md');
      expect(writtenFiles.has(destPath)).toBe(true);
      expect(writtenFiles.get(destPath)).toBe(instructionContent);
    });

    it('supports source with full .instructions.md extension', () => {
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          instructions: [{ source: 'csharp/csharp.instructions.md' }],
        })
      );
      existingFiles.set(instructionSourcePath, instructionContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destPath = path.join(PLUGIN_DIR, 'instructions', 'csharp.instructions.md');
      expect(writtenFiles.has(destPath)).toBe(true);
    });

    it('plugin.json does NOT include instructions array', () => {
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          instructions: [{ source: 'csharp/csharp' }],
        })
      );
      existingFiles.set(instructionSourcePath, instructionContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('instructions');
    });

    it('plugin.json does NOT include multiple instruction paths', () => {
      const nunitPath = path.join(TEMPLATES_DIR, 'csharp', 'csharp-nunit.instructions.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          instructions: [{ source: 'csharp/csharp' }, { source: 'csharp/csharp-nunit' }],
        })
      );
      existingFiles.set(instructionSourcePath, instructionContent);
      existingFiles.set(nunitPath, '---\ndescription: NUnit rules\n---\n\nUse NUnit.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('instructions');
    });
  });

  // -------------------------------------------------------------------------
  // Instructions — missing source file
  // -------------------------------------------------------------------------

  describe('missing instruction source file', () => {
    it('logs a warning but does not throw', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          instructions: [{ source: 'nonexistent' }],
        })
      );
      // source file is NOT in existingFiles

      expect(() => generatePlugin(CONFIG_PATH, TEMPLATES_DIR)).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    });

    it('omits the missing file from plugin.json instructions array', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          instructions: [{ source: 'nonexistent' }],
        })
      );

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('instructions');
    });

    it('continues generating remaining instruction files after a missing file', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const csharpPath = path.join(TEMPLATES_DIR, 'csharp', 'csharp.instructions.md');
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          instructions: [{ source: 'nonexistent' }, { source: 'csharp/csharp' }],
        })
      );
      existingFiles.set(csharpPath, '---\ndescription: C#\n---\n\nContent.\n');

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      // Instruction file is still copied to disk
      const destPath = path.join(PLUGIN_DIR, 'instructions', 'csharp.instructions.md');
      expect(writtenFiles.has(destPath)).toBe(true);

      // But plugin.json must NOT have an instructions field
      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('instructions');
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
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          files: [{ source: 'editor-configs/.editorconfig-csharp', destination: '.editorconfig' }],
        })
      );
      existingFiles.set(editorConfigSource, editorConfigContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destPath = path.join(PLUGIN_DIR, '.editorconfig');
      expect(writtenFiles.has(destPath)).toBe(true);
      expect(writtenFiles.get(destPath)).toBe(editorConfigContent);
    });

    it('uses basename of source when no destination is specified', () => {
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          files: [{ source: 'editor-configs/.editorconfig-csharp' }],
        })
      );
      existingFiles.set(editorConfigSource, editorConfigContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destPath = path.join(PLUGIN_DIR, '.editorconfig-csharp');
      expect(writtenFiles.has(destPath)).toBe(true);
    });

    it('warns and skips when source file does not exist', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          files: [
            { source: 'editor-configs/nonexistent.editorconfig', destination: '.editorconfig' },
          ],
        })
      );

      expect(() => generatePlugin(CONFIG_PATH, TEMPLATES_DIR)).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    });

    it('plugin.json does not include files field', () => {
      existingFiles.set(
        CONFIG_PATH,
        makeConfig({
          files: [{ source: 'editor-configs/.editorconfig-csharp', destination: '.editorconfig' }],
        })
      );
      existingFiles.set(editorConfigSource, editorConfigContent);

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const pluginJsonPath = path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json');
      const manifest = JSON.parse(writtenFiles.get(pluginJsonPath)!);
      expect(manifest).not.toHaveProperty('files');
    });
  });

  // -------------------------------------------------------------------------
  // Skill companion directories
  // -------------------------------------------------------------------------

  describe('skill companion directories', () => {
    it('copies companion directory files alongside SKILL.md', () => {
      const skillTemplatePath = path.join(TEMPLATES_DIR, 'csharp', 'create-dotnet-solution.skill.md');
      const companionDir = path.join(TEMPLATES_DIR, 'csharp', 'create-dotnet-solution');
      const editorConfigPath = path.join(companionDir, 'templates', '.editorconfig');

      existingFiles.set(CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
        '  - name: create-dotnet-solution\n    source: csharp/create-dotnet-solution\n'
      );
      existingFiles.set(skillTemplatePath, "---\nname: create-dotnet-solution\ndescription: 'Scaffold solution'\nallowed-tools: editFiles\n---\n\nContent.\n");
      existingFiles.set(editorConfigPath, '# editorconfig content');
      existingDirs.add(companionDir);
      existingDirs.add(path.join(companionDir, 'templates'));

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      const destEditorConfig = path.join(PLUGIN_DIR, 'skills', 'create-dotnet-solution', 'templates', '.editorconfig');
      expect(writtenFiles.has(destEditorConfig)).toBe(true);
      expect(writtenFiles.get(destEditorConfig)).toBe('# editorconfig content');
    });

    it('does not fail when no companion directory exists', () => {
      const skillTemplatePath = path.join(TEMPLATES_DIR, 'shared', 'write-tests.skill.md');
      existingFiles.set(CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills:\n' +
        '  - name: write-tests\n    source: shared/write-tests\n'
      );
      existingFiles.set(skillTemplatePath, "---\nname: write-tests\ndescription: 'Write tests'\nallowed-tools: codebase\n---\n\nContent.\n");
      // No companion dir added to existingDirs

      expect(() => generatePlugin(CONFIG_PATH, TEMPLATES_DIR)).not.toThrow();
    });

    it('does not copy companion directory for non-.skill.md sources', () => {
      const promptPath = path.join(TEMPLATES_DIR, 'prompts', 'csharp-nunit.prompt.md');
      const companionDir = path.join(TEMPLATES_DIR, 'prompts', 'csharp-nunit');

      existingFiles.set(CONFIG_PATH, makeConfig({ skills: [{ name: 'csharp-nunit' }] }));
      existingFiles.set(promptPath, '---\ndescription: NUnit\n---\n\nContent.\n');
      existingDirs.add(companionDir); // companion dir exists but should be ignored

      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

      // No files from companion dir should be copied
      const anyCompanionFile = [...writtenFiles.keys()].find((k) =>
        k.includes('skills/csharp-nunit') && !k.endsWith('SKILL.md')
      );
      expect(anyCompanionFile).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // plugin.json new fields
  // -------------------------------------------------------------------------

  describe('plugin.json new fields', () => {
    it('includes category in plugin.json', () => {
      existingFiles.set(CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\ncategory: "development"\nagents: []\nskills: []\n'
      );
      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);
      const manifest = JSON.parse(writtenFiles.get(path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json'))!);
      expect(manifest.category).toBe('development');
    });

    it('includes tags in plugin.json', () => {
      existingFiles.set(CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\ntags:\n  - react\n  - frontend\nagents: []\nskills: []\n'
      );
      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);
      const manifest = JSON.parse(writtenFiles.get(path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json'))!);
      expect(manifest.tags).toEqual(['react', 'frontend']);
    });

    it('includes hooks path with ./ prefix in plugin.json', () => {
      existingFiles.set(CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nhooks: hooks/hooks.json\nagents: []\nskills: []\n'
      );
      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);
      const manifest = JSON.parse(writtenFiles.get(path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json'))!);
      expect(manifest.hooks).toBe('./hooks/hooks.json');
    });

    it('includes mcpServers path in plugin.json', () => {
      existingFiles.set(CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nmcpServers: .mcp.json\nagents: []\nskills: []\n'
      );
      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);
      const manifest = JSON.parse(writtenFiles.get(path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json'))!);
      expect(manifest.mcpServers).toBe('./.mcp.json');
    });

    it('plugin.json does NOT include instructions', () => {
      const instructionPath = path.join(TEMPLATES_DIR, 'csharp', 'csharp.instructions.md');
      existingFiles.set(CONFIG_PATH,
        'name: my-plugin\ndescription: Test\nversion: "1.0.0"\nagents: []\nskills: []\ninstructions:\n  - source: csharp/csharp\n'
      );
      existingFiles.set(instructionPath, '---\ndescription: C#\n---\n\nContent.\n');
      generatePlugin(CONFIG_PATH, TEMPLATES_DIR);
      const manifest = JSON.parse(writtenFiles.get(path.join(PLUGIN_DIR, '.github', 'plugin', 'plugin.json'))!);
      expect(manifest).not.toHaveProperty('instructions');
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('throws when config file does not exist', () => {
    expect(() => generatePlugin('/does/not/exist/plugin.config.yml', TEMPLATES_DIR)).toThrow(
      'Plugin config not found'
    );
  });
});

// ---------------------------------------------------------------------------
// updatePluginConfigVersion
// ---------------------------------------------------------------------------

describe('updatePluginConfigVersion', () => {
  beforeEach(() => {
    writtenFiles.clear();
    existingFiles.clear();
  });

  it('updates the version field in plugin.config.yml', () => {
    const content = 'name: my-plugin\nversion: "1.0.0"\ndescription: Test\n';
    existingFiles.set(CONFIG_PATH, content);

    updatePluginConfigVersion(CONFIG_PATH, '2.3.4');

    expect(writtenFiles.get(CONFIG_PATH)).toBe(
      'name: my-plugin\nversion: "2.3.4"\ndescription: Test\n'
    );
  });

  it('does not write the file when version is unchanged', () => {
    const content = 'name: my-plugin\nversion: "1.0.0"\ndescription: Test\n';
    existingFiles.set(CONFIG_PATH, content);

    updatePluginConfigVersion(CONFIG_PATH, '1.0.0');

    expect(writtenFiles.has(CONFIG_PATH)).toBe(false);
  });

  it('preserves comments and surrounding content', () => {
    const content =
      '# Plugin config\nname: my-plugin\n# The version\nversion: "0.9.1"\nauthor:\n  name: Test\n';
    existingFiles.set(CONFIG_PATH, content);

    updatePluginConfigVersion(CONFIG_PATH, '1.5.0');

    expect(writtenFiles.get(CONFIG_PATH)).toBe(
      '# Plugin config\nname: my-plugin\n# The version\nversion: "1.5.0"\nauthor:\n  name: Test\n'
    );
  });

  it('generatePlugin updates plugin.config.yml when version is provided', () => {
    const configContent = makeConfig({ version: '1.0.0' });
    existingFiles.set(CONFIG_PATH, configContent);

    generatePlugin(CONFIG_PATH, TEMPLATES_DIR, '3.1.4');

    expect(writtenFiles.get(CONFIG_PATH)).toContain('version: "3.1.4"');
  });

  it('generatePlugin does not modify plugin.config.yml when no version is provided', () => {
    const configContent = makeConfig({ version: '1.0.0' });
    existingFiles.set(CONFIG_PATH, configContent);

    generatePlugin(CONFIG_PATH, TEMPLATES_DIR);

    expect(writtenFiles.has(CONFIG_PATH)).toBe(false);
  });
});
