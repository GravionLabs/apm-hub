import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// @ts-expect-error plain .mjs script without type declarations
import { relatedTests } from '../../scripts/related-tests.mjs';

const FILES = [
  'src/generators/skill-list.ts',
  'src/generators/skill-list.test.ts',
  'src/generators/skill-size-validator.test.ts',
  'src/generators/agent-size-validator.test.ts',
  'src/util.ts',
  'src/index.ts',
  'src/index.test.ts',
  'test/packages/ts/ts-pnpm-workflow.test.ts',
  'test/packages/ts/ts-package.test.ts',
  'test/packages/github/release-workflow.test.ts',
  'test/repo/pages-workflow.test.ts',
  'test/repo/state-dir-resolver.test.ts',
];

let root: string;
const rel = (...p: string[]) => relatedTests(p, { root }) as string[];

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'related-tests-'));
  for (const f of FILES) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), '');
  }
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('related-tests', () => {
  it('maps src/<x>.ts to its own test', () => {
    expect(rel('src/generators/skill-list.ts')).toEqual(['src/generators/skill-list.test.ts']);
  });

  it('maps a src file without own test to all src tests', () => {
    expect(rel('src/util.ts')).toEqual(
      FILES.filter((f) => f.startsWith('src/') && f.endsWith('.test.ts')).sort()
    );
  });

  it('maps a package file to the domain tests plus the validators', () => {
    expect(rel('packages/github/apm.yml')).toEqual([
      'src/generators/agent-size-validator.test.ts',
      'src/generators/skill-size-validator.test.ts',
      'test/packages/github/release-workflow.test.ts',
    ]);
  });

  it('narrows a skill file to test/packages/<domain>/<name>*.test.ts', () => {
    expect(rel('packages/ts/.apm/skills/ts-pnpm-workflow/SKILL.md')).toEqual([
      'src/generators/agent-size-validator.test.ts',
      'src/generators/skill-size-validator.test.ts',
      'test/packages/ts/ts-pnpm-workflow.test.ts',
    ]);
  });

  it('falls back to the domain tests when no test matches the skill name', () => {
    expect(rel('packages/ts/.apm/skills/ts-create-project/SKILL.md')).toContain(
      'test/packages/ts/ts-package.test.ts'
    );
  });

  it('maps .github to the repo tests', () => {
    expect(rel('.github/workflows/ci.yml')).toEqual([
      'test/repo/pages-workflow.test.ts',
      'test/repo/state-dir-resolver.test.ts',
    ]);
  });

  it('maps a test file to itself', () => {
    expect(rel('test/repo/pages-workflow.test.ts')).toEqual(['test/repo/pages-workflow.test.ts']);
  });

  it.each([
    'test/helpers/queue.helpers.ts',
    'vitest.config.ts',
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.json',
    'README.md',
    'docs/x.md',
  ])('prints ALL for %s', (p) => {
    expect(rel(p)).toEqual(['ALL']);
  });

  it('ALL wins over specific paths', () => {
    expect(rel('src/generators/skill-list.ts', 'package.json')).toEqual(['ALL']);
  });

  it('deduplicates and sorts', () => {
    expect(
      rel('src/index.ts', 'src/index.test.ts', 'src/generators/skill-list.ts', './src\\index.ts')
    ).toEqual(['src/generators/skill-list.test.ts', 'src/index.test.ts']);
  });

  it('prints nothing for no paths', () => {
    expect(rel()).toEqual([]);
  });
});
