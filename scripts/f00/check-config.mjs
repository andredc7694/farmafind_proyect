import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', 'tests/bootstrap/configuration.test.mjs', 'tests/bootstrap/configuration-security.test.mjs'], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
