import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { parseFrontmatter } from '../utils/markdown-parser';

export interface PluginAgentConfig {
  /** Name of the agent file without extension (e.g. "nunit-engineer") */
  source: string;
}

export interface PluginSkillConfig {
  /** The skill name used for the directory and SKILL.md name field */
  name: string;
  /**
   * Source path relative to templates/ directory.
   * Can be a prompt (e.g. "prompts/csharp-nunit.prompt.md")
   * or an agent file (e.g. "agents/gfog-helm.agent.md")
   */
  source: string;
  /**
   * Optional additional source paths whose bodies are appended to the primary source body.
   * Useful for combining C#-specific prompt content with a generic review framework.
   */
  extend?: string[];
}

export interface PluginInstructionConfig {
  /** Instruction name — resolves to templates/instructions/<source>.instructions.md */
  source: string;
}

export interface PluginConfig {
  name: string;
  description: string;
  version: string;
  author?: { name: string; email?: string };
  repository?: string;
  license?: string;
  keywords?: string[];
  agents: PluginAgentConfig[];
  skills: PluginSkillConfig[];
  instructions?: PluginInstructionConfig[];
}

/**
 * Extracts the body of a markdown file (everything after the front-matter block).
 */
function extractBody(content: string): string {
  // Handle optional BOM
  const normalized = content.replace(/^\uFEFF/, '');
  if (normalized.startsWith('---')) {
    const end = normalized.indexOf('---', 3);
    if (end !== -1) {
      return normalized.substring(end + 3).trimStart();
    }
  }
  return normalized;
}

/**
 * Generates a SKILL.md from a source template file (prompt or agent).
 * Transforms front-matter to the SKILL format (name + description only).
 * Optionally appends bodies from additional source files (extend list).
 */
function generateSkillContent(skillName: string, sourceContent: string, extendContents: string[] = []): string {
  const fm = parseFrontmatter(sourceContent);
  const description = fm.description || fm.name || skillName;
  let body = extractBody(sourceContent);

  for (const extContent of extendContents) {
    const extBody = extractBody(extContent).trim();
    if (extBody) {
      body = body.trimEnd() + '\n\n---\n\n' + extBody;
    }
  }

  const frontmatter = `---\nname: ${skillName}\ndescription: '${description}'\n---\n\n`;
  return frontmatter + body;
}

/**
 * Generates the plugin.json manifest content.
 */
function generatePluginJson(config: PluginConfig, skillNames: string[], instructionPaths: string[]): string {
  const manifest: Record<string, unknown> = {
    name: config.name,
    description: config.description,
    version: config.version,
  };

  if (config.author) {
    manifest.author = config.author;
  }
  if (config.repository) {
    manifest.repository = config.repository;
  }
  if (config.license) {
    manifest.license = config.license;
  }
  if (config.keywords && config.keywords.length > 0) {
    manifest.keywords = config.keywords;
  }

  if (config.agents && config.agents.length > 0) {
    manifest.agents = ['./agents'];
  }

  if (skillNames.length > 0) {
    manifest.skills = skillNames.map((name) => `./skills/${name}`);
  }

  if (instructionPaths.length > 0) {
    manifest.instructions = instructionPaths;
  }

  return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Generates a Copilot CLI plugin from a plugin.config.yml definition.
 * @param configPath - Path to the plugin.config.yml file
 * @param templatesDir - Path to the templates/ directory
 */
export function generatePlugin(configPath: string, templatesDir: string): void {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Plugin config not found: ${configPath}`);
  }

  const configContent = fs.readFileSync(configPath, 'utf8');
  const config = parseYaml(configContent) as PluginConfig;
  const pluginDir = path.dirname(configPath);

  console.log(`Generating plugin: ${config.name}`);

  const generatedSkillNames: string[] = [];

  // Generate skills
  for (const skill of config.skills || []) {
    const sourcePath = path.join(templatesDir, skill.source);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`  ⚠ Skill source not found, skipping: ${sourcePath}`);
      continue;
    }

    const sourceContent = fs.readFileSync(sourcePath, 'utf8');

    // Load any extended source bodies
    const extendContents: string[] = [];
    for (const extSource of skill.extend || []) {
      const extPath = path.join(templatesDir, extSource);
      if (fs.existsSync(extPath)) {
        extendContents.push(fs.readFileSync(extPath, 'utf8'));
      } else {
        console.warn(`  ⚠ Extend source not found, skipping: ${extPath}`);
      }
    }

    const skillContent = generateSkillContent(skill.name, sourceContent, extendContents);
    const skillDir = path.join(pluginDir, 'skills', skill.name);

    fs.mkdirSync(skillDir, { recursive: true });
    const skillPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, skillContent, 'utf8');
    console.log(`  ✓ Skill: skills/${skill.name}/SKILL.md`);
    generatedSkillNames.push(skill.name);
  }

  // Copy agents
  const agentsDir = path.join(pluginDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  for (const agent of config.agents || []) {
    const agentFile = agent.source.endsWith('.agent.md')
      ? agent.source
      : `${agent.source}.agent.md`;
    const sourcePath = path.join(templatesDir, 'agents', agentFile);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`  ⚠ Agent source not found, skipping: ${sourcePath}`);
      continue;
    }

    const agentContent = fs.readFileSync(sourcePath, 'utf8');
    const destPath = path.join(agentsDir, agentFile);
    fs.writeFileSync(destPath, agentContent, 'utf8');
    console.log(`  ✓ Agent: agents/${agentFile}`);
  }

  // Copy instructions
  const generatedInstructionPaths: string[] = [];
  if (config.instructions && config.instructions.length > 0) {
    const instructionsDir = path.join(pluginDir, 'instructions');
    fs.mkdirSync(instructionsDir, { recursive: true });

    for (const instruction of config.instructions) {
      const instructionFile = instruction.source.endsWith('.instructions.md')
        ? instruction.source
        : `${instruction.source}.instructions.md`;
      const sourcePath = path.join(templatesDir, 'instructions', instructionFile);

      if (!fs.existsSync(sourcePath)) {
        console.warn(`  ⚠ Instruction source not found, skipping: ${sourcePath}`);
        continue;
      }

      const instructionContent = fs.readFileSync(sourcePath, 'utf8');
      const destPath = path.join(instructionsDir, instructionFile);
      fs.writeFileSync(destPath, instructionContent, 'utf8');
      console.log(`  ✓ Instruction: instructions/${instructionFile}`);
      generatedInstructionPaths.push(`./instructions/${instructionFile}`);
    }
  }

  // Generate plugin.json in .github/plugin/
  const pluginManifestDir = path.join(pluginDir, '.github', 'plugin');
  fs.mkdirSync(pluginManifestDir, { recursive: true });
  const pluginJsonPath = path.join(pluginManifestDir, 'plugin.json');
  const pluginJsonContent = generatePluginJson(config, generatedSkillNames, generatedInstructionPaths);
  fs.writeFileSync(pluginJsonPath, pluginJsonContent, 'utf8');
  console.log(`  ✓ Manifest: .github/plugin/plugin.json`);

  console.log(`Plugin '${config.name}' generated successfully.`);
}
