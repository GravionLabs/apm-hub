import { configDefaults, defineConfig } from 'vitest/config';
import { scriptsTests } from './test/helpers/scripts-tests';

// Four projects:
//  - `unit`: src/**/*.test.ts, test/repo and the test/packages files that spawn no process (`pnpm run test:unit`).
//  - `scripts`: the test/packages files that spawn pwsh, bash or other processes (explicit list in test/helpers/scripts-tests.ts).
//  - `integration`: pwsh-heavy queue tests with fake harness binaries and the launcher installer in test/integration/queue/,
//    split over several files so they run in parallel.
//  - `perf`: wall-clock cases in test/packages/**/*.perf.test.ts, serial (`pnpm run test:perf`, own CI matrix entry).
// `pnpm test` runs unit + scripts, `pnpm run test:all` runs unit + scripts + integration; perf is never part of either.
// A new test/packages file is `unit` unless it is listed in test/helpers/scripts-tests.ts; test/repo/vitest-projects.test.ts fails when a unit file spawns a process.
// test/integration/skills/ is the separate Copilot SDK harness (`pnpm run test:integration`, own package.json), not a project.
const worktrees = [...configDefaults.exclude, '**/.worktrees/**'];
const shared = { globals: true, environment: 'node' } as const;

export default defineConfig({
  test: {
    exclude: worktrees,
    reporters: ['default', ['junit', { outputFile: 'test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['cobertura', 'text'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        extends: false,
        test: {
          ...shared,
          name: 'unit',
          include: ['src/**/*.test.ts', 'test/repo/**/*.test.ts', 'test/packages/**/*.test.ts'],
          exclude: [...worktrees, '**/*.integration.test.ts', '**/*.perf.test.ts', ...scriptsTests],
        },
      },
      {
        extends: false,
        test: {
          ...shared,
          name: 'scripts',
          include: scriptsTests,
          exclude: [...worktrees, '**/*.perf.test.ts'],
          // every file spawns pwsh, bash or git worktree: under full-suite load a single case can exceed the 5 s default
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        extends: false,
        test: {
          ...shared,
          name: 'integration',
          include: ['test/integration/queue/**/*.integration.test.ts'],
          exclude: worktrees,
          // pwsh cold starts are slow on loaded runners: generous timeout for every integration file (no per-file setConfig needed)
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        extends: false,
        test: {
          ...shared,
          name: 'perf',
          include: ['test/packages/**/*.perf.test.ts'],
          exclude: worktrees,
          // timing bounds need an otherwise idle machine: one file at a time, one test at a time
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
