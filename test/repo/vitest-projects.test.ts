import * as fs from 'fs';
import * as path from 'path';
import config from '../../vitest.config';
import { scriptsTests } from '../helpers/scripts-tests';

const ROOT = path.resolve(__dirname, '../..');
// Helpers that spawn on behalf of the test file count too (createClassifyFixture runs git and pwsh).
const SPAWN = /spawnSync|execFileSync|execSync|spawn\(|createClassifyFixture\(/;

const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : [rel];
  });

const packageTests = walk('test/packages').filter((f) => f.endsWith('.test.ts'));

// Same membership rule as the project definitions in vitest.config.ts.
const projectOf = (file: string): string[] => {
  const projects = (config.test?.projects ?? []) as Array<{
    test: { name: string; include: string[]; exclude?: string[]; fileParallelism?: boolean };
  }>;
  return projects
    .filter(({ test }) => {
      const inc = test.include.some(
        (g) =>
          g === file ||
          (g.includes('/**/*') &&
            file.startsWith(g.slice(0, g.indexOf('**'))) &&
            file.endsWith(g.slice(g.indexOf('**/*') + '**/*'.length)))
      );
      // exclude entries are literal files or `**/*<suffix>` globs
      const excluded = (test.exclude ?? []).some(
        (g) => g === file || (g.startsWith('**/*.') && file.endsWith(g.slice('**/*'.length)))
      );
      return inc && !excluded;
    })
    .map(({ test }) => test.name);
};

describe('vitest projects', () => {
  it('has the unit, scripts, integration and perf projects', () => {
    const names = (config.test?.projects as Array<{ test: { name: string } }>).map(
      (p) => p.test.name
    );
    expect(names).toEqual(['unit', 'scripts', 'integration', 'perf']);
  });

  it('keeps the perf file wired to the shared fixture (it is not run by pnpm test)', () => {
    const perf = fs.readFileSync(
      path.join(ROOT, 'test/packages/hooks/git-guardrails.perf.test.ts'),
      'utf8'
    );
    const fixture = fs.readFileSync(
      path.join(ROOT, 'test/helpers/git-guardrails-fixture.ts'),
      'utf8'
    );
    expect(perf).toContain("from '../../helpers/git-guardrails-fixture'");
    expect(fixture).toMatch(/export const createGuardFixture\b/);
    // every helper the perf file takes from the fixture is part of what the fixture returns
    const taken =
      /const \{([^}]*)\} = fx;/
        .exec(perf)?.[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    expect(taken.length).toBeGreaterThan(0);
    const returned = fixture.slice(fixture.indexOf('return {'));
    for (const name of taken) expect(returned).toMatch(new RegExp(`\\b${name}\\b`));
    // the 44 timed and limit cases are all still declared there
    expect(perf).toMatch(/describe\('performance and limits'/);
  });

  it('runs the perf project one file at a time', () => {
    const perf = (
      config.test?.projects as Array<{ test: { name: string; fileParallelism?: boolean } }>
    ).find((p) => p.test.name === 'perf');
    expect(perf?.test.fileParallelism).toBe(false);
  });

  it('lists only existing test/packages files as scripts tests', () => {
    for (const f of scriptsTests) expect(packageTests).toContain(f);
  });

  it.each(packageTests.filter((f) => f.endsWith('.perf.test.ts')))(
    '%s belongs to the perf project only',
    (file) => {
      expect(projectOf(file)).toEqual(['perf']);
    }
  );

  it.each(packageTests.filter((f) => !f.endsWith('.perf.test.ts')))(
    '%s belongs to exactly one of unit and scripts',
    (file) => {
      const projects = projectOf(file);
      expect(projects).toHaveLength(1);
      expect(['unit', 'scripts']).toContain(projects[0]);
    }
  );

  it.each(packageTests.filter((f) => !f.endsWith('.perf.test.ts')))(
    '%s is in the project matching its process use',
    (file) => {
      const spawns = SPAWN.test(fs.readFileSync(path.join(ROOT, file), 'utf8'));
      expect(projectOf(file)).toEqual([spawns ? 'scripts' : 'unit']);
    }
  );
});
