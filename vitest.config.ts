import { defineConfig } from 'vitest/config';

// Two projects: `fast` (everything except *.integration.test.ts) and `integration` (pwsh-heavy queue
// tests with fake harness binaries and the launcher installer, split over several files so they run in parallel).
// `vitest run` runs both; `pnpm run test:fast` runs only `fast`.
const shared = { globals: true, environment: 'node' } as const;
const exclude = ['**/node_modules/**', 'src/**/*.integration.test.ts'];

export default defineConfig({
  test: {
    reporters: ['default', ['junit', { outputFile: 'test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['cobertura', 'text'],
      reportsDirectory: 'coverage',
    },
    projects: [
      { extends: false, test: { ...shared, name: 'fast', include: ['src/**/*.test.ts'], exclude } },
      {
        extends: false,
        test: {
          ...shared,
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          // pwsh cold starts are slow on loaded runners: generous timeout for every integration file (no per-file setConfig needed)
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
