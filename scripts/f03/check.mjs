/** Reproducible F03 tests. Private local credentials remain in ignored .cache. */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mode = process.argv[2];
if (!['unit','integration','rls'].includes(mode)) throw new Error('Uso: node scripts/f03/check.mjs unit|integration|rls');
const files = mode === 'unit' ? [
  'backend/tests/search/search-config.test.ts','backend/tests/search/search-domain.test.ts',
  'backend/tests/search/cache-aside.test.ts','backend/tests/search/search.http.test.ts',
  'backend/tests/search/invalidation.integration.test.ts','backend/tests/search/migrations.rls.test.ts',
  'backend/tests/search/public-contract.test.ts','backend/tests/search/public-offer.test.ts',
  'backend/tests/search/distance.test.ts','backend/tests/search/public-security.http.test.ts',
  'frontend/tests/search/public-search.test.jsx','frontend/tests/search/comparison.test.jsx',
] : mode === 'integration' ? ['backend/tests/search/redis.integration.test.ts']
  : ['backend/tests/search/public-projection.rls.test.ts'];
const env = { ...process.env };
if (mode === 'rls') {
  const secret = readFileSync(path.join(root,'.cache/f01-docker/postgres-password.txt'),'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('Secreto PostgreSQL local inválido');
  env.F01_TEST_DATABASE_URL = `postgresql://f01_migrator:${secret}@127.0.0.1:55431/farmafind_f01_test`;
}
if (mode === 'integration') {
  const secret = readFileSync(path.join(root,'.cache/f03-docker/redis-password.txt'),'utf8').trim();
  if (secret.length < 32) throw new Error('Secreto Redis local inválido');
  env.SEARCH_REDIS_URL = `redis://:${encodeURIComponent(secret)}@127.0.0.1:56379`;
}
const result = spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...files],{ cwd: root,env,stdio:'inherit' });
process.exitCode = result.status ?? 1;
