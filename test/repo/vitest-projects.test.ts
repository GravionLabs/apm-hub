import * as fs from 'fs';
import * as path from 'path';
import config from '../../vitest.config';
import { scriptsTests } from '../helpers/scripts-tests';

const ROOT = path.resolve(__dirname, '../..');
const SPAWN = /spawnSync|execFileSync|execSync|spawn\(/;

const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : [rel];
  });

const packageTests = walk('test/packages').filter((f) => f.endsWith('.test.ts'));

// Same membership rule as the project definitions in vitest.config.ts.
const projectOf = (file: string): string[] => {
  const projects = (config.test?.projects ?? []) as Array<{
    test: { name: string; include: string[]; exclude?: string[] };
  }>;
  return projects
    .filter(({ test }) => {
      const inc = test.include.some(
        (g) =>
          g === file ||
          (g.endsWith('/**/*.test.ts') &&
            file.startsWith(g.slice(0, -'**/*.test.ts'.length)) &&
            file.endsWith('.test.ts'))
      );
      return inc && !(test.exclude ?? []).includes(file);
    })
    .map(({ test }) => test.name);
};

describe('vitest projects', () => {
  it('has the unit, scripts and integration projects', () => {
    const names = (config.test?.projects as Array<{ test: { name: string } }>).map(
      (p) => p.test.name
    );
    expect(names).toEqual(['unit', 'scripts', 'integration']);
  });

  it('lists only existing test/packages files as scripts tests', () => {
    for (const f of scriptsTests) expect(packageTests).toContain(f);
  });

  it.each(packageTests)('%s belongs to exactly one of unit and scripts', (file) => {
    const projects = projectOf(file);
    expect(projects).toHaveLength(1);
    expect(['unit', 'scripts']).toContain(projects[0]);
  });

  it.each(packageTests)('%s is in the project matching its process use', (file) => {
    const spawns = SPAWN.test(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    expect(projectOf(file)).toEqual([spawns ? 'scripts' : 'unit']);
  });
});
