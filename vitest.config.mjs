import { defineConfig } from 'vitest/config';

// Cobertura (Sprint 2): solo se activa cuando scripts/test-coverage/run.mjs define FARMAFIND_COVERAGE_BLOB.
// Cada suite deja su informe parcial (blob) y al final se fusionan en coverage/.
const blob = process.env.FARMAFIND_COVERAGE_BLOB;

export default defineConfig({
  test: {
    include: ['tests/bootstrap/**/*.test.mjs', 'backend/tests/**/*.test.ts', 'notifications/tests/**/*.test.ts', 'frontend/tests/**/*.test.{js,jsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.spec.js'],
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
    maxWorkers: 1,
    ...(blob ? { reporters: ['default', ['blob', { outputFile: blob }]] } : {}),
    coverage: {
      enabled: Boolean(blob),
      provider: 'v8',
      include: ['backend/src/**/*.ts', 'notifications/src/**/*.ts', 'frontend/src/**/*.{js,jsx}'],
      exclude: ['**/*.d.ts', '**/dist/**'],
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
