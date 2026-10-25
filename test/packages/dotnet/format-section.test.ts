import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const skill = readFileSync(
  path.resolve(__dirname, '../../../packages/dotnet/.apm/skills/dotnet-implementation/SKILL.md'),
  'utf8'
);
const section = /^## Format$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(skill)?.[1] ?? '';
const line = (label: string): string =>
  section.split('\n').find((l) => l.startsWith('- ' + label)) ?? '';

describe('dotnet-implementation ## Format', () => {
  it('has the section with extensions', () => {
    expect(section).not.toBe('');
    expect(line('Extensions:')).toMatch(/`\.[a-z]+/);
  });
  it('names a format and a check command with {files}', () => {
    expect(line('Format:')).toContain('{files}');
    expect(line('Check (read-only):')).toContain('{files}');
  });
  it('states the skip rule and the script call', () => {
    expect(line('Not configured:')).toContain('skip');
    expect(section).toContain('Format-Changed.ps1 -Extensions');
  });
  it('stays within 100 lines', () => {
    expect(skill.split('\n').length).toBeLessThanOrEqual(100);
  });
});
