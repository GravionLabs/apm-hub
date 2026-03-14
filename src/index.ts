import * as fs from 'fs';
import * as path from 'path';
import { generateTemplateList } from './generators/template-list-generator';
import { generatePlugin } from './generators/plugin-generator';

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('No parameters provided. Regenerating everything...');

    // 1. Regenerate all plugins
    const pluginsDir = 'plugins';
    if (fs.existsSync(pluginsDir)) {
      const pluginDirs = fs
        .readdirSync(pluginsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      for (const pluginDirName of pluginDirs) {
        const configPath = path.join(pluginsDir, pluginDirName, 'plugin.config.yml');
        if (fs.existsSync(configPath)) {
          processPluginConfig(configPath);
        }
      }
    }

    // 2. Regenerate template list
    generateTemplateList();
    return;
  }

  const inputPath = args[0];

  if (inputPath === '--template-list') {
    generateTemplateList();
    return;
  }

  if (inputPath === '--plugins') {
    const pluginsDir = 'plugins';
    if (fs.existsSync(pluginsDir)) {
      const pluginDirs = fs
        .readdirSync(pluginsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      for (const pluginDirName of pluginDirs) {
        const configPath = path.join(pluginsDir, pluginDirName, 'plugin.config.yml');
        if (fs.existsSync(configPath)) {
          processPluginConfig(configPath);
        }
      }
    }
    return;
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Path not found: ${inputPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(inputPath);

  if (inputPath.endsWith('plugin.config.yml')) {
    processPluginConfig(inputPath);
    return;
  }

  if (stats.isDirectory()) {
    // Check if it's a plugin directory
    const pluginConfig = path.join(inputPath, 'plugin.config.yml');
    if (fs.existsSync(pluginConfig)) {
      processPluginConfig(pluginConfig);
      return;
    }
    console.error(`Error: No plugin.config.yml found in directory: ${inputPath}`);
    process.exit(1);
  } else {
    processPluginConfig(inputPath);
  }
}

function processPluginConfig(configPath: string) {
  try {
    const templatesDir = path.join(process.cwd(), 'templates');
    generatePlugin(configPath, templatesDir);
  } catch (error) {
    console.error(`Error processing plugin config ${configPath}:`, error);
  }
}

main();
