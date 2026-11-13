/** F02 TEST/DEMO only: bridge Linux Playwright to Windows loopback services. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { resolve } from 'node:path';

assert.equal(process.platform, 'linux', 'F02: ejecutar solo dentro de Linux compatible');
assert.equal(process.env.F02_E2E_CONTAINER, '1', 'F02: contenedor de prueba explícito requerido');
for (const key of ['F02_DEMO_OWNER_EMAIL', 'F02_DEMO_OWNER_PASSWORD', 'F02_DEMO_BETA_ID']) {
  assert(process.env[key], `F02: falta ${key} del fixture ficticio local`);
}

const servers = [];
async function bridge(port) {
  const server = createServer(browserSocket => {
    const hostSocket = connect({ host: 'host.docker.internal', port });
    browserSocket.on('error', () => hostSocket.destroy());
    hostSocket.on('error', () => browserSocket.destroy());
    browserSocket.pipe(hostSocket);
    hostSocket.pipe(browserSocket);
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  servers.push(server);
}

try {
  await bridge(3000);
  await bridge(5173);
  const args = [resolve('node_modules/@playwright/test/cli.js'), 'test',
    'frontend/tests/inventory/f02.spec.js', '--output=/tmp/f02-playwright-results'];
  const child = spawn(process.execPath, args, {
    cwd: '/work', env: process.env, stdio: 'inherit',
  });
  process.exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('exit', code => resolveExit(code ?? 1));
  });
} finally {
  await Promise.all(servers.map(server => new Promise(resolveClose => server.close(resolveClose))));
}
