/** F04 browser regression with mocked approved HTTP contracts, in Linux Playwright. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
assert.equal((await fetch('http://127.0.0.1:5173/reservations')).status, 200);
const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
  '-e', 'F08_TEST_API_CONTAINER=1', '-e', 'F08_TEST_SUITE=reservations',
  '-v', `${root}:/work`, '-w', '/work', 'mcr.microsoft.com/playwright:v1.65.0-noble',
  'node', 'scripts/f08/run-test-api-container.mjs'], { cwd: root, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
