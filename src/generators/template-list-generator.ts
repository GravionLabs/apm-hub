import * as fs from 'fs';
import * as path from 'path';
import { getTitle, parseFrontmatter } from '../utils/markdown-parser';

export { getTitle, parseFrontmatter };

/** Type subdirectory name → display type label */
const SUBDIR_TYPE_LABELS: Record<string, string> = {
  agents: 'Agent',
  skills: 'Skill',
  prompts: 'Prompt',
  instructions: 'Instructions',
};

/** Flat file extension → display type label (legacy / cross-domain flat files) */
const EXT_TYPE_LABELS: Record<string, string> = {
  '.agent.md': 'Agent',
  '.skill.md': 'Skill',
  '.prompt.md': 'Prompt',
  '.instructions.md': 'Instructions',
};

function getExtType(filename: string): string | null {
  for (const ext of Object.keys(EXT_TYPE_LABELS)) {
    if (filename.endsWith(ext)) return EXT_TYPE_LABELS[ext];
  }
  return null;
}

interface TemplateEntry {
  /** Relative path from templatesBaseDir for use in doc links */
  relPath: string;
  /** Link text shown in the table */
  linkText: string;
  type: string;
  name: string;
  description: string;
}

/**
 * Collect all template entries for a single domain directory.
 * Handles both:
 *  - subdirectory layout: `<domain>/<type>/<name>.{agent,skill,prompt,instructions}.md`
 *  - skill directory layout: `<domain>/skills/<name>/SKILL.md`  (agentskills.io spec)
 */
function collectDomainEntries(domainDir: string, domain: string): TemplateEntry[] {
  const entries: TemplateEntry[] = [];

  const subdirs = fs.readdirSync(domainDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const subdir of subdirs.sort((a, b) => a.name.localeCompare(b.name))) {
    const typeLabel = SUBDIR_TYPE_LABELS[subdir.name];
    if (!typeLabel) continue;

    const subdirPath = path.join(domainDir, subdir.name);

    if (subdir.name === 'skills') {
      // Skills use the agentskills.io directory layout: <skill-name>/SKILL.md
      const skillDirs = fs
        .readdirSync(subdirPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const skillDir of skillDirs) {
        const skillMdPath = path.join(subdirPath, skillDir.name, 'SKILL.md');
        // Also support legacy flat .skill.md files in the skills/ dir
        const legacyPath = path.join(subdirPath, `${skillDir.name}.skill.md`);

        let filePath: string | null = null;
        let relPath: string | null = null;

        if (fs.existsSync(skillMdPath)) {
          filePath = skillMdPath;
          relPath = `${domain}/skills/${skillDir.name}/SKILL.md`;
        } else if (fs.existsSync(legacyPath)) {
          filePath = legacyPath;
          relPath = `${domain}/skills/${skillDir.name}.skill.md`;
        }

        if (!filePath || !relPath) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const fm = parseFrontmatter(content);
        const name = fm.name || skillDir.name;
        const description = fm.description || '-';
        entries.push({ relPath, linkText: name, type: typeLabel, name, description });
      }

      // Also handle any flat .skill.md files directly in skills/ (not inside a subdir)
      const flatFiles = fs
        .readdirSync(subdirPath, { withFileTypes: true })
        .filter((f) => f.isFile() && f.name.endsWith('.skill.md'))
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const file of flatFiles) {
        const filePath = path.join(subdirPath, file.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const fm = parseFrontmatter(content);
        const name = fm.name || getTitle(content, file.name);
        const description = fm.description || '-';
        const relPath = `${domain}/skills/${file.name}`;
        entries.push({ relPath, linkText: file.name, type: typeLabel, name, description });
      }
    } else {
      // agents/, prompts/, instructions/ — flat files with extension-based type
      const files = fs
        .readdirSync(subdirPath, { withFileTypes: true })
        .filter((f) => f.isFile())
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const file of files) {
        const extType = getExtType(file.name);
        if (!extType) continue;

        const filePath = path.join(subdirPath, file.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const fm = parseFrontmatter(content);
        const name = fm.name || getTitle(content, file.name);
        const description = fm.description || '-';
        const relPath = `${domain}/${subdir.name}/${file.name}`;
        entries.push({ relPath, linkText: file.name, type: extType, name, description });
      }
    }
  }

  return entries;
}

export function generateTemplateList(
  templatesBaseDir = 'templates',
  outputFile = 'docs/template-list.md'
) {
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Collect domain directories
  const domains: string[] = [];
  if (fs.existsSync(templatesBaseDir)) {
    fs.readdirSync(templatesBaseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .forEach((d) => domains.push(d));
  }

  let output = `# Template List\n\n`;
  output += `This page lists all available templates (Agents, Skills, Prompts, Instructions) organized by domain. This file is automatically generated.\n\n`;

  // Table of Contents (only include domains that have entries)
  const domainEntries = new Map<string, TemplateEntry[]>();
  for (const domain of domains) {
    const domainDir = path.join(templatesBaseDir, domain);
    const entries = collectDomainEntries(domainDir, domain);
    if (entries.length > 0) domainEntries.set(domain, entries);
  }

  output += `## Table of Contents\n\n`;
  for (const domain of domainEntries.keys()) {
    const anchor = domain.toLowerCase().replace(/\s+/g, '-');
    const label = domain.charAt(0).toUpperCase() + domain.slice(1);
    output += `- [${label}](#${anchor})\n`;
  }
  output += `\n`;

  // Per-domain sections
  for (const [domain, entries] of domainEntries) {
    const label = domain.charAt(0).toUpperCase() + domain.slice(1);

    output += `## ${label}\n\n`;
    output += `| Name | Type | Description | File |\n`;
    output += `| :--- | :--- | :---------- | :--- |\n`;

    for (const e of entries) {
      const fileLink = `[${e.linkText}](../templates/${e.relPath})`;
      output += `| ${e.name} | ${e.type} | ${e.description} | ${fileLink} |\n`;
    }
    output += `\n`;
  }

  fs.writeFileSync(outputFile, output, 'utf8');
  console.log(`Successfully generated ${outputFile}`);
}
