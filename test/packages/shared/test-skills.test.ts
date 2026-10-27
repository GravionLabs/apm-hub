import * as fs from 'fs';
import * as path from 'path';

const packages = path.resolve(__dirname, '../../../packages');
const langs = ['ts', 'py', 'dotnet', 'rust', 'ng'];
const read = (rel: string) => fs.readFileSync(path.join(packages, rel), 'utf-8');
const testSkill = (l: string) => read(`${l}/.apm/skills/${l}-test/SKILL.md`);

// walk every SKILL.md and reference of all packages
const allFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? allFiles(p) : p.endsWith('.md') ? [p] : [];
  });

describe('language test skills (#771)', () => {
  it('the "never the full suite" rule is written only in implementation', () => {
    const hits = allFiles(packages)
      .filter((f) => /never the full suite/.test(fs.readFileSync(f, 'utf-8')))
      .map((f) => path.relative(packages, f));
    expect(hits).toEqual(['shared/.apm/skills/implementation/SKILL.md']);
  });

  it.each(langs)('%s-test keeps one targeted-run line with its command', (l) => {
    const lines = testSkill(l)
      .split('\n')
      .filter((x) => x.includes('Targeted run'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('`');
  });

  it.each(langs)('%s-test description contains "Use"', (l) => {
    const fm = /^---\n([\s\S]*?)\n---/.exec(testSkill(l))![1];
    expect(fm).toMatch(/\bUse\b/);
  });

  it.each(['ts', 'py', 'dotnet', 'rust'])('%s-test has no generic "read the code" steps', (l) => {
    expect(testSkill(l)).not.toMatch(/Read target code|Identify (test )?cases|Choose test type/i);
  });

  it('dotnet-test uses UnitTest in convention and filter', () => {
    const t = testSkill('dotnet');
    expect(t).toContain('[Category("UnitTest")]');
    expect(t).toContain('--filter "TestCategory=UnitTest"');
    expect(t).not.toContain('TestCategory=Unit"');
    expect(t).not.toMatch(/\[SetUp\]|async void/);
  });

  it('py-test keeps the one-type-mark rule and drops the conftest gotcha', () => {
    const t = testSkill('py');
    expect(t).toMatch(/Exactly one type mark per test function/);
    expect(t).not.toContain('auto-discovered');
  });

  it('rust-test keeps the Result and tauri steps', () => {
    const t = testSkill('rust');
    expect(t).toContain('assert on `Result` values');
    expect(t).toContain('frameworks: ["tauri"]');
  });

  it('ts-test: co-located *.test.ts, integration by suffix, no nested unit/integration describes', () => {
    const t = testSkill('ts');
    expect(t).toContain('`*.test.ts`');
    expect(t).toContain('`*.int.test.ts`');
    expect(t).toContain('`*.e2e.test.ts`');
    expect(t).not.toMatch(/describe\('(unit|integration)'/);
    expect(t).not.toMatch(/mirroring the source structure/);
  });

  it('ng-test: example without .component suffix, zoneless async guidance', () => {
    const t = testSkill('ng');
    expect(t).not.toMatch(/\.component'|\.service'/);
    expect(t).toContain("from './my'");
    expect(t).toContain('vi.useFakeTimers()');
    expect(t).toContain('await fixture.whenStable()');
    expect(t).toMatch(/`fakeAsync`\/`tick\(\)` only when the project still uses zone\.js/);
    expect(t).not.toContain("don't need `NgModule`");
  });
});
