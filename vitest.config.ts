import { configDefaults, defineConfig } from 'vitest/config';

// One project: src/**/*.test.ts, test/repo and test/packages. Many cases spawn pwsh, bash or git, so the timeouts are generous.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/repo/**/*.test.ts', 'test/packages/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default', ['junit', { outputFile: 'test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['cobertura', 'text'],
      reportsDirectory: 'coverage',
    },
  },
});
