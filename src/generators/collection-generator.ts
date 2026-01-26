import * as path from 'path';
import * as fs from 'fs';
import { getTitle, parseFrontmatter } from '../utils/markdown-parser';

export interface CollectionItem {
  path: string;
  kind: 'prompt' | 'instruction' | 'agent';
}

export interface CollectionConfig {
  id: string;
  name: string;
  description: string;
  tags: string[];
  items: CollectionItem[];
  display?: {
    ordering?: 'alpha' | 'manual';
    show_badge?: boolean;
  };
}

export function generateMarkdown(config: CollectionConfig): string {
  let md = `# ${config.name}\n\n`;
  md += `**Collection ID:**\n\`\`\`\n${config.id}\n\`\`\`\n\n`;
  md += `${config.description}\n\n`;

  if (config.tags && config.tags.length > 0) {
    md += `**Tags:** ${config.tags.map((tag) => `\`${tag}\``).join(', ')}\n\n`;
  }

  md += `## Included Items\n\n`;
  md += `| Name | Description | Type | Path |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;

  const items = [...config.items];
  // Sort alphabetically only if explicitly requested.
  // By default, use the order from the YAML file (manual).
  if (config.display?.ordering === 'alpha') {
    items.sort((a, b) => {
      const nameA = path.basename(a.path);
      const nameB = path.basename(b.path);
      return nameA.localeCompare(nameB);
    });
  }

  for (const item of items) {
    const fileName = path.basename(item.path);
    const fullPath = path.join('templates', item.path);

    let title = fileName;
    let description = '-';

    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const fm = parseFrontmatter(content);
      title = fm.name || getTitle(content, fileName);
      description = fm.description || '-';
    }

    // Determine relative path for the link.
    // Collections are in templates/collections/
    // Items are usually in templates/agents/, templates/prompts/, or templates/instructions/
    // Since the generated .md is in the same folder as the .collection.yml (templates/collections/),
    // we need to go up one level to reach the templates/ directory if the path starts with agents/, prompts/ or instructions/
    let linkPath = item.path;
    if (
      item.path.startsWith('agents/') ||
      item.path.startsWith('prompts/') ||
      item.path.startsWith('instructions/')
    ) {
      linkPath = `../${item.path}`;
    }

    md += `| [${title}](${linkPath}) | ${description} | ${item.kind} | \`${item.path}\` |\n`;
  }

  return md;
}
