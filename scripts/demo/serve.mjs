/** One F01–F07 API against the isolated writable manual DEMO database. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';
import { loadSearchConfig } from '../../backend/dist/config/search.js';
import { loadReservationConfig } from '../../backend/dist/config/reservations.js';

const state = JSON.parse(readFileSync(new URL('../../.cache/manual-demo/state.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'FARMAFIND_MANUAL_DEMO_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
for (const value of [state.roles.auth, state.roles.runtime]) {
  const url = new URL(value);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431');
  assert.equal(url.pathname, `/${state.database}`);
}
const preflight = new Pool({ connectionString: state.roles.runtime, max: 1 });
try {
  const result = await preflight.query(`SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE (n.nspname,c.relname) IN (('f01','usuario_farmacia'),('f02','inventario'),
      ('f03','farmacia_publica'),('f04','reserva'),('f05','entrega_local'))`);
  assert.equal(result.rows.length, 5);
  assert(result.rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
} finally { await preflight.end(); }
const origin = 'http://127.0.0.1:5173';
const identity = validateLocalIdentityRuntime({ APP_MODE: 'identity', HOST: '127.0.0.1', PORT: '3000',
  F01_AUTH_DATABASE_URL: state.roles.auth, F01_DATABASE_URL: state.roles.runtime,
  F01_CSRF_KEY_HEX: state.csrfKey, F01_ABUSE_KEY_HEX: state.abuseKey,
  F01_ALLOWED_ORIGIN: origin, F01_CSRF_TRUSTED_ORIGIN: origin,
  F01_COOKIE_SECURE: 'false', F01_ALLOW_HTTP_LOOPBACK: 'true' });
const search = loadSearchConfig({ SEARCH_REDIS_URL: state.redisUrl,
  SEARCH_CACHE_TTL_SECONDS: '60', SEARCH_CACHE_TIMEOUT_MS: '150', SEARCH_CANDIDATE_LIMIT: '200' });
const reservations = loadReservationConfig({ RESERVATION_PENDING_MINUTES: '20',
  RESERVATION_EXPIRATION_BATCH_SIZE: '100' });
// An external model is not selected for the manual DEMO.
delete process.env.FARMAFIND_AI_PROVIDER;
const composed = await createLocalIdentityApp({ ...identity, search, reservations, geolocationTest: true },
  url => new Pool({ connectionString: url, max: 6 }));
const server = composed.app.listen(3000, '127.0.0.1',
  () => console.log('FarmaFind DEMO integrada: http://127.0.0.1:3000/health'));
let closing = false;
const stop = () => { if (closing) return; closing = true; server.close(() => void composed.close()); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.on('error', async error => { console.error(`DEMO API: ${error.code || 'error'}`);
  await composed.close(); process.exitCode = 1; });
