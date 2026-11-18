/** Launch only owned TEST processes and the existing official Playwright Linux image. */
import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureFree, launch, stop } from '../f00/process-supervisor.mjs';
import { waitForHttp } from '../f00/http-checks.mjs';

const root = process.cwd();
const logDir = mkdtempSync(path.join(tmpdir(), 'farmafind f061 browser '));
const active = [];
try {
  for (const [id, port, url, args, env] of [
    ['f061-api', 3000, 'http://127.0.0.1:3000/health', ['scripts/f061/browser-api.mjs'], { F061_E2E_LOCAL: '1' }],
    ['f061-web', 5173, 'http://127.0.0.1:5173/assistant',
      ['node_modules/vite/bin/vite.js', 'frontend', '--config', 'frontend/vite.config.js',
        '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {}],
  ]) {
    await ensureFree(port);
    const child = launch({ id, args: args.map(value => value.includes('/') ? path.join(root, value) : value),
      env, logDir });
    active.push(child);
    await waitForHttp(url, child, 60_000);
  }
  const result = spawnSync('docker', ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
    '-e', 'F061_E2E_CONTAINER=1', '--mount', `type=bind,source=${root},target=/work,readonly`,
    '-w', '/work', 'mcr.microsoft.com/playwright:v1.65.0-noble',
    'node', 'scripts/f061/run-browser-container.mjs'], { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  for (const child of active.reverse()) await stop(child);
  for (const port of [3000, 5173]) await ensureFree(port);
  if (path.dirname(path.resolve(logDir)) !== path.resolve(tmpdir()) ||
      !path.basename(logDir).startsWith('farmafind f061 browser ')) {
    throw new Error('Ruta temporal insegura');
  }
  rmSync(logDir, { recursive: true, force: true });
}
