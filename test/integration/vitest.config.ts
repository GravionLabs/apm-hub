import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['skills/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
