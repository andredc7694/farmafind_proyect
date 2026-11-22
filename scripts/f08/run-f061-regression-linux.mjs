/** Reuse F06.1 Linux E2E with its in-memory TEST harness; no provider or database. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
for (const url of ['http://127.0.0.1:5173/assistant/conversation', 'http://127.0.0.1:3000/health']) {
  assert.equal((await fetch(url)).status, 200, `Servicio TEST no disponible: ${url}`);
}
const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
  '-e', 'F061_E2E_CONTAINER=1', '--mount', `type=bind,source=${root},target=/work,readonly`,
  '-w', '/work', 'mcr.microsoft.com/playwright:v1.65.0-noble',
  'node', 'scripts/f061/run-browser-container.mjs'], { cwd: root, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
