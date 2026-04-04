import * as fs from 'fs';
import * as path from 'path';
import { generateTemplateList } from './generators/template-list-generator';
import { generatePlugin } from './generators/plugin-generator';
import { generatePluginList } from './generators/plugin-list-generator';
import { updateReadme, updateFileBlock } from './generators/readme-generator';
import { formatAllDocs } from './generators/format-docs-generator';
import { generateMarketplace } from './generators/marketplace-generator';
import { generateSkillList } from './generators/skill-list-generator';

function generateAllPlugins(version?: string) {
  const pluginsDir = 'plugins';
  if (fs.existsSync(pluginsDir)) {
    const pluginDirs = fs
      .readdirSync(pluginsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const pluginDirName of pluginDirs) {
      const configPath = path.join(pluginsDir, pluginDirName, 'plugin.config.yml');
      if (fs.existsSync(configPath)) {
        processPluginConfig(configPath, version);
      }
    }
  }
}

function generateAggregateDocs(version?: string) {
  generateTemplateList();
  generatePluginList();
  generateSkillList();
  updateReadme();
  if (version) {
    updateFileBlock('docs/overview.md', 'version', `Welcome to **copilot-hub** v${version} 👋`);
  }
  formatAllDocs();
  generateMarketplace();
}

function main() {
  const args = process.argv.slice(2);

  // Extract optional --version <semver> argument
  let version: string | undefined;
  const versionFlagIndex = args.indexOf('--version');
  if (versionFlagIndex !== -1 && versionFlagIndex + 1 < args.length) {
    version = args[versionFlagIndex + 1];
    args.splice(versionFlagIndex, 2);
  }

  // Default (no args): only regenerate plugin-specific files (SKILL.md, plugin.json).
  // Safe to run locally or in feature branches — does NOT touch aggregate docs.
  if (args.length === 0) {
    console.log('Regenerating plugin files (SKILL.md, plugin.json)...');
    console.log('Tip: use --aggregate to also regenerate docs/plugin-list.md, skill-list.md, marketplace.json, etc.');
    generateAllPlugins(version);
    return;
  }

  const inputPath = args[0];

  // --aggregate: regenerate all aggregate docs (CI-only, not for feature branches)
  if (inputPath === '--aggregate') {
    console.log('Regenerating plugins + all aggregate docs...');
    generateAllPlugins(version);
    generateAggregateDocs(version);
    return;
  }

  if (inputPath === '--template-list') {
    generateTemplateList();
    return;
  }

  if (inputPath === '--plugins') {
    generateAllPlugins(version);
    return;
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Path not found: ${inputPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(inputPath);

  if (inputPath.endsWith('plugin.config.yml')) {
    processPluginConfig(inputPath, version);
    return;
  }

  if (stats.isDirectory()) {
    // Check if it's a plugin directory
    const pluginConfig = path.join(inputPath, 'plugin.config.yml');
    if (fs.existsSync(pluginConfig)) {
      processPluginConfig(pluginConfig, version);
      return;
    }
    console.error(`Error: No plugin.config.yml found in directory: ${inputPath}`);
    process.exit(1);
  } else {
    processPluginConfig(inputPath, version);
  }
}

function processPluginConfig(configPath: string, version?: string) {
  try {
    const templatesDir = path.join(process.cwd(), 'templates');
    generatePlugin(configPath, templatesDir, version);
  } catch (error) {
    console.error(`Error processing plugin config ${configPath}:`, error);
  }
}

main();
