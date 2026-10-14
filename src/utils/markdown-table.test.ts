import { describe, it, expect } from 'vitest';
import { formatTablesInMarkdown } from './markdown-table';

describe('formatTablesInMarkdown', () => {
  it('aligns columns to the widest cell in each column', () => {
    const input = [
      '| Name | Description |',
      '| :--- | :--- |',
      '| A | Short |',
      '| Long name here | A much longer description |',
    ].join('\n');

    const result = formatTablesInMarkdown(input);
    const lines = result.split('\n');

    expect(lines[0]).toBe('| Name           | Description               |');
    expect(lines[1]).toBe('| :------------- | :------------------------ |');
    expect(lines[2]).toBe('| A              | Short                     |');
    expect(lines[3]).toBe('| Long name here | A much longer description |');
  });

  it('keeps escaped pipes inside their cell', () => {
    const input = ['| Agent | Role |', '| :--- | :--- |', '| `o` | `plan\\|full` runs |'].join(
      '\n'
    );

    const lines = formatTablesInMarkdown(input).split('\n');

    expect(lines[2]).toBe('| `o`   | `plan\\|full` runs |');
    expect(lines[0]).toBe('| Agent | Role              |');
  });

  it('handles center-aligned columns', () => {
    const input = [
      '| Left | Center | Right |',
      '| :--- | :---: | ---: |',
      '| a | b | c |',
      '| long | medium val | x |',
    ].join('\n');

    const result = formatTablesInMarkdown(input);
    const lines = result.split('\n');

    // Check separator alignment markers are preserved
    expect(lines[1]).toContain(':');
    // All rows should have same number of | characters
    const pipeCount = lines[0].split('|').length;
    lines.forEach((line) => expect(line.split('|').length).toBe(pipeCount));
  });

  it('leaves non-table content untouched', () => {
    const input = '# Heading\n\nSome text.\n\n> A blockquote\n';
    expect(formatTablesInMarkdown(input)).toBe(input);
  });

  it('handles mixed content with a table in the middle', () => {
    const input = [
      '# Title',
      '',
      'Some intro text.',
      '',
      '| A | B |',
      '| :--- | :--- |',
      '| short | longer value |',
      '',
      'Trailing text.',
    ].join('\n');

    const result = formatTablesInMarkdown(input);
    const lines = result.split('\n');

    // Non-table lines unchanged
    expect(lines[0]).toBe('# Title');
    expect(lines[8]).toBe('Trailing text.');

    // Table lines aligned
    expect(lines[4]).toBe('| A     | B            |');
    expect(lines[6]).toBe('| short | longer value |');
  });

  it('is idempotent — formatting already-formatted tables produces the same output', () => {
    const input = [
      '| Name           | Description               |',
      '| :------------- | :------------------------ |',
      '| A              | Short                     |',
      '| Long name here | A much longer description |',
    ].join('\n');

    const once = formatTablesInMarkdown(input);
    const twice = formatTablesInMarkdown(once);
    expect(twice).toBe(once);
  });

  it('handles multiple tables in one document', () => {
    const input = [
      '| Col1 | Col2 |',
      '| :--- | :--- |',
      '| a | bb |',
      '',
      'Some text.',
      '',
      '| X | Y |',
      '| :--- | :--- |',
      '| foo | barbaz |',
    ].join('\n');

    const result = formatTablesInMarkdown(input);
    const lines = result.split('\n');

    // First table
    expect(lines[0]).toBe('| Col1 | Col2 |');
    expect(lines[2]).toBe('| a    | bb   |');
    // Second table
    expect(lines[6]).toBe('| X   | Y      |');
    expect(lines[8]).toBe('| foo | barbaz |');
  });

  it('handles a table with no data rows (header + separator only)', () => {
    const input = '| A | B |\n| :--- | :--- |';
    const result = formatTablesInMarkdown(input);
    // Should not throw; output is valid with cells padded to separator minimum width
    expect(result).toContain('| A  | B  |');
  });

  it('right-aligns cells correctly', () => {
    const input = [
      '| Item | Count |',
      '| :--- | ---: |',
      '| agents | 26 |',
      '| prompts | 100 |',
    ].join('\n');

    const result = formatTablesInMarkdown(input);
    const lines = result.split('\n');
    // Right-aligned numbers should be right-padded (flush right)
    expect(lines[2]).toContain('26 |');
    expect(lines[3]).toContain('100 |');
  });

  it('keeps an escaped pipe at the end of a row without closing pipe in its cell', () => {
    const input = ['| A | B |', '| - | - |', '| x | y \\|'].join('\n');
    const lines = formatTablesInMarkdown(input).split('\n');
    expect(lines[2]).toBe('| x  | y \\| |');
  });

  it('treats a pipe after an escaped backslash as a separator', () => {
    const input = ['| A | B |', '| - | - |', '| a\\\\ | b |'].join('\n');
    const lines = formatTablesInMarkdown(input).split('\n');
    expect(lines[2]).toBe('| a\\\\ | b  |');
  });

  it('keeps an escaped pipe in the header cell', () => {
    const input = ['| A\\|B | C |', '| - | - |', '| 1 | 2 |'].join('\n');
    const lines = formatTablesInMarkdown(input).split('\n');
    expect(lines[0]).toBe('| A\\|B | C  |');
    expect(lines[2]).toBe('| 1    | 2  |');
  });
});
