import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testMatch: ['**/frontend/tests/**/*.spec.js', '**/tests/bootstrap/browser-*.spec.js'],
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'block', trace: 'retain-on-failure' },
  reporter: [['list']],
  outputDir: 'test-results',
});
