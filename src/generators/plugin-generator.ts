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
   * 1. No source → `prompts/<name>.prompt.md` (legacy: generate skill from prompt)
   * 2. `<domain>/skills/<name>` → `<domain>/skills/<name>/SKILL.md` (agentskills.io directory layout)
   * 3. `<domain>/<name>` → auto-discover extension by scanning filesystem
   *      (tries /SKILL.md, .agent.md, .instructions.md, .prompt.md)
   * 4. Contains `/` and `.` → used as-is (explicit path)
   * 5. No `/` → `prompts/<source>.prompt.md`
   *
   * Examples:
   *   name: csharp-nunit                                         → prompts/csharp-nunit.prompt.md (legacy)
   *   name: csharp-nunit, source: csharp/skills/csharp-nunit    → csharp/skills/csharp-nunit/SKILL.md
   *   name: code-review-publisher, source: devops/code-review-publisher → devops/code-review-publisher.agent.md
   */
  source?: string;
  /**
   * Optional additional source paths whose bodies are appended to the primary source body.
   * Only applies when using legacy prompt/agent sources (not SKILL.md templates).
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
  author?: { name: string; email?: string; url?: string };
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  category?: string;
  tags?: string[];
  agents: PluginAgentConfig[];
  skills: PluginSkillConfig[];
  instructions?: PluginInstructionConfig[];
  files?: PluginFileConfig[];
  hooks?: string | Record<string, unknown>;
  mcpServers?: string | Record<string, unknown>;
  lspServers?: string | Record<string, unknown>;
  commands?: string | string[];
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
 * - Has `/` and no `.` → extension inferred:
 *     Type-first prefixes: agents/ → .agent.md, instructions/ → .instructions.md,
 *                          prompts/ → .prompt.md
 *     Domain/type/name (e.g. csharp/agents/name, csharp/skills/name):
 *       - skills → <raw>/SKILL.md  (agentskills.io directory layout)
 *       - others → <raw>.<ext>
 *     Domain-based path (e.g. csharp/csharp-expert) → auto-discovers extension
 *       by checking the filesystem (tries /SKILL.md, .agent.md, .instructions.md, .prompt.md)
 * - No `/` → resolved under prompts/ with .prompt.md
 *     bare name → prompts/<name>.prompt.md
 *     name with extension → prompts/<name>
 */
export function resolveTemplatePath(raw: string, templatesDir?: string): string {
  if (raw.includes('/')) {
    if (raw.includes('.')) return raw;

    // Type-first paths: agents/name, instructions/name, prompts/name
    if (raw.startsWith('agents/')) return `${raw}.agent.md`;
    if (raw.startsWith('instructions/')) return `${raw}.instructions.md`;
    if (raw.startsWith('prompts/')) return `${raw}.prompt.md`;

    // Domain/type/name paths: csharp/agents/name, csharp/skills/name, etc.
    const parts = raw.split('/');
    if (parts.length === 3) {
      const typeExtMap: Record<string, string> = {
        agents: '.agent.md',
        prompts: '.prompt.md',
        instructions: '.instructions.md',
      };
      if (parts[1] === 'skills') {
        // Skills use the agentskills.io directory layout: <name>/SKILL.md
        return `${raw}/SKILL.md`;
      }
      const ext = typeExtMap[parts[1]];
      if (ext) return `${raw}${ext}`;
    }

    // Domain-based path (e.g. csharp/csharp-expert) — auto-discover extension
    if (templatesDir) {
      // Check directory layout first (agentskills.io: <name>/SKILL.md)
      const dirSkillMd = path.join(templatesDir, raw, 'SKILL.md');
      if (fs.existsSync(dirSkillMd)) return `${raw}/SKILL.md`;
      for (const ext of ['.agent.md', '.instructions.md', '.prompt.md']) {
        const candidate = `${raw}${ext}`;
        if (fs.existsSync(path.join(templatesDir, candidate))) return candidate;
      }
    }
    throw new Error(`Cannot resolve template path: '${raw}'. Use domain/skills/<name>, domain/agents/<name>, etc.`);
  }

  // Bare name (no directory) → default to prompts/
  const withExtension = raw.includes('.') ? raw : `${raw}.prompt.md`;
  return `prompts/${withExtension}`;
}

/**
 * Resolves the source path of a skill relative to the templates/ directory.
 * See PluginSkillConfig.source for full resolution rules.
 */
export function resolveSkillSource(name: string, source?: string, templatesDir?: string): string {
  return resolveTemplatePath(source ?? name, templatesDir);
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
 * Prefixes string paths with `./` if not already present.
 * Arrays of strings are mapped individually; objects are returned as-is.
 */
function prefixPaths(
  value: string | string[] | Record<string, unknown>
): string | string[] | Record<string, unknown> {
  if (typeof value === 'string') {
    return value.startsWith('./') ? value : `./${value}`;
  }
  if (Array.isArray(value)) {
    return value.map((v) => (v.startsWith('./') ? v : `./${v}`));
  }
  return value;
}

/**
 * Generates the plugin.json manifest content.
 * Note: `instructions` is intentionally excluded — it is not part of the
 * official Copilot CLI plugin.json spec.
 */
function generatePluginJson(config: PluginConfig, skillNames: string[]): string {
  const manifest: Record<string, unknown> = {
    name: config.name,
    description: config.description,
    version: config.version,
  };

  if (config.author) {
    manifest.author = config.author;
  }
  if (config.homepage) {
    manifest.homepage = config.homepage;
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
  if (config.category) {
    manifest.category = config.category;
  }
  if (config.tags && config.tags.length > 0) {
    manifest.tags = config.tags;
  }

  if (config.agents && config.agents.length > 0) {
    manifest.agents = ['./agents'];
  }

  if (skillNames.length > 0) {
    manifest.skills = skillNames.map((name) => `./skills/${name}`);
  }

  if (config.commands !== undefined) {
    manifest.commands = prefixPaths(config.commands);
  }
  if (config.hooks !== undefined) {
    manifest.hooks = prefixPaths(config.hooks);
  }
  if (config.mcpServers !== undefined) {
    manifest.mcpServers = prefixPaths(config.mcpServers);
  }
  if (config.lspServers !== undefined) {
    manifest.lspServers = prefixPaths(config.lspServers);
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
 * Recursively copies all files from srcDir into destDir.
 * Creates destination subdirectories as needed.
 * Returns relative paths (from destDir) of all copied files.
 */
function copySkillAssets(srcDir: string, destDir: string): string[] {
  const copied: string[] = [];
  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    return copied;
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copied.push(...copySkillAssets(srcPath, destPath).map((r) => path.join(entry.name, r)));
    } else {
      fs.copyFileSync(srcPath, destPath);
      copied.push(entry.name);
    }
  }
  return copied;
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
    const resolvedSource = resolveSkillSource(skill.name, skill.source, templatesDir);
    const sourcePath = path.join(templatesDir, resolvedSource);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`  ⚠ Skill source not found, skipping: ${sourcePath}`);
      continue;
    }

    const sourceContent = fs.readFileSync(sourcePath, 'utf8');

    const isSkillDir = resolvedSource.endsWith('/SKILL.md');

    let skillContent: string;
    if (isSkillDir) {
      // Dedicated skill template in agentskills.io SKILL.md format — copy directly.
      skillContent = sourceContent;
    } else {
      // Legacy: generate skill from prompt/agent template via frontmatter transform.
      // Load any extended source bodies
      const extendContents: string[] = [];
      for (const extSource of skill.extend || []) {
        const resolvedExt = resolveTemplatePath(extSource, templatesDir);
        const extPath = path.join(templatesDir, resolvedExt);
        if (fs.existsSync(extPath)) {
          extendContents.push(fs.readFileSync(extPath, 'utf8'));
        } else {
          console.warn(`  ⚠ Extend source not found, skipping: ${extPath}`);
        }
      }
      skillContent = generateSkillContent(skill.name, sourceContent, extendContents);
    }
    const skillDir = path.join(pluginDir, 'skills', skill.name);

    fs.mkdirSync(skillDir, { recursive: true });
    const skillPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, skillContent, 'utf8');
    console.log(`  ✓ Skill: skills/${skill.name}/SKILL.md`);

    // Copy companion assets: content alongside SKILL.md inside the skill directory
    if (isSkillDir) {
      // Directory layout: companion content lives alongside SKILL.md inside the skill directory
      const skillSourceDir = path.dirname(sourcePath);
      const entries = fs.readdirSync(skillSourceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'SKILL.md') continue;
        const srcPath = path.join(skillSourceDir, entry.name);
        const destPath = path.join(skillDir, entry.name);
        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          const assetFiles = copySkillAssets(srcPath, destPath);
          for (const rel of assetFiles) {
            console.log(`  ✓ Skill asset: skills/${skill.name}/${entry.name}/${rel}`);
          }
        } else {
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ✓ Skill asset: skills/${skill.name}/${entry.name}`);
        }
      }
    }

    generatedSkillNames.push(skill.name);
  }

  // Copy agents
  const agentsDir = path.join(pluginDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  for (const agent of config.agents || []) {
    const resolvedAgent = agent.source.includes('/')
      ? resolveTemplatePath(agent.source, templatesDir)
      : resolveTemplatePath(`agents/${agent.source}`);
    const sourcePath = path.join(templatesDir, resolvedAgent);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`  ⚠ Agent source not found, skipping: ${sourcePath}`);
      continue;
    }

    const agentContent = fs.readFileSync(sourcePath, 'utf8');
    // When source resolves to a directory-layout SKILL.md, use the parent dir name
    const rawBaseName = resolvedAgent.endsWith('/SKILL.md')
      ? path.basename(path.dirname(resolvedAgent))
      : path.basename(resolvedAgent);
    // Strip compound extension (e.g. .agent.md, .skill.md) to get bare name
    const baseName = rawBaseName.replace(/\.(agent|skill|prompt|instructions)\.md$/, '');
    const agentFile = `${baseName}.agent.md`;
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
      const resolvedInstruction = instruction.source.includes('/')
        ? resolveTemplatePath(instruction.source, templatesDir)
        : resolveTemplatePath(`instructions/${instruction.source}`);
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
  const pluginJsonContent = generatePluginJson(config, generatedSkillNames);
  fs.writeFileSync(pluginJsonPath, pluginJsonContent, 'utf8');
  console.log(`  ✓ Manifest: .github/plugin/plugin.json`);

  console.log(`Plugin '${config.name}' generated successfully.`);
}
