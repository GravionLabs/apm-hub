import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

// #774: names, versions and descriptions match what 3.0.0 ships
const root = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.name === 'node_modules') return [];
    return e.isDirectory() ? walk(p) : [p];
  });
const manifests = fs
  .readdirSync(path.join(root, 'packages'))
  .map((d) => `packages/${d}/apm.yml`)
  .filter((f) => fs.existsSync(path.join(root, f)));

describe('removed names are gone from packages, manifests and AGENTS.md (#766)', () => {
  const files = [
    ...walk(path.join(root, 'packages')),
    path.join(root, 'apm.yml'),
    path.join(root, 'AGENTS.md'),
  ].filter((f) => !/\.(png|jpg|ico|zip)$/.test(f));
  it.each([
    'verify-project',
    'Final-Verify',
    'git-cliff changelog setup',
    'batch implementation',
    'model-policy',
    'batch-workflow',
    'subagent_type: explorer',
  ])('%s', (needle) => {
    const hits = files
      .filter((f) => fs.readFileSync(f, 'utf-8').includes(needle))
      .map((f) => path.relative(root, f));
    expect(hits).toEqual([]);
  });
});

describe('versions and descriptions (#774)', () => {
  it('all package manifests and the root apm.yml carry the same version', () => {
    const versions = [...manifests, 'apm.yml'].map((f) => parse(read(f)).version);
    expect(new Set(versions).size).toBe(1);
  });

  it('delivery, github and py manifests carry no stale text', () => {
    expect(parse(read('packages/delivery/apm.yml')).description).not.toMatch(/git-cliff/);
    expect(parse(read('packages/github/apm.yml')).description).not.toMatch(/batch/);
    const keywords: string[] = parse(read('packages/py/apm.yml')).keywords;
    expect(keywords).not.toContain('mcp');
    expect(keywords).not.toContain('debugging');
  });

  it('root marketplace entries drop the stale text too', () => {
    const entries: { description: string }[] = parse(read('apm.yml')).marketplace.packages;
    expect(entries.map((e) => e.description).join('\n')).not.toMatch(/git-cliff|batch/);
  });

  it('ng-implementation says Angular 21+', () => {
    expect(read('packages/ng/.apm/skills/ng-implementation/SKILL.md')).toMatch(
      /^description: 'Angular 21\+/m
    );
  });

  it('diagnose and retro name no removed role', () => {
    expect(read('packages/shared/.apm/skills/diagnose/SKILL.md')).not.toContain('As implementer');
    expect(read('packages/shared/.apm/skills/diagnose/SKILL.md')).toContain('As a subagent');
    const retro = read('packages/delivery/.apm/skills/retro/SKILL.md');
    expect(/^description: (.*)$/m.exec(retro)![1]).not.toContain('orchestrator run');
    expect(retro).toContain('run or session');
  });

  it('implementation asks for one full run before the pull request', () => {
    expect(read('packages/shared/.apm/skills/implementation/SKILL.md')).toContain(
      'one full run before the pull request'
    );
  });
});
