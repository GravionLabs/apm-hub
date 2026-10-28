import * as fs from 'fs';
import * as path from 'path';

const FILE = path.resolve(
  __dirname,
  '../../../packages/delivery/.apm/skills/apm-install/references/after-install.md',
);

const TOP_LEVEL_KEYS = ['harness', 'models', 'skills', 'test', 'parallel', 'maxFixRounds', 'allow'];

function readExample(): Record<string, unknown> {
  const md = fs.readFileSync(FILE, 'utf8');
  const match = /```json\r?\n([\s\S]*?)```/.exec(md);
  if (!match) throw new Error('no json example in after-install.md');
  return JSON.parse(match[1]);
}

describe('after-install.md runner config example', () => {
  it('uses only top-level keys of the dromos RunnerConfigSchema', () => {
    const config = readExample();
    for (const key of Object.keys(config)) {
      expect(TOP_LEVEL_KEYS).toContain(key);
    }
  });

  it('shows the keys dromos init manages', () => {
    const config = readExample();
    expect(config).toEqual({ harness: 'claude', test: { full: 'pnpm test' }, parallel: 3 });
  });

  it('documents models nested per harness family as an optional key', () => {
    const md = fs.readFileSync(FILE, 'utf8');
    expect(md).toContain('`models.<claude|copilot>.<role>`');
  });
});
