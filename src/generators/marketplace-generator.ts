import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

interface PluginConfigEntry {
  name: string;
  source: string;
  description: string;
  version: string;
  keywords: string[];
}

interface MarketplaceJson {
  name: string;
  owner: { login: string; name: string };
  description: string;
  plugins: PluginConfigEntry[];
}

interface RawPluginConfig {
  name?: string;
  description?: string;
  version?: string;
  keywords?: string[];
}

export function generateMarketplace(
  pluginsDir = 'plugins',
  outputPath = '.github/plugin/marketplace.json'
): void {
  if (!fs.existsSync(pluginsDir)) {
    console.warn(`  marketplace-generator: plugins dir not found: ${pluginsDir}`);
    return;
  }

  const entries: PluginConfigEntry[] = [];

  const dirs = fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dirName of dirs) {
    const configPath = path.join(pluginsDir, dirName, 'plugin.config.yml');
    if (!fs.existsSync(configPath)) continue;

    const raw = parseYaml(fs.readFileSync(configPath, 'utf8')) as RawPluginConfig;
    entries.push({
      name: raw.name ?? dirName,
      source: `plugins/${dirName}`,
      description: (raw.description ?? '').replace(/\s+/g, ' ').trim(),
      version: raw.version ?? '1.0.0',
      keywords: raw.keywords ?? [],
    });
  }

  const marketplace: MarketplaceJson = {
    name: 'copilot-hub',
    owner: { login: 'GravionLabs', name: 'Gravion' },
    description:
      "A curated hub for sharing GitHub Copilot instructions, agents, prompts, and CLI plugins — your team's Copilot marketplace.",
    plugins: entries,
  };

  const json = JSON.stringify(marketplace, null, 2) + '\n';

  const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (json === existing) {
    console.log('  marketplace.json is already up to date.');
    return;
  }

  fs.writeFileSync(outputPath, json, 'utf8');
  console.log(`Successfully generated ${outputPath} (${entries.length} plugins)`);
}
