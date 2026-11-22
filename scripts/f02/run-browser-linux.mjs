import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureFree, launch, stop } from '../f00/process-supervisor.mjs';
import { waitForHttp } from '../f00/http-checks.mjs';

const root = process.cwd(), logDir = mkdtempSync(path.join(tmpdir(), 'farmafind f02 browser ')), active = [];
try {
  for (const command of [['scripts/f02/prepare-browser-env.mjs'], ['scripts/f02/smoke.mjs']]) {
    const result = spawnSync(process.execPath, command, { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  const services = [
    { id: 'f02-api', port: 3000, url: 'http://127.0.0.1:3000/health', args: ['scripts/f02/start.mjs'] },
    { id: 'f02-web', port: 5173, url: 'http://127.0.0.1:5173/inventory', args: ['node_modules/vite/bin/vite.js', 'frontend', '--config', 'frontend/vite.config.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'] },
  ];
  for (const service of services) {
    await ensureFree(service.port);
    const child = launch({ id: service.id, args: service.args.map(value => value.includes('/') ? path.join(root, value) : value), logDir });
    active.push(child); await waitForHttp(service.url, child, 60000);
  }
  const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
    '--env-file', path.join(root, '.cache/f02-e2e/vars.local.env'),
    '--mount', `type=bind,source=${root},target=/work,readonly`, '-w', '/work',
    'mcr.microsoft.com/playwright:v1.65.0-noble', 'node', 'scripts/f02/run-browser-container.mjs'],
  { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error; process.exitCode = result.status ?? 1;
} finally {
  for (const child of active.reverse()) await stop(child);
  for (const port of [3000, 5173]) await ensureFree(port);
  if (!logDir.startsWith(path.join(tmpdir(), 'farmafind f02 browser '))) throw new Error('Ruta temporal F02 insegura');
  rmSync(logDir, { recursive: true, force: true });
}
