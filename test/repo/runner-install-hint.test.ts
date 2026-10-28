import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
// The unscoped npm name `dromos` is a foreign package; the runner is published as @gravionlabs/dromos.
const UNSCOPED_INSTALL = /npm\s+(?:i|install|add)\s+(?:-g|--global)\s+dromos(?![\w@/-])/;
const SCOPED_INSTALL = 'npm i -g @gravionlabs/dromos';

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listFiles(full);
    return /\.(md|ps1|ya?ml|json|mjs|ts)$/.test(entry.name) ? [full] : [];
  });
}

const files = [
  ...['packages', '.github', 'docs'].flatMap((d) => listFiles(path.join(ROOT, d))),
  path.join(ROOT, 'README.md'),
];
// CHANGELOG.md is generated from historical commit subjects and is not scanned.

describe('runner install hint', () => {
  it('matches the unscoped install command', () => {
    expect('npm i -g dromos').toMatch(UNSCOPED_INSTALL);
    expect('npm install -g dromos').toMatch(UNSCOPED_INSTALL);
    expect(SCOPED_INSTALL).not.toMatch(UNSCOPED_INSTALL);
  });

  it('is never the unscoped npm package in packages/, .github/ and docs/', () => {
    const offenders = files
      .filter((f) => UNSCOPED_INSTALL.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it.each([
    '.github/skills/check-prerequisites/SKILL.md',
    '.github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1',
    'packages/delivery/.apm/skills/apm-install/references/after-install.md',
  ])('names the scoped package in %s', (rel) => {
    expect(fs.readFileSync(path.join(ROOT, rel), 'utf8')).toContain(SCOPED_INSTALL);
  });
});
