import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// @ts-expect-error plain .mjs script without type declarations
import { pathsFromArgs, relatedTests } from '../../scripts/related-tests.mjs';

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
  'test/packages/hooks/git-guardrails.test.ts',
  'test/packages/hooks/git-guardrails.perf.test.ts',
  'test/repo/ci-workflow.test.ts',
  'test/repo/pages-workflow.test.ts',
  'test/repo/state-dir-resolver.test.ts',
  'test/packages/delivery/queue.fast.test.ts',
  'test/packages/delivery/queue.perf.test.ts',
  'test/packages/github/enter-checkout.test.ts',
  'test/integration/queue/queue.mode.integration.test.ts',
  'test/integration/queue/queue.status.integration.test.ts',
  'test/helpers/scripts-tests.ts',
];

const SCRIPT = path.resolve(__dirname, '../../scripts/related-tests.mjs');
const RUNNER = path.resolve(__dirname, '../../scripts/run-related-tests.mjs');
const QUEUE_SCRIPT = 'packages/delivery/.apm/skills/queue/scripts/Invoke-OrchestratorQueue.ps1';
const INTEGRATION = [
  'test/integration/queue/queue.mode.integration.test.ts',
  'test/integration/queue/queue.status.integration.test.ts',
];

let root: string;
const relIn = (project: string, ...p: string[]) => relatedTests(p, { root, project }) as string[];
const rel = (...p: string[]) => relatedTests(p, { root }) as string[];

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'related-tests-'));
  for (const f of FILES) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), '');
  }
  fs.writeFileSync(
    path.join(root, 'test/helpers/scripts-tests.ts'),
    "export const scriptsTests = [\n  'test/packages/delivery/queue.fast.test.ts',\n  'test/packages/github/enter-checkout.test.ts',\n];\n"
  );
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
      'test/packages/github/enter-checkout.test.ts',
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
      'test/repo/ci-workflow.test.ts',
      'test/repo/pages-workflow.test.ts',
      'test/repo/state-dir-resolver.test.ts',
    ]);
  });

  it.each(['release-branch', 'issue-events', 'project-needs'])(
    'maps the caller workflow %s.yml also to release-workflow.test.ts',
    (name) => {
      expect(rel(`.github/workflows/${name}.yml`)).toEqual([
        'test/packages/github/release-workflow.test.ts',
        'test/repo/ci-workflow.test.ts',
        'test/repo/pages-workflow.test.ts',
        'test/repo/state-dir-resolver.test.ts',
      ]);
    }
  );

  it('leaves perf tests out of a package change', () => {
    expect(rel('packages/hooks/hooks.json')).toEqual([
      'src/generators/agent-size-validator.test.ts',
      'src/generators/skill-size-validator.test.ts',
      'test/packages/hooks/git-guardrails.test.ts',
    ]);
  });

  it('filters an explicit perf test path', () => {
    expect(rel('test/packages/hooks/git-guardrails.perf.test.ts')).toEqual([]);
    expect(
      rel('test/packages/hooks/git-guardrails.perf.test.ts', 'test/repo/pages-workflow.test.ts')
    ).toEqual(['test/repo/pages-workflow.test.ts']);
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

describe('related-tests with a project', () => {
  it('maps queue skill files to the integration tests', () => {
    expect(relIn('integration', QUEUE_SCRIPT)).toEqual(INTEGRATION);
  });

  it('maps the github-issue scripts to the integration tests', () => {
    expect(
      relIn('integration', 'packages/github/.apm/skills/github-issue/scripts/Enter-Checkout.ps1')
    ).toEqual(INTEGRATION);
  });

  it('does not map other package files to the integration tests', () => {
    expect(relIn('integration', 'packages/ts/.apm/skills/ts-pnpm-workflow/SKILL.md')).toEqual([]);
  });

  it('splits the delivery tests into unit, scripts and perf', () => {
    expect(relIn('scripts', QUEUE_SCRIPT)).toEqual(['test/packages/delivery/queue.fast.test.ts']);
    expect(relIn('perf', QUEUE_SCRIPT)).toEqual(['test/packages/delivery/queue.perf.test.ts']);
    expect(relIn('unit', QUEUE_SCRIPT)).toEqual([
      'src/generators/agent-size-validator.test.ts',
      'src/generators/skill-size-validator.test.ts',
    ]);
  });

  it('lists an explicit perf test only for project perf', () => {
    const f = 'test/packages/hooks/git-guardrails.perf.test.ts';
    expect(relIn('perf', f)).toEqual([f]);
    expect(relIn('unit', f)).toEqual([]);
  });

  it('keeps the output without a project unchanged', () => {
    expect(rel(QUEUE_SCRIPT)).toEqual([
      'src/generators/agent-size-validator.test.ts',
      'src/generators/skill-size-validator.test.ts',
      'test/packages/delivery/queue.fast.test.ts',
    ]);
  });

  it.each(['test/helpers/queue-batch.ps1', 'test/helpers/queue.helpers.ts', 'README.md'])(
    'prints ALL for %s',
    (p) => {
      expect(relIn('integration', p)).toEqual(['ALL']);
    }
  );
});

describe('related-tests CLI', () => {
  const run = (script: string, ...args: string[]) =>
    spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

  it('pathsFromArgs skips --project and its value', () => {
    expect(pathsFromArgs(['--project', 'perf', 'a.ts'])).toEqual(['a.ts']);
  });

  it('pathsFromArgs resolves --base to the changed files since the ref', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'related-base-'));
    try {
      const git = (...a: string[]) =>
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
          cwd: repo,
          encoding: 'utf8',
        });
      git('init', '-q', '-b', 'main');
      fs.writeFileSync(path.join(repo, 'a.txt'), 'a');
      git('add', '.');
      git('commit', '-q', '-m', 'a');
      fs.writeFileSync(path.join(repo, 'b.txt'), 'b');
      git('add', '.');
      git('commit', '-q', '-m', 'b');
      expect(pathsFromArgs(['--base', 'HEAD~1'], repo)).toEqual(['b.txt']);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('lists the queue integration tests for --project integration', () => {
    const r = run(SCRIPT, '--project', 'integration', QUEUE_SCRIPT);
    expect(r.status).toBe(0);
    expect(r.stdout.split('\n')).toContain('test/integration/queue/queue.mode.integration.test.ts');
  });

  it('lists perf files for --project perf', () => {
    const r = run(SCRIPT, '--project', 'perf', 'packages/hooks/.apm/hooks.json');
    expect(r.stdout).toContain('test/packages/hooks/git-guardrails.perf.test.ts');
  });

  it('runner prints "No related tests." and exits 0 for an empty selection', () => {
    const r = run(
      RUNNER,
      '--project',
      'unit',
      '--coverage',
      'test/packages/hooks/git-guardrails.perf.test.ts'
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('No related tests.');
  });
});
