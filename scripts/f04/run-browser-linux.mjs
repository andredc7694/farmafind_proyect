import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureFree, launch, stop } from '../f00/process-supervisor.mjs';
import { waitForHttp } from '../f00/http-checks.mjs';

const image = 'mcr.microsoft.com/playwright:v1.65.0-noble';
const workspace = process.cwd();
const logDir = mkdtempSync(path.join(tmpdir(), 'farmafind f04 browser '));
let frontend;
try {
  await ensureFree(5173);
  frontend = launch({ id: 'f04-web', args: [path.join(workspace, 'node_modules/vite/bin/vite.js'), 'frontend', '--config',
    'frontend/vite.config.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], logDir });
  await waitForHttp('http://127.0.0.1:5173/reservations', frontend, 60000);
  const result = spawnSync('docker', [
    'run', '--rm', '--add-host=host.docker.internal:host-gateway', '-e', 'F04_E2E_CONTAINER=1',
    '-v', `${workspace}:/work`, '-w', '/work', image, 'node', 'scripts/f04/run-browser-container.mjs',
  ], { stdio: 'inherit', shell: false });
  if (result.error) throw new Error(`No se pudo iniciar Docker: ${result.error.message}`);
  process.exitCode = result.status ?? 1;
} finally {
  await stop(frontend);
  await ensureFree(5173);
  if (!logDir.startsWith(path.join(tmpdir(), 'farmafind f04 browser '))) throw new Error('Ruta temporal F04 insegura');
  rmSync(logDir, { recursive: true, force: true });
}
