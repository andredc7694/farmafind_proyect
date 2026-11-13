/** Reproducible local F02 tests; credentials stay in ignored .cache and child env. */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mode = process.argv[2];
if (!['unit','rls'].includes(mode)) throw new Error('Uso: node scripts/f02/check.mjs unit|rls');
const files = mode === 'unit' ? [
  'backend/tests/inventory/authorization.test.ts',
  'backend/tests/inventory/catalog-domain.test.ts',
  'backend/tests/inventory/inventory-domain.test.ts',
  'backend/tests/inventory/import-preview.test.ts',
  'backend/tests/inventory/import-confirm.test.ts',
] : ['backend/tests/inventory/rls-foundation.test.ts'];
const env = { ...process.env };
if (mode === 'rls') {
  const secret = readFileSync(path.join(root, '.cache/f01-docker/postgres-password.txt'), 'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('Secreto PostgreSQL local inválido');
  env.F01_TEST_DATABASE_URL = `postgresql://f01_migrator:${secret}@127.0.0.1:55431/farmafind_f01_test`;
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs','run',...files],
  { cwd: root, env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
