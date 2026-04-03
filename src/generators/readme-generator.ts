import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

// Marker pattern: <!-- AUTO:start <id> --> ... <!-- AUTO:end <id> -->
const MARKER_START = (id: string) => `<!-- AUTO:start ${id} -->`;
const MARKER_END = (id: string) => `<!-- AUTO:end ${id} -->`;

interface PluginMeta {
  name: string;
  description?: string;
}

/**
 * Replace an AUTO-marked block in content with new generated content.
 * Returns the updated string. Throws if marker pair is not found.
 */
export function injectBlock(content: string, id: string, generated: string): string {
  const start = MARKER_START(id);
  const end = MARKER_END(id);
  const startIdx = content.indexOf(start);
  const endIdx = content.indexOf(end);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`AUTO markers for '${id}' not found`);
  }

  const before = content.slice(0, startIdx + start.length);
  const after = content.slice(endIdx);
  return `${before}\n${generated}\n${after}`;
}

/**
 * Build the template-stats table from the templates/ directory.
 */
export function buildTemplateStatsBlock(templatesDir: string): string {
  const countMd = (dir: string): number => {
    const fullPath = path.join(templatesDir, dir);
    if (!fs.existsSync(fullPath)) return 0;
    return fs.readdirSync(fullPath).filter((f) => f.endsWith('.md')).length;
  };

  const agents = countMd('agents');
  const prompts = countMd('prompts');
  const instructions = countMd('instructions');

  return [
    '| Category | Count | Location | Purpose |',
    '| :--- | :---: | :--- | :--- |',
    `| **Agents** | ${agents} | \`templates/agents/\` | Specialized expert roles (@-mentions) |`,
    `| **Prompts** | ${prompts} | \`templates/prompts/\` | Task-specific workflows (slash commands) |`,
    `| **Instructions** | ${instructions} | \`templates/instructions/\` | Persistent project rules and standards |`,
  ].join('\n');
}

/**
 * Build the plugin-table from plugins/<name>/plugin.config.yml files.
 */
export function buildPluginTableBlock(pluginsDir: string): string {
  const rows: string[] = ['| Plugin | Description |', '| :--- | :--- |'];

  if (!fs.existsSync(pluginsDir)) {
    return rows.join('\n');
  }

  const dirs = fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dirName of dirs) {
    const configPath = path.join(pluginsDir, dirName, 'plugin.config.yml');
    if (!fs.existsSync(configPath)) continue;

    const raw = fs.readFileSync(configPath, 'utf8');
    const config = parse(raw) as PluginMeta;
    const name = config.name ?? dirName;
    const desc = (config.description ?? '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    rows.push(`| [\`${name}\`](plugins/${dirName}) | ${desc} |`);
  }

  return rows.join('\n');
}

/**
 * Update an AUTO-marked block in any markdown file with new content.
 * Returns true if the file was changed.
 */
export function updateFileBlock(filePath: string, blockId: string, content: string): boolean {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found at ${filePath}, skipping.`);
    return false;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  let updated: string;

  try {
    updated = injectBlock(original, blockId, content);
  } catch {
    console.warn(`AUTO markers for '${blockId}' not found in ${filePath}, skipping.`);
    return false;
  }

  if (updated === original) {
    console.log(`${filePath} is already up to date.`);
    return false;
  }

  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`Successfully updated ${filePath}`);
  return true;
}

/**
 * Update README.md by injecting all AUTO blocks.
 * Returns true if the file was changed.
 */
export function updateReadme(
  readmePath = 'README.md',
  templatesDir = 'templates',
  pluginsDir = 'plugins'
): boolean {
  if (!fs.existsSync(readmePath)) {
    console.warn(`README.md not found at ${readmePath}, skipping.`);
    return false;
  }

  let content = fs.readFileSync(readmePath, 'utf8');
  const original = content;

  content = injectBlock(content, 'template-stats', buildTemplateStatsBlock(templatesDir));
  content = injectBlock(content, 'plugin-table', buildPluginTableBlock(pluginsDir));

  if (content === original) {
    console.log('README.md is already up to date.');
    return false;
  }

  fs.writeFileSync(readmePath, content, 'utf8');
  console.log('Successfully updated README.md');
  return true;
}
