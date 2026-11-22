import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

assert.equal(process.platform, 'linux', 'F08: Playwright exige Linux compatible');
assert.equal(process.env.F08_E2E_CONTAINER, '1', 'F08: contenedor TEST explícito requerido');
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
  for (const port of [4173, 3000, 3001]) await bridge(port);
  const child = spawn('xvfb-run', ['-a', process.execPath, resolve('node_modules/@playwright/test/cli.js'), 'test',
    'frontend/tests/f08/journeys.spec.js', 'frontend/tests/f08/a11y.spec.js',
    'frontend/tests/f08/zoom.spec.js', '--headed',
    '--output=/tmp/f08-playwright-results'], { cwd: '/work', env: process.env, stdio: 'inherit' });
  process.exitCode = await new Promise((accept, reject) => {
    child.once('error', reject); child.once('exit', code => accept(code ?? 1));
  });
  console.log(`F08 Chromium Linux: ${chromium.executablePath()}`);
} finally {
  await Promise.all(servers.map(server => new Promise(done => server.close(done))));
}
