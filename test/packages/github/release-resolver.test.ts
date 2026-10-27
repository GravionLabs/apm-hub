import * as fs from 'fs';
import * as path from 'path';
import { useReleaseFixture } from '../../helpers/release-fixture';

// The resolver snippet of release-branches.md (step 4) is extracted verbatim and run against the shared release fixture.
const root = path.resolve(__dirname, '../../..');
const reference = fs.readFileSync(
  path.join(root, 'packages/github/.apm/skills/github-issue/references/release-branches.md'),
  'utf-8'
);
const m = reference.match(/`(h=\$\(git ls-remote --heads origin 'release\/\*'[^`]*)`/);
if (!m) throw new Error('resolver snippet not found');
const resolver = m[1];

describe('resolver step 4 (#252)', () => {
  const fx = useReleaseFixture();
  const { dropRef, resetHeads, bash } = fx;
  beforeEach(resetHeads);

  it('prefers release/next when it exists', () => {
    const r = bash(fx.clone, resolver);
    expect(r.status).toBe(0);
    expect(r.out).toBe('release/next');
  });

  it('skips release/<x.y> lines whose v<x.y>.0 tag is on origin (even the highest) and legacy names', () => {
    dropRef('refs/heads/release/next');
    const r = bash(fx.clone, resolver);
    expect(r.status).toBe(0);
    expect(r.out).toBe('release/2.2');
  });

  it('prints nothing when every release/<x.y> is released', () => {
    dropRef('refs/heads/release/next');
    dropRef('refs/heads/release/2.2');
    expect(bash(fx.clone, resolver).out).toBe('');
  });

  it('prints nothing without release branches', () => {
    for (const b of ['next', '2.1', '2.2', '9.0', 'legacy']) dropRef(`refs/heads/release/${b}`);
    dropRef('refs/heads/fresh');
    expect(bash(fx.clone, resolver).out).toBe('');
  });
});
