import * as fs from 'node:fs';
import * as path from 'node:path';

const packages = path.resolve(__dirname, '../../packages');
const files = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// #839: 3.3.0 ships no dromos surface; only the decision 004 note of after-install.md names it
describe('shipped packages', () => {
  it('name dromos only in the decision 004 note', () => {
    const hits = files(packages).flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => /dromos/i.test(l))
        .map((l) => ({
          file: path.relative(packages, f),
          decision004: l.includes('decision 004'),
        })),
    );
    expect(hits.filter((h) => !h.decision004)).toEqual([]);
  });
});
