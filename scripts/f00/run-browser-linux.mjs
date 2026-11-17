import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureFree, launch, stop } from './process-supervisor.mjs';
import { waitForHttp, healthCheck } from './http-checks.mjs';

const root = process.cwd();
const logDir = mkdtempSync(path.join(tmpdir(), 'farmafind f00 linux '));
const active = [];
const services = [
  { id: 'frontend', port: 4173, url: 'http://127.0.0.1:4173/', args: ['node_modules/vite/bin/vite.js', 'preview', 'frontend', '--config', 'frontend/vite.config.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'] },
  { id: 'api', port: 3000, url: 'http://127.0.0.1:3000/health', service: 'farmafind-api', args: ['backend/dist/main.js'] },
  { id: 'notifications', port: 3001, url: 'http://127.0.0.1:3001/health', service: 'farmafind-notifications', args: ['notifications/dist/main.js'] },
];

try {
  for (const service of services) {
    await ensureFree(service.port);
    const args = service.args.map(item => item.includes('/') && !item.startsWith('--') ? path.join(root, item) : item);
    const child = launch({ id: service.id, args, logDir });
    active.push(child);
    await waitForHttp(service.url, child, 60000);
    if (service.service) await healthCheck(service.url, service.service);
  }
  const result = spawnSync('docker', [
    'run', '--rm', '--add-host=host.docker.internal:host-gateway',
    '-e', 'F00_E2E_CONTAINER=1', '-v', `${root}:/work`, '-w', '/work',
    'mcr.microsoft.com/playwright:v1.65.0-noble',
    'node', 'scripts/f00/run-browser-container.mjs',
  ], { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  for (const child of active.reverse()) await stop(child);
  for (const service of services) await ensureFree(service.port);
  if (!logDir.startsWith(path.join(tmpdir(), 'farmafind f00 linux '))) throw new Error('Ruta temporal insegura');
  rmSync(logDir, { recursive: true, force: true });
}
