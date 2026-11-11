import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
for (const workspace of ['backend', 'notifications']) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, workspace, 'tsconfig.json')], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', path.join(root, 'frontend/vite.config.js')], { cwd: path.join(root, 'frontend'), stdio: 'inherit' });
process.exit(result.status ?? 1);
