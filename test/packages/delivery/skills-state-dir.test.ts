import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(__dirname, '../../../packages');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe('delivery and shared skills keep no state under .agents/', () => {
  const files = [
    ...walk(path.join(root, 'delivery/.apm/skills')),
    ...walk(path.join(root, 'shared/.apm/skills')),
  ].filter((f) => /\.(md)$/.test(f));

  it('has no .agents state path except the .agents/skills install dir', () => {
    const offenders = files.filter((f) =>
      /\.agents(?!\/skills)/.test(
        fs
          .readFileSync(f, 'utf8')
          .replace(
            /\.opencode\|\.agents\||~\/\.agents|\.agents\/(format|config)\.json|\.agents\/\*/g,
            '',
          ),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
