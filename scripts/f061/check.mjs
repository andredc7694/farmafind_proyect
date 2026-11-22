/** F06.1 local test runner. No external provider or database is started here. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2] ?? 'unit';
if (!['unit', 'api', 'integration'].includes(mode)) throw new Error('Uso: node scripts/f061/check.mjs unit|api|integration');
const files = ['backend/tests/assistant', 'frontend/tests/assistant']
  .flatMap(directory => readdirSync(directory).filter(name => name.startsWith('conversation') && /\.test\.(ts|jsx)$/.test(name))
    .map(name => join(directory, name)))
  .filter(path => mode === 'api' ? path.includes('.http.test.')
    : mode === 'integration' ? path.includes('.integration.test.')
      : !path.includes('.http.test.') && !path.includes('.integration.test.'));
if (files.length === 0) throw new Error(`No hay pruebas F06.1 del grupo ${mode}; no se declara resultado satisfactorio.`);
const env = { ...process.env };
if (mode === 'integration') {
  if (!env.F061_TEST_BASE_URL || !env.SEARCH_REDIS_URL) {
    throw new Error('F06.1: configurar F061_TEST_BASE_URL y SEARCH_REDIS_URL en entorno TEST aislado');
  }
  const base = new URL(env.F061_TEST_BASE_URL);
  if (base.hostname !== '127.0.0.1' || base.port !== '55431' ||
      base.pathname !== '/farmafind_f061_fixture_test' || base.username !== 'f01_migrator' ||
      !base.password || base.search || base.hash) {
    throw new Error('F06.1: destino PostgreSQL TEST inválido');
  }
  const redis = new URL(env.SEARCH_REDIS_URL);
  if (redis.hostname !== '127.0.0.1' || redis.port !== '56379') {
    throw new Error('F06.1: Redis TEST debe usar loopback y puerto aislado');
  }
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files],
  { stdio: 'inherit', shell: false, env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
