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
   * Source path relative to templates/ directory. Optional — defaults to `prompts/<name>.prompt.md`.
   *
   * Resolution rules (applied in order):
   * 1. No source → `prompts/<name>.prompt.md`
   * 2. Contains `/` → used as-is; `.prompt.md` is appended when no file extension is present
   * 3. No `/` → `prompts/<source>`; `.prompt.md` is appended when no file extension is present
   *
   * Examples:
   *   name: csharp-nunit              → prompts/csharp-nunit.prompt.md
   *   name: my-skill, source: csharp-nunit          → prompts/csharp-nunit.prompt.md
   *   name: my-skill, source: csharp-nunit.prompt.md → prompts/csharp-nunit.prompt.md
   *   name: my-skill, source: agents/gfog-helm.agent.md → agents/gfog-helm.agent.md (unchanged)
   */
  source?: string;
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

export interface PluginFileConfig {
  /** Path relative to the repository root (e.g. "editor-configs/.editorconfig-csharp") */
  source: string;
  /** Destination path relative to the plugin directory. Defaults to the basename of source. */
  destination?: string;
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
  files?: PluginFileConfig[];
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
 * Resolves a template path relative to the templates/ directory.
 * Infers the file extension from the directory prefix when the path has no extension.
 *
 * Resolution rules:
 * - Has `/` and has `.` → used as-is (explicit path)
 * - Has `/` and no `.` → extension inferred from directory prefix:
 *     agents/       → .agent.md
 *     prompts/      → .prompt.md
 *     instructions/ → .instructions.md
 *     other         → .prompt.md (fallback)
 * - No `/` → resolved under prompts/ with .prompt.md
 *     bare name → prompts/<name>.prompt.md
 *     name with extension → prompts/<name>
 */
export function resolveTemplatePath(raw: string): string {
  if (raw.includes('/')) {
    if (raw.includes('.')) return raw;

    if (raw.startsWith('agents/')) return `${raw}.agent.md`;
    if (raw.startsWith('instructions/')) return `${raw}.instructions.md`;
    // prompts/ or any other directory — default to .prompt.md
    return `${raw}.prompt.md`;
  }

  // Bare name (no directory) → default to prompts/
  const withExtension = raw.includes('.') ? raw : `${raw}.prompt.md`;
  return `prompts/${withExtension}`;
}

/**
 * Resolves the source path of a skill relative to the templates/ directory.
 * See PluginSkillConfig.source for full resolution rules.
 */
export function resolveSkillSource(name: string, source?: string): string {
  return resolveTemplatePath(source ?? name);
}

/**
 * Parses a YAML array-style tools string (e.g. "['codebase', 'runCommands']")
 * into a space-delimited allowed-tools string (e.g. "codebase runCommands").
 */
function parseToolsToAllowedTools(toolsValue: string): string {
  // Remove surrounding brackets if present, then split by comma
  const cleaned = toolsValue.replace(/^\s*\[|\]\s*$/g, '');
  return cleaned
    .split(',')
    .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .join(' ');
}

/**
 * Generates a SKILL.md from a source template file (prompt or agent).
 * Transforms front-matter to the SKILL format:
 *   - name, description (required)
 *   - tools → allowed-tools (space-delimited, experimental per agentskills.io spec)
 *   - argument-hint, user-invocable, disable-model-invocation, compatibility (pass-through)
 * Optionally appends bodies from additional source files (extend list).
 */
function generateSkillContent(
  skillName: string,
  sourceContent: string,
  extendContents: string[] = []
): string {
  const fm = parseFrontmatter(sourceContent);
  const description = fm.description || fm.name || skillName;
  let body = extractBody(sourceContent);

  for (const extContent of extendContents) {
    const extBody = extractBody(extContent).trim();
    if (extBody) {
      body = body.trimEnd() + '\n\n---\n\n' + extBody;
    }
  }

  let frontmatter = `---\nname: ${skillName}\ndescription: '${description}'`;

  // Map tools: [...] → allowed-tools: space-delimited (agentskills.io spec, experimental)
  if (fm['tools']) {
    const allowedTools = parseToolsToAllowedTools(fm['tools']);
    if (allowedTools) {
      frontmatter += `\nallowed-tools: ${allowedTools}`;
    }
  }

  // Pass through SKILL.md-specific optional fields
  const passThroughFields = ['argument-hint', 'user-invocable', 'disable-model-invocation', 'compatibility'];
  for (const field of passThroughFields) {
    if (fm[field] !== undefined) {
      frontmatter += `\n${field}: ${fm[field]}`;
    }
  }

  frontmatter += `\n---\n\n`;
  return frontmatter + body;
}

/**
 * Generates the plugin.json manifest content.
 */
function generatePluginJson(
  config: PluginConfig,
  skillNames: string[],
  instructionPaths: string[]
): string {
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
 * Updates the `version` field in a plugin.config.yml file in-place.
 * Preserves all comments and formatting.
 */
export function updatePluginConfigVersion(configPath: string, version: string): void {
  const content = fs.readFileSync(configPath, 'utf8');
  const updated = content.replace(/^version:\s*"[^"]*"/m, `version: "${version}"`);
  if (updated !== content) {
    fs.writeFileSync(configPath, updated, 'utf8');
    console.log(`  ✓ Version updated to "${version}" in ${path.basename(configPath)}`);
  }
}

/**
 * Generates a Copilot CLI plugin from a plugin.config.yml definition.
 * @param configPath - Path to the plugin.config.yml file
 * @param templatesDir - Path to the templates/ directory
 * @param version - Optional version to write into plugin.config.yml before generating
 */
export function generatePlugin(configPath: string, templatesDir: string, version?: string): void {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Plugin config not found: ${configPath}`);
  }

  if (version) {
    updatePluginConfigVersion(configPath, version);
  }

  const configContent = fs.readFileSync(configPath, 'utf8');
  const config = parseYaml(configContent) as PluginConfig;
  const pluginDir = path.dirname(configPath);

  console.log(`Generating plugin: ${config.name}`);

  const generatedSkillNames: string[] = [];

  // Generate skills
  for (const skill of config.skills || []) {
    const resolvedSource = resolveSkillSource(skill.name, skill.source);
    const sourcePath = path.join(templatesDir, resolvedSource);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`  ⚠ Skill source not found, skipping: ${sourcePath}`);
      continue;
    }

    const sourceContent = fs.readFileSync(sourcePath, 'utf8');

    // Load any extended source bodies
    const extendContents: string[] = [];
    for (const extSource of skill.extend || []) {
      const resolvedExt = resolveTemplatePath(extSource);
      const extPath = path.join(templatesDir, resolvedExt);
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
    const resolvedAgent = resolveTemplatePath(`agents/${agent.source}`);
    const sourcePath = path.join(templatesDir, resolvedAgent);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`  ⚠ Agent source not found, skipping: ${sourcePath}`);
      continue;
    }

    const agentContent = fs.readFileSync(sourcePath, 'utf8');
    const agentFile = path.basename(resolvedAgent);
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
      const resolvedInstruction = resolveTemplatePath(`instructions/${instruction.source}`);
      const instructionFile = path.basename(resolvedInstruction);
      const sourcePath = path.join(templatesDir, resolvedInstruction);

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

  // Copy arbitrary files
  if (config.files && config.files.length > 0) {
    const repoRoot = path.dirname(templatesDir);
    for (const file of config.files) {
      const sourcePath = path.join(repoRoot, file.source);

      if (!fs.existsSync(sourcePath)) {
        console.warn(`  ⚠ File source not found, skipping: ${sourcePath}`);
        continue;
      }

      const destRelative = file.destination ?? path.basename(file.source);
      const destPath = path.join(pluginDir, destRelative);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(sourcePath, destPath);
      console.log(`  ✓ File: ${destRelative}`);
    }
  }

  // Generate plugin.json in .github/plugin/
  const pluginManifestDir = path.join(pluginDir, '.github', 'plugin');
  fs.mkdirSync(pluginManifestDir, { recursive: true });
  const pluginJsonPath = path.join(pluginManifestDir, 'plugin.json');
  const pluginJsonContent = generatePluginJson(
    config,
    generatedSkillNames,
    generatedInstructionPaths
  );
  fs.writeFileSync(pluginJsonPath, pluginJsonContent, 'utf8');
  console.log(`  ✓ Manifest: .github/plugin/plugin.json`);

  console.log(`Plugin '${config.name}' generated successfully.`);
}
