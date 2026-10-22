import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

describe('targeted test rule for the implementer (#448)', () => {
  const implementer = read('agents/.apm/agents/implementer.agent.md');

  it('implementer rule 4 is targeted, never the full suite, never red', () => {
    const rule = implementer.split('\n').find((l) => l.startsWith('4. '))!;
    expect(rule).toMatch(/build only when the stack compiles and compiled sources changed/);
    expect(rule).toMatch(/targeted tests/);
    expect(rule).toMatch(/never the full suite/);
    expect(rule).toMatch(/Final-Verify/);
    expect(rule).toContain('Never commit a red suite.');
    expect(rule).not.toContain('full test suite before every commit');
  });

  it('implementation checklist "Before commit" names the targeted rule', () => {
    const skill = read('shared/.apm/skills/implementation/SKILL.md');
    const section = skill.split('## Before commit')[1].split('## ')[0];
    expect(section).toMatch(/targeted tests/);
    expect(section).toMatch(/never the full suite/);
    expect(section).toMatch(/Final-Verify/);
    expect(section).toMatch(/Never commit red/);
  });

  it('implementation checklist requires a test per Invariants item (#484)', () => {
    const skill = read('shared/.apm/skills/implementation/SKILL.md');
    const section = skill.split('## Before commit')[1].split('## ')[0];
    expect(section).toMatch(/Invariants section.*has a test that exercises it/);
  });

  it.each([
    ['ts/.apm/skills/ts-test/SKILL.md', 'npx vitest run <path>'],
    ['dotnet/.apm/skills/dotnet-test/SKILL.md', 'dotnet test --filter "FullyQualifiedName~<Name>"'],
    ['py/.apm/skills/py-test/SKILL.md', 'uv run pytest <path>'],
    ['rust/.apm/skills/rust-test/SKILL.md', 'cargo test <name>'],
    ['ng/.apm/skills/ng-test/SKILL.md', 'npx vitest run <paths>'],
  ])('%s has a Targeted run line with the concrete command and stays <= 100 lines', (file, cmd) => {
    const text = read(file);
    const line = text.split('\n').find((l) => l.includes('**Targeted run**'))!;
    expect(line).toBeDefined();
    expect(line).toContain(cmd);
    expect(line).toMatch(/never the full suite/);
    expect(text.split('\n').length).toBeLessThanOrEqual(100);
  });
});
