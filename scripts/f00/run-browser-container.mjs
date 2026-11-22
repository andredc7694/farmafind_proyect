import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

assert.equal(process.platform, 'linux', 'F00: ejecutar solo dentro de Linux compatible');
assert.equal(process.env.F00_E2E_CONTAINER, '1', 'F00: contenedor de prueba explícito requerido');

const servers = [];
async function bridge(port) {
  const server = createServer(browser => {
    const host = connect({ host: 'host.docker.internal', port });
    browser.on('error', () => host.destroy());
    host.on('error', () => browser.destroy());
    browser.pipe(host);
    host.pipe(browser);
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  servers.push(server);
}

try {
  for (const port of [4173, 3000, 3001]) await bridge(port);
  const version = spawnSync(chromium.executablePath(), ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, 'F00: versión Chromium no verificable');
  const child = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test',
    'frontend/tests/bootstrap.spec.js', '--output=/work/test-results'], {
    cwd: '/work', env: process.env, stdio: 'inherit',
  });
  process.exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('exit', code => resolveExit(code ?? 1));
  });
  mkdirSync('/work/test-results', { recursive: true });
  writeFileSync('/work/test-results/browser-version.txt', version.stdout.trim() + '\n');
} finally {
  await Promise.all(servers.map(server => new Promise(resolveClose => server.close(resolveClose))));
}
