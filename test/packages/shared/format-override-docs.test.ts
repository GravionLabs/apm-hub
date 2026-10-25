import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const read = (p: string): string => readFileSync(path.join(root, p), 'utf8');
const doc = read('docs/usage/format-override.md');

describe('docs/usage/format-override.md', () => {
  it('contains the JetBrains example', () => {
    expect(doc).toContain('dotnet tool install -g JetBrains.ReSharper.GlobalTools');
    expect(doc).toContain('jb cleanupcode');
    expect(doc).toContain('jb inspectcode');
    expect(doc).toContain('git diff --exit-code');
  });
  it('documents precedence, errors and the gitignore note', () => {
    expect(doc).toMatch(/replaces all default commands/i);
    expect(doc).toMatch(/not installed is an error/i);
    expect(doc).toMatch(/^\.agents\/\*$/m);
    expect(doc).toMatch(/^!\.agents\/format\.json$/m);
  });
  it('is linked from README and the site sidebar', () => {
    expect(read('README.md')).toContain('docs/usage/format-override.md');
    expect(read('site/.vitepress/sidebar.ts')).toContain('/usage/format-override');
  });
  it('is mentioned by the implementation skill and stays within 100 lines', () => {
    const s = read('packages/shared/.apm/skills/implementation/SKILL.md');
    expect(s).toContain('.agents/format.json');
    expect(s.split('\n').length).toBeLessThanOrEqual(100);
  });
});
