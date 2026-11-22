/** Run the full local suite without giving generic tests a database URL. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const localSecret = (relative, label) => {
  let secret;
  try { secret = readFileSync(path.join(root, relative), 'utf8').trim(); }
  catch { throw new Error(`test:base: falta la credencial ${label} local ignorada por Git; prepara el servicio TEST correspondiente.`); }
  if (!/^[a-f0-9]{64}$/iu.test(secret)) throw new Error(`test:base: credencial ${label} TEST inválida.`);
};
const reachable = (port, label) => new Promise((resolve, reject) => {
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.setTimeout(1500);
  socket.once('connect', () => { socket.destroy(); resolve(); });
  const fail = () => { socket.destroy(); reject(new Error(`test:base: ${label} TEST no disponible en 127.0.0.1:${port}. Inicia el Compose local aprobado.`)); };
  socket.once('error', fail);
  socket.once('timeout', fail);
});
const run = (label, args, env) => {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`test:base: ${label} falló (${result.status ?? 'sin código de salida'}).`);
};

try {
  localSecret('.cache/f01-docker/postgres-password.txt', 'PostgreSQL');
  localSecret('.cache/f03-docker/redis-password.txt', 'Redis');
  await reachable(55431, 'PostgreSQL');
  await reachable(56379, 'Redis');
  const env = { ...process.env };
  // A generic suite must never inherit a caller's persistent or remote database URL.
  for (const key of ['F01_TEST_DATABASE_URL', 'F07_TEST_DATABASE_URL', 'F07_RUNTIME_DATABASE_URL', 'SEARCH_REDIS_URL']) delete env[key];
  const integration = [
    'backend/tests/assistant/conversation-isolation.integration.test.ts',
    'backend/tests/assistant/conversation-f03-fallback.integration.test.ts',
  ];
  run('suites generales', ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1',
    ...integration.flatMap(file => ['--exclude', file])], env);
  // This runner creates a fresh isolated database per suite, then removes only its own fixture.
  run('integración F06.1 en bases efímeras', ['scripts/f061/check.mjs', 'integration'], env);
  console.log('test:base: suites generales e integración F06.1 satisfactorias.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
