import { defineConfig } from 'vitest/config';
import { scriptsTests } from './test/helpers/scripts-tests';

// Three projects:
//  - `unit`: src/**/*.test.ts, test/repo and the test/packages files that spawn no process (`pnpm run test:unit`).
//  - `scripts`: the test/packages files that spawn pwsh, bash or other processes (explicit list in test/helpers/scripts-tests.ts).
//  - `integration`: pwsh-heavy queue tests with fake harness binaries and the launcher installer in test/integration/queue/,
//    split over several files so they run in parallel.
// `pnpm test` runs unit + scripts, `pnpm run test:all` (and `vitest run`) runs all three. A new test/packages file is `unit`
// unless it is listed in test/helpers/scripts-tests.ts; test/repo/vitest-projects.test.ts fails when a unit file spawns a process.
// test/integration/skills/ is the separate Copilot SDK harness (`pnpm run test:integration`, own package.json), not a project.
const shared = { globals: true, environment: 'node' } as const;

export default defineConfig({
  test: {
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
          exclude: ['**/node_modules/**', '**/*.integration.test.ts', ...scriptsTests],
        },
      },
      {
        extends: false,
        test: {
          ...shared,
          name: 'scripts',
          include: scriptsTests,
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
          // pwsh cold starts are slow on loaded runners: generous timeout for every integration file (no per-file setConfig needed)
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
