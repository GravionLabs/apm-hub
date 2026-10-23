import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const skills = path.resolve(__dirname, '../../../packages/apm-tooling/.apm/skills');
const read = (rel: string): string => readFileSync(path.join(skills, rel), 'utf8');

const FORBIDDEN_KEYS = ['compatibility', 'chronicle-hints', 'model', 'allowed-tools'];
const lines = (rel: string): string[] => read(rel).split('\n');
const namesAll = (line: string, keys: string[]): boolean =>
  keys.every((k) => line.includes(`\`${k}\``));

describe('apm-tooling enforces the skill frontmatter convention', () => {
  it.each([
    ['skill-write/references/skill-writing-rules.md', /Forbidden top-level keys \(🔴\)/],
    ['skill-write/SKILL.md', /Never .* at top level/],
  ])('%s lists every forbidden key on its forbidden-key rule line', (file, rule) => {
    const line = lines(file).find((l) => rule.test(l));
    expect(line, `${file} has no forbidden-key rule line`).toBeDefined();
    for (const key of FORBIDDEN_KEYS) {
      expect(line, `${file} rule line lacks \`${key}\``).toContain(`\`${key}\``);
    }
  });

  it.each(['skill-audit/references/audit-checklist.md', 'skill-audit/SKILL.md'])(
    '%s rates every forbidden top-level key critical',
    (file) => {
      const line = lines(file).find((l) => namesAll(l, FORBIDDEN_KEYS));
      expect(line, `${file} has no line naming all forbidden keys`).toBeDefined();
      expect(line).toContain('🔴');
    }
  );

  it('skill-audit checklist recommends moving annotations to metadata', () => {
    const line = lines('skill-audit/references/audit-checklist.md').find((l) =>
      namesAll(l, FORBIDDEN_KEYS)
    );
    expect(line).toMatch(/recommendation: remove, or move annotations to `metadata:`/);
  });

  it('skill-write template frontmatter has only name and description', () => {
    const text = read('skill-write/assets/skill-template-optimized.md');
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    expect(match).not.toBeNull();
    const keys = [...match![1].matchAll(/^([A-Za-z][\w/-]*):/gm)].map((m) => m[1]);
    expect(keys).toEqual(['name', 'description']);
  });

  it('skill-write sends chronicle-hints to metadata', () => {
    expect(read('skill-write/references/skill-writing-rules.md')).toMatch(
      /`chronicle-hints` \(move to `metadata:`\)/
    );
    expect(read('skill-write/SKILL.md')).toMatch(
      /`chronicle-hints` at top level; annotations go under `metadata`/
    );
  });

  it('no apm-tooling skill references the stale skill-size-validator.ts', () => {
    for (const file of [
      'skill-write/SKILL.md',
      'skill-write/references/skill-writing-rules.md',
      'skill-audit/SKILL.md',
      'skill-audit/references/audit-checklist.md',
      'skill-update/SKILL.md',
      'skill-slim/SKILL.md',
      'agent-write/SKILL.md',
      'agent-audit/SKILL.md',
      'agent-audit/references/audit-checklist.md',
    ]) {
      expect(read(file), file).not.toContain('skill-size-validator.ts');
    }
  });
});

const AGENT_FORBIDDEN_KEYS = ['model', 'mode', 'permission', 'color', 'steps', 'agents'];
const AGENT_TOP_LEVEL = [
  'name',
  'description',
  'tools',
  'user-invocable',
  'disable-model-invocation',
  'metadata',
];

const frontmatter = (text: string): string => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  expect(match).not.toBeNull();
  return match![1];
};
const topLevelKeys = (fm: string): string[] =>
  [...fm.matchAll(/^([A-Za-z][\w/-]*):/gm)].map((m) => m[1]);

describe('apm-tooling enforces the agent frontmatter convention', () => {
  it.each([
    'agent-audit/SKILL.md',
    'agent-audit/references/audit-checklist.md',
    'agent-write/SKILL.md',
  ])('%s names every forbidden top-level agent key', (file) => {
    const text = read(file);
    for (const key of AGENT_FORBIDDEN_KEYS) {
      expect(text, `${file} lacks ${key}`).toContain(`\`${key}\``);
    }
  });

  it('agent-audit rates forbidden top-level agent keys critical', () => {
    const line = read('agent-audit/references/audit-checklist.md')
      .split('\n')
      .find((l) => l.includes('`model`, `mode`, `permission`, `color`, `steps`, `agents`'));
    expect(line).toBeDefined();
    expect(line).toContain('🔴');
  });

  it.each(['agent-write/SKILL.md', 'agent-audit/SKILL.md'])(
    '%s points to the agent convention doc',
    (file) => {
      expect(read(file)).toContain('docs/concepts/agent-frontmatter.md');
    }
  );

  it('agent-write template keeps platform keys under metadata', () => {
    const fm = frontmatter(read('agent-write/assets/agent-template.md'));
    const keys = topLevelKeys(fm);
    expect(keys).toEqual(['name', 'description', 'tools', 'user-invocable', 'metadata']);
    for (const key of keys) expect(AGENT_TOP_LEVEL).toContain(key);
    expect(fm).toMatch(/^ {2}claude:$/m);
    expect(fm).toMatch(/^ {2}opencode:$/m);
    expect(fm).toContain('model: anthropic/claude-haiku-5-5');
  });

  it('agent-write template body stays within 40 lines', () => {
    const text = read('agent-write/assets/agent-template.md');
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimEnd();
    expect(body.split('\n').length).toBeLessThanOrEqual(40);
  });
});
