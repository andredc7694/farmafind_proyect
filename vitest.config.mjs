import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/bootstrap/**/*.test.mjs', 'backend/tests/**/*.test.ts', 'notifications/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.spec.js'],
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
