/** Reuse the approved F02 Linux E2E suite against the existing isolated FIX-01 TEST services. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const state = JSON.parse(readFileSync('.cache/f02-fixture/state.local.json', 'utf8'));
assert.equal(state.kind, 'F02_FIX01_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
for (const url of ['http://127.0.0.1:5173/inventory', 'http://127.0.0.1:3000/health']) {
  assert.equal((await fetch(url)).status, 200, `Servicio TEST no disponible: ${url}`);
}
const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
  '--env-file', path.join(root, '.cache/f02-e2e/vars.local.env'),
  '--mount', `type=bind,source=${root},target=/work,readonly`, '-w', '/work',
  'mcr.microsoft.com/playwright:v1.65.0-noble', 'node', 'scripts/f02/run-browser-container.mjs'],
{ cwd: root, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
