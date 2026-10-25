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
    expect(section).toContain('Format-Changed.ps1 -Language dotnet -Extensions');
  });
  it('passes -Language dotnet to every script call and explains the override', () => {
    const calls = section.split('\n').filter((x) => x.includes('Format-Changed.ps1'));
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c).toContain('Format-Changed.ps1 -Language dotnet ');
    expect(line('Override:')).toContain('.agents/format.json');
    expect(line('Override:')).toContain('entry for `dotnet` replaces');
    expect(line('Override:')).toContain('`-Language dotnet` only');
    expect(line('Override:')).toContain('error');
  });
  it('points to the JetBrains example', () => {
    expect(line('JetBrains:')).toContain('jb cleanupcode');
    expect(line('JetBrains:')).toContain('jb inspectcode');
    expect(line('JetBrains:')).toContain('docs/usage/format-override.md');
  });
  it('stays within 100 lines', () => {
    expect(skill.split('\n').length).toBeLessThanOrEqual(100);
  });
});
