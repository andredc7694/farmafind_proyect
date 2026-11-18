/** F07 checks; database modes fail closed without an isolated local URL. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertF07EphemeralDatabase } from './fixtures.mjs';

const mode = process.argv[2];
const testFiles = {
  static: ['backend/tests/geolocation/migrations.test.ts','backend/tests/geolocation/rls.test.ts'],
  unit: ['backend/tests/geolocation/distance.test.ts','backend/tests/geolocation/public-api.test.ts',
    'backend/tests/geolocation/location-http.test.ts','backend/tests/geolocation/authorization.test.ts'],
  api: ['backend/tests/geolocation/public-api.test.ts','backend/tests/geolocation/public-projection.test.ts',
    'backend/tests/geolocation/location-api.test.ts'],
  ui: ['frontend/tests/geolocation/nearby.test.jsx','frontend/tests/geolocation/map.test.jsx',
    'frontend/tests/geolocation/location-admin.test.jsx'],
  migration: ['backend/tests/geolocation/migrations.test.ts'],
  rls: ['backend/tests/geolocation/rls.test.ts'],
  cache: ['backend/tests/geolocation/cache.test.ts'],
};
if (!Object.hasOwn(testFiles, mode)) throw new Error('Uso: node scripts/f07/check.mjs static|unit|api|ui|migration|rls|cache');
const env = { ...process.env };
if (mode === 'api' || mode === 'migration' || mode === 'rls') {
  const state=JSON.parse(readFileSync(new URL('../../.cache/f07-fixture/state.local.json',import.meta.url),'utf8'));
  if (state.kind !== 'F07_TEST_ONLY') throw new Error('F07: estado TEST local inválido');
  const secret=readFileSync(new URL('../../.cache/f01-docker/postgres-password.txt',import.meta.url),'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('F07: secreto local inválido');
  const url=new URL('postgresql://127.0.0.1:55431/farmafind_f01_test');
  url.username='f01_migrator'; url.password=secret; url.pathname=`/${state.database}`;
  assertF07EphemeralDatabase(url.toString());
  env.F07_TEST_DATABASE_URL=url.toString();
  env.F07_RUNTIME_DATABASE_URL=state.runtimeUrl;
}
if (mode === 'cache') {
  const secret=readFileSync(new URL('../../.cache/f03-docker/redis-password.txt',import.meta.url),'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('F07: secreto Redis local inválido');
  const url=new URL('redis://127.0.0.1:56379/0');url.password=secret;
  env.F07_TEST_REDIS_URL=url.toString();
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...testFiles[mode]], {
  cwd: fileURLToPath(new URL('../../', import.meta.url)), env, stdio: 'inherit', shell: false,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
