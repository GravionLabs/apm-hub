import { parse } from 'yaml';

/**
 * Parse the YAML frontmatter block at the top of a markdown file into a flat
 * string map. Nested values are stringified; folded/literal scalars (`>` / `|`)
 * are collapsed to a single line so they can be rendered in tables.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const frontmatter: Record<string, string> = {};
  if (!content.startsWith('---')) return frontmatter;

  const end = content.indexOf('\n---', 3);
  if (end === -1) return frontmatter;

  const fmText = content.substring(3, end);
  let parsed: unknown;
  try {
    parsed = parse(fmText);
  } catch {
    return frontmatter;
  }
  if (!parsed || typeof parsed !== 'object') return frontmatter;

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    frontmatter[key] = text.replace(/\s*\n\s*/g, ' ').trim();
  }
  return frontmatter;
}

export function getTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.*)/m);
  if (match) {
    return match[1].trim();
  }
  return filename;
}
