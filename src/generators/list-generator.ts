import * as fs from 'fs';
import * as path from 'path';

export interface DomainEntry {
  domain: string;
  name: string;
  description: string;
  /** Repo-relative path used in doc links (e.g. packages/angular/.apm/skills/foo/SKILL.md) */
  relPath: string;
}

/** Returns sorted domain directory names from the packages base directory. */
export function collectDomains(packagesBaseDir: string): string[] {
  if (!fs.existsSync(packagesBaseDir)) return [];
  return fs
    .readdirSync(packagesBaseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export interface ListConfig {
  title: string;
  intro: string;
  callout: string;
  overviewHeader: string;
  itemColumnHeader: string;
}

/**
 * Generate a domain-grouped markdown list document from a flat list of entries.
 *
 * Produces:
 *  - A title + intro block
 *  - An Overview table: `| <item> | Domain | Description |`
 *  - Per-domain sections: `| <item> | Description |`
 */
export function generateDomainListMarkdown(
  allEntries: DomainEntry[],
  byDomain: Record<string, DomainEntry[]>,
  config: ListConfig
): string {
  let output = `# ${config.title}\n\n`;
  output += `${config.intro}\n\n`;
  output += `> ${config.callout}\n\n`;

  output += `## Overview\n\n`;
  output += `| ${config.overviewHeader} | Domain | Description |\n`;
  output += `| ${':'.padEnd(config.overviewHeader.length + 1, '-')} | :----- | :---------- |\n`;

  for (const e of allEntries) {
    const link = `[${e.name}](../${e.relPath})`;
    const domainLabel = e.domain.charAt(0).toUpperCase() + e.domain.slice(1);
    const domainLink = `[${domainLabel}](#${e.domain})`;
    output += `| ${link} | ${domainLink} | ${e.description} |\n`;
  }
  output += `\n`;

  for (const [domain, entries] of Object.entries(byDomain)) {
    const label = domain.charAt(0).toUpperCase() + domain.slice(1);
    output += `## ${label}\n\n`;
    output += `| ${config.itemColumnHeader} | Description |\n`;
    output += `| ${':'.padEnd(config.itemColumnHeader.length + 1, '-')} | :---------- |\n`;
    for (const e of entries) {
      const link = `[\`${e.name}\`](../${e.relPath})`;
      output += `| ${link} | ${e.description} |\n`;
    }
    output += `\n`;
  }

  return output;
}

/** Ensure the output directory exists and write the file. */
export function writeOutputFile(outputFile: string, content: string): void {
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, content, 'utf8');
  console.log(`Successfully generated ${outputFile}`);
}
