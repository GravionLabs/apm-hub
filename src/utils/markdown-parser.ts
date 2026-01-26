import * as fs from 'fs';

export function parseFrontmatter(content: string): Record<string, string> {
  const frontmatter: Record<string, string> = {};
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      const fmText = content.substring(3, end).trim();
      fmText.split('\n').forEach((line) => {
        if (line.includes(':')) {
          const [key, ...valueParts] = line.split(':');
          const value = valueParts.join(':').trim();
          frontmatter[key.trim()] = value.replace(/^['"]|['"]$/g, '');
        }
      });
    }
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
