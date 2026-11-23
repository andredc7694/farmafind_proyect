/** Browser-only Linux container: no repository, cache, credentials file or database mount. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';

assert.equal(process.platform, 'linux');
assert.equal(process.env.F02_E2E_CONTAINER, '1');
for (const key of ['F02_DEMO_OWNER_EMAIL', 'F02_DEMO_OWNER_PASSWORD']) {
  assert(process.env[key], `F02.1: falta ${key} TEST`);
}
const servers = [];
async function bridge(port) {
  const server = createServer(browser => {
    const host = connect({ host: 'host.docker.internal', port });
    browser.on('error', () => host.destroy());
    host.on('error', () => browser.destroy());
    browser.pipe(host); host.pipe(browser);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  servers.push(server);
}
try {
  await bridge(3000); await bridge(5173);
  const child = spawn(process.execPath, [
    'node_modules/@playwright/test/cli.js', 'test', 'frontend/e2e/f021-import.spec.js',
    '--output=/tmp/f021-playwright-results', '--workers=1',
  ], { cwd: '/work', env: process.env, stdio: 'inherit' });
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
} finally {
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
}
