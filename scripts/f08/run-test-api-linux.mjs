/** Public F08 journeys against an already running F07 TEST-only API. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const state = JSON.parse(readFileSync('.cache/f07-fixture/state.local.json', 'utf8'));
assert.equal(state.kind, 'F07_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
for (const url of ['http://127.0.0.1:5173/search',
  'http://127.0.0.1:5173/api/v1/geolocalizacion/farmacias?ciudad=lima']) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `Servicio TEST no disponible: ${url}`);
}
const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
  '-e', 'F08_TEST_API_CONTAINER=1', '-v', `${root}:/work`, '-w', '/work',
  'mcr.microsoft.com/playwright:v1.65.0-noble', 'node', 'scripts/f08/run-test-api-container.mjs'],
{ cwd: root, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
