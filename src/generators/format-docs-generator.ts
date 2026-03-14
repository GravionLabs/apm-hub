import * as fs from 'fs';
import * as path from 'path';
import { formatTablesInMarkdown } from '../utils/markdown-table';

function collectMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

export function formatAllDocs(docsDir = 'docs', extraFiles: string[] = ['README.md']): void {
  const files = [...collectMarkdownFiles(docsDir), ...extraFiles.filter((f) => fs.existsSync(f))];
  let formatted = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const updated = formatTablesInMarkdown(original);
    if (updated !== original) {
      fs.writeFileSync(file, updated, 'utf8');
      console.log(`  Formatted tables: ${file}`);
      formatted++;
    }
  }
  if (formatted === 0) {
    console.log('  All tables already formatted.');
  }
}
