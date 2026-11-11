import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserEnvironment } from './browser-environment.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const environment = browserEnvironment();
if (!environment.compatible) {
  console.error('Playwright pendiente: se requiere un Windows oficialmente compatible; no se instala navegador en Windows 10.');
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@playwright/test/cli.js'), 'install', 'chromium'], { cwd: root, stdio: 'inherit', windowsHide: true });
  process.exitCode = result.status ?? 1;
}
