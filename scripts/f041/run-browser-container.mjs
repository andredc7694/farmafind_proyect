/** Contenedor Linux solo para el navegador: sin repositorio, sin .cache salvo la bandeja de correo simulada (solo lectura). */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';

assert.equal(process.platform, 'linux');
assert.equal(process.env.F041_E2E_CONTAINER, '1');
for (const key of ['F041_OWNER_EMAIL', 'F041_OWNER_PASSWORD', 'F041_CLIENT_EMAIL', 'F041_CLIENT_PASSWORD', 'F041_ALFA_ID']) {
  assert(process.env[key], `F04.1: falta ${key} TEST`);
}
const servers = [];
async function bridge(port) {
  const server = createServer(browser => {
    const host = connect({ host: 'host.docker.internal', port });
    browser.on('error', () => host.destroy());
    host.on('error', () => browser.destroy());
    browser.pipe(host); host.pipe(browser);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  servers.push(server);
}
try {
  await bridge(3000); await bridge(5173);
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'frontend/e2e/f041-reservations.spec.js',
    '--output=/results', '--workers=1'], { cwd: '/work', env: process.env, stdio: 'inherit' });
  process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
} finally {
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
}
