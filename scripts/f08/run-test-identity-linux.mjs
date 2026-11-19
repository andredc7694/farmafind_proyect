/** F08 identity/inventory browser checks against the isolated F02 FIX-01 database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const state = JSON.parse(readFileSync('.cache/f02-fixture/state.local.json', 'utf8'));
assert.equal(state.kind, 'F02_FIX01_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
for (const url of ['http://127.0.0.1:5173/identity', 'http://127.0.0.1:5173/api/v1/auth/csrf']) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `Servicio TEST no disponible: ${url}`);
}
const envFile = path.join(root, '.cache/f02-e2e/vars.local.env');
const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
  '--env-file', envFile, '-e', 'F08_TEST_API_CONTAINER=1', '-e', 'F08_TEST_SUITE=identity',
  '-v', `${root}:/work`, '-w', '/work', 'mcr.microsoft.com/playwright:v1.65.0-noble',
  'node', 'scripts/f08/run-test-api-container.mjs'], { cwd: root, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
