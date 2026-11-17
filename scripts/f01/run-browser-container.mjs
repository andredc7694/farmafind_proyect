import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { resolve } from 'node:path';

assert.equal(process.platform, 'linux', 'F01: ejecutar solo dentro de Linux compatible');
assert.equal(process.env.F01_E2E_CONTAINER, '1', 'F01: contenedor de prueba explícito requerido');
for (const key of ['F01_DEMO_MULTI_EMAIL', 'F01_DEMO_MULTI_PASSWORD', 'F01_DEMO_ALFA_EMAIL',
  'F01_DEMO_ALFA_PASSWORD', 'F01_DEMO_BETA_ID']) assert(process.env[key], `F01: falta ${key}`);

const servers = [];
async function bridge(port) {
  const server = createServer(browser => {
    const host = connect({ host: 'host.docker.internal', port });
    browser.on('error', () => host.destroy());
    host.on('error', () => browser.destroy());
    browser.pipe(host); host.pipe(browser);
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
  servers.push(server);
}

try {
  await bridge(3000); await bridge(5173);
  const child = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test',
    'frontend/tests/identity/f01.spec.js', '--output=/tmp/f01-playwright-results'],
  { cwd: '/work', env: process.env, stdio: 'inherit' });
  process.exitCode = await new Promise((ok, fail) => { child.once('error', fail); child.once('exit', code => ok(code ?? 1)); });
} finally {
  await Promise.all(servers.map(server => new Promise(close => server.close(close))));
}
