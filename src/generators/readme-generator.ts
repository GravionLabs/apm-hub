import * as fs from 'fs';

// Marker pattern: <!-- AUTO:start <id> --> ... <!-- AUTO:end <id> -->
const MARKER_START = (id: string) => `<!-- AUTO:start ${id} -->`;
const MARKER_END = (id: string) => `<!-- AUTO:end ${id} -->`;

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
