import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { resolve } from 'node:path';

assert.equal(process.platform, 'linux', 'F08: Playwright exige Linux compatible');
assert.equal(process.env.F08_TEST_API_CONTAINER, '1', 'F08: API TEST explícita requerida');
const suite = process.env.F08_TEST_SUITE === 'identity'
  ? 'frontend/tests/f08/protected-integration.spec.js'
  : process.env.F08_TEST_SUITE === 'reservations'
    ? 'frontend/tests/reservations/f04.spec.js'
    : process.env.F08_TEST_SUITE === 'reservations-real'
      ? 'frontend/tests/f08/reservations-integration.spec.js' : 'frontend/tests/f08/public-integration.spec.js';
const servers = [];
async function bridge(port) {
  const server = createServer(browser => {
    const host = connect({ host: 'host.docker.internal', port });
    browser.on('error', () => host.destroy()); host.on('error', () => browser.destroy());
    browser.pipe(host); host.pipe(browser);
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', accept); });
  servers.push(server);
}
try {
  await bridge(3000); await bridge(5173);
  const child = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test',
    suite, '--output=/tmp/f08-test-api-results'],
  { cwd: '/work', env: process.env, stdio: 'inherit' });
  process.exitCode = await new Promise((accept, reject) => {
    child.once('error', reject); child.once('exit', code => accept(code ?? 1));
  });
} finally {
  await Promise.all(servers.map(server => new Promise(done => server.close(done))));
}
