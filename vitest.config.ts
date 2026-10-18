import { defineConfig } from 'vitest/config';

// Unit tests of the TypeScript tools sit next to their code (src/**/*.test.ts); tests of package content
// (skills, agents, scripts, hooks) live in test/packages/<domain>/, repository checks in test/repo/.
// Two projects: `fast` (all of those) and `integration` (pwsh-heavy queue tests with fake harness binaries
// and the launcher installer in test/integration/queue/, split over several files so they run in parallel).
// `vitest run` runs both; `pnpm run test:fast` runs only `fast`. test/integration/skills/ is the separate
// Copilot SDK harness (`pnpm run test:integration`, own package.json) and is not part of either project.
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
          name: 'fast',
          include: ['src/**/*.test.ts', 'test/packages/**/*.test.ts', 'test/repo/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
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
