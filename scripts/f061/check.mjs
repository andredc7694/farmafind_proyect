/** F06.1 local test runner. No external provider or database is started here. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
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
  const postgresSecret = readFileSync('.cache/f01-docker/postgres-password.txt', 'utf8').trim();
  const redisSecret = readFileSync('.cache/f03-docker/redis-password.txt', 'utf8').trim();
  if (!/^[a-f0-9]{64}$/iu.test(postgresSecret) || !/^[a-f0-9]{64}$/iu.test(redisSecret)) {
    throw new Error('Credenciales TEST locales inválidas');
  }
  env.F01_TEST_DATABASE_URL = `postgresql://f01_migrator:${postgresSecret}@127.0.0.1:55431/farmafind_f01_test`;
  env.SEARCH_REDIS_URL = `redis://:${redisSecret}@127.0.0.1:56379`;
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files],
  { stdio: 'inherit', shell: false, env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
