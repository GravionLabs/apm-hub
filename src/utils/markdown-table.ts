/**
 * Utilities for formatting Markdown tables with aligned columns.
 */

type Alignment = 'left' | 'center' | 'right';

/** Parse alignment from a separator cell like `:---`, `:---:`, `---:` */
function parseAlignment(cell: string): Alignment {
  const c = cell.trim();
  const left = c.startsWith(':');
  const right = c.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

/** Build a separator cell of the given width with the correct alignment markers */
function buildSeparator(width: number, alignment: Alignment): string {
  const dashes = '-'.repeat(
    Math.max(width - (alignment === 'center' ? 2 : alignment === 'right' ? 1 : 1), 1)
  );
  switch (alignment) {
    case 'center':
      return `:${dashes}:`;
    case 'right':
      return `${dashes}:`;
    default:
      return `:${dashes}`;
  }
}

/** Pad a cell value to the target width according to its alignment */
function padCell(value: string, width: number, alignment: Alignment): string {
  const padding = width - value.length;
  if (padding <= 0) return value;
  switch (alignment) {
    case 'right':
      return ' '.repeat(padding) + value;
    case 'center': {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return ' '.repeat(left) + value + ' '.repeat(right);
    }
    default:
      return value + ' '.repeat(padding);
  }
}

/** Parse a Markdown table row into trimmed cell strings (strips outer pipes) */
function parseRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

/** Returns true if the line looks like a Markdown separator row */
function isSeparatorRow(line: string): boolean {
  return /^\s*\|[\s|:\-]+\|\s*$/.test(line);
}

/**
 * Format all Markdown tables in a content string so that columns are
 * aligned with consistent cell widths. Non-table lines are left untouched.
 */
export function formatTablesInMarkdown(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    // Collect a block of consecutive table lines
    if (lines[i].trim().startsWith('|')) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        block.push(lines[i]);
        i++;
      }
      result.push(...formatTableBlock(block));
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join('\n');
}

function formatTableBlock(block: string[]): string[] {
  // Need at least a header row + separator row
  if (block.length < 2) return block;

  // Find separator row index
  const sepIdx = block.findIndex((l) => isSeparatorRow(l));
  if (sepIdx === -1) return block;

  // Parse all rows into cells
  const parsedRows = block.map(parseRow);

  // Determine column count (max across all rows)
  const colCount = Math.max(...parsedRows.map((r) => r.length));
  if (colCount === 0) return block;

  // Parse alignments from separator row
  const alignments: Alignment[] = parsedRows[sepIdx].map(parseAlignment);
  while (alignments.length < colCount) alignments.push('left');

  // Compute max width per column (across all non-separator rows, plus separator itself)
  const widths = Array(colCount).fill(0) as number[];
  for (let col = 0; col < colCount; col++) {
    // Minimum width for separator (e.g. ":---" = 4)
    const align = alignments[col] ?? 'left';
     // "::" is 2, ":--:" is 4, ":-" is 2
    widths[col] = align === 'center' ? 3 : 2;
  }
  for (let row = 0; row < parsedRows.length; row++) {
    if (row === sepIdx) continue;
    for (let col = 0; col < colCount; col++) {
      const cell = parsedRows[row][col] ?? '';
      widths[col] = Math.max(widths[col], cell.length);
    }
  }

  // Rebuild the table
  return block.map((_, rowIdx) => {
    const cells = parsedRows[rowIdx];
    const isSep = rowIdx === sepIdx;

    const formatted = Array.from({ length: colCount }, (_, col) => {
      const align = alignments[col] ?? 'left';
      const width = widths[col];
      if (isSep) {
        return buildSeparator(width, align);
      }
      const value = cells[col] ?? '';
      return padCell(value, width, align);
    });

    return `| ${formatted.join(' | ')} |`;
  });
}
