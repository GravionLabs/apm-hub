import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const skills = path.resolve(__dirname, '../../../packages/apm-tooling/.apm/skills');
const read = (rel: string): string => readFileSync(path.join(skills, rel), 'utf8');

const FORBIDDEN_KEYS = ['compatibility', 'chronicle-hints', 'model'];

describe('apm-tooling enforces the skill frontmatter convention', () => {
  it.each([
    'skill-write/references/skill-writing-rules.md',
    'skill-audit/references/audit-checklist.md',
    'skill-audit/SKILL.md',
  ])('%s names every forbidden top-level key', (file) => {
    const text = read(file);
    for (const key of FORBIDDEN_KEYS) {
      expect(text, `${file} lacks ${key}`).toContain(key);
    }
  });

  it('skill-write template frontmatter has only name and description', () => {
    const text = read('skill-write/assets/skill-template-optimized.md');
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    expect(match).not.toBeNull();
    const keys = [...match![1].matchAll(/^([A-Za-z][\w/-]*):/gm)].map((m) => m[1]);
    expect(keys).toEqual(['name', 'description']);
  });

  it('skill-write SKILL.md points annotations to metadata', () => {
    expect(read('skill-write/SKILL.md')).toContain('metadata');
  });

  it('no apm-tooling skill references the stale skill-size-validator.ts', () => {
    for (const file of [
      'skill-write/SKILL.md',
      'skill-write/references/skill-writing-rules.md',
      'skill-audit/SKILL.md',
      'skill-audit/references/audit-checklist.md',
      'skill-update/SKILL.md',
      'skill-slim/SKILL.md',
    ]) {
      expect(read(file), file).not.toContain('skill-size-validator.ts');
    }
  });
});
