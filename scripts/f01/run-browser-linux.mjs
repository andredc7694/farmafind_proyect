import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureFree, launch, stop } from '../f00/process-supervisor.mjs';
import { waitForHttp } from '../f00/http-checks.mjs';

const root = process.cwd();
const logDir = mkdtempSync(path.join(tmpdir(), 'farmafind f01 browser '));
const active = [];
try {
  const prepared = spawnSync(process.execPath, ['scripts/f01/prepare-browser-env.mjs'], { cwd: root, stdio: 'inherit' });
  if (prepared.status !== 0) process.exit(prepared.status ?? 1);
  const services = [
    { id: 'f01-api', port: 3000, url: 'http://127.0.0.1:3000/health', args: ['scripts/f01/demo.mjs', 'start'] },
    { id: 'f01-web', port: 5173, url: 'http://127.0.0.1:5173/identity', args: ['node_modules/vite/bin/vite.js', 'frontend', '--config', 'frontend/vite.config.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'] },
  ];
  for (const service of services) {
    await ensureFree(service.port);
    const child = launch({ id: service.id, args: service.args.map(value => value.includes('/') ? path.join(root, value) : value), logDir });
    active.push(child);
    await waitForHttp(service.url, child, 60000);
  }
  const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
    '--env-file', path.join(root, '.cache/f01-e2e/vars.local.env'),
    '--mount', `type=bind,source=${root},target=/work,readonly`, '-w', '/work',
    'mcr.microsoft.com/playwright:v1.65.0-noble', 'node', 'scripts/f01/run-browser-container.mjs'],
  { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  for (const child of active.reverse()) await stop(child);
  for (const port of [3000, 5173]) await ensureFree(port);
  const cleanup = spawnSync(process.execPath, ['scripts/f01/demo.mjs', 'cleanup-e2e'], { cwd: root, stdio: 'inherit' });
  if (cleanup.status !== 0) process.exitCode = cleanup.status ?? 1;
  if (!logDir.startsWith(path.join(tmpdir(), 'farmafind f01 browser '))) throw new Error('Ruta temporal F01 insegura');
  rmSync(logDir, { recursive: true, force: true });
}
