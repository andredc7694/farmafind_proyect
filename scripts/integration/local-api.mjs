/** Compose the approved F01–F04 and F06 routes against the isolated F03 TEST fixture. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';
import { loadSearchConfig } from '../../backend/dist/config/search.js';
import { loadReservationConfig } from '../../backend/dist/config/reservations.js';
import { migrateF04TestDatabase } from '../../backend/dist/modules/reservas/infrastructure/migrate.js';

const state = JSON.parse(readFileSync(new URL('../../.cache/f03-fixture/state.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'F03_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
for (const value of [state.authUrl, state.runtimeUrl]) {
  const url = new URL(value);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55431');
  assert.equal(url.pathname, `/${state.database}`);
}
const mode = process.argv[2];
if (mode === 'prepare') {
  // The approved migrator itself rejects remote and persistent databases.
  const secret = readFileSync(new URL('../../.cache/f01-docker/postgres-password.txt', import.meta.url), 'utf8').trim();
  assert.match(secret, /^[a-f0-9]{64}$/i);
  const migratorUrl = new URL(state.runtimeUrl);
  migratorUrl.username = 'f01_migrator';
  migratorUrl.password = secret;
  const applied = await migrateF04TestDatabase(migratorUrl.toString(), async url => {
    const client = new Client({ connectionString: url });
    await client.connect();
    return client;
  });
  console.log(`Base TEST aislada preparada para reservas: ${applied.length} migraciones F04 aplicadas.`);
} else if (mode === 'start') {
  const preflight = new Pool({ connectionString: state.runtimeUrl, max: 1 });
  try {
    const tables = await preflight.query(`SELECT n.nspname AS schema, c.relname AS table_name,
      c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE (n.nspname,c.relname) IN (('f01','usuario_farmacia'),('f02','inventario'),
        ('f03','farmacia_publica'),('f04','reserva'))`);
    assert.equal(tables.rows.length, 4, 'Faltan migraciones F01–F04 en la base TEST');
    assert(tables.rows.every(row => row.enabled && row.forced), 'RLS/FORCE RLS incompleto en base TEST');
  } finally { await preflight.end(); }
  const origin = 'http://127.0.0.1:5173';
  const identity = validateLocalIdentityRuntime({ APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
    F01_AUTH_DATABASE_URL: state.authUrl, F01_DATABASE_URL: state.runtimeUrl,
    F01_CSRF_KEY_HEX: state.csrfKey, F01_ABUSE_KEY_HEX: state.abuseKey,
    F01_ALLOWED_ORIGIN: origin, F01_CSRF_TRUSTED_ORIGIN: origin,
    F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true' });
  const search = loadSearchConfig({ SEARCH_REDIS_URL: state.redisUrl,
    SEARCH_CACHE_TTL_SECONDS: '60', SEARCH_CACHE_TIMEOUT_MS: '150', SEARCH_CANDIDATE_LIMIT: '200' });
  const reservations = loadReservationConfig({ RESERVATION_PENDING_MINUTES: '20', RESERVATION_EXPIRATION_BATCH_SIZE: '100' });
  const composed = await createLocalIdentityApp({ ...identity, search, reservations },
    url => new Pool({ connectionString: url, max: 6 }));
  // Integration tests may use another loopback port while the user's F00 process is running.
  const port = process.env.FARMAFIND_LOCAL_API_PORT === undefined ? 3000 : Number(process.env.FARMAFIND_LOCAL_API_PORT);
  assert(Number.isInteger(port) && port >= 1024 && port <= 65535, 'Puerto local inválido');
  const server = composed.app.listen(port, '127.0.0.1');
  server.once('listening', () => console.log(`API integrada TEST: http://127.0.0.1:${port}/health`));
  let closing = false;
  const stop = () => { if (closing) return; closing = true; server.close(() => void composed.close()); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.on('error', async error => { console.error(`No se pudo iniciar API TEST: ${error.code || 'error'}`); await composed.close(); process.exitCode = 1; });
} else {
  throw new Error('Uso: node scripts/integration/local-api.mjs prepare|start');
}
