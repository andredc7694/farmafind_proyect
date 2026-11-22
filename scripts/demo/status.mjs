/** Read-only local DEMO status; prints counts, never credentials or private rows. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
const state = JSON.parse(readFileSync(new URL('../../.cache/manual-demo/state.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'FARMAFIND_MANUAL_DEMO_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
const secret = readFileSync(new URL('../../.cache/f01-docker/postgres-password.txt', import.meta.url), 'utf8').trim();
const url = new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username = 'f01_migrator'; url.password = secret;
const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  const result = await client.query(`SELECT
    (SELECT count(*)::int FROM f02.inventario) AS inventarios,
    (SELECT count(*)::int FROM f02.importacion WHERE estado='CONFIRMADA') AS importaciones,
    (SELECT count(*)::int FROM f04.reserva) AS reservas,
    (SELECT count(*)::int FROM f04.outbox_evento WHERE estado_publicacion='PUBLICADO') AS eventos_publicados,
    (SELECT count(*)::int FROM f05.entrega_local) AS entregas_locales`);
  console.log(JSON.stringify({ entorno: 'TEST/DEMO aislado', ...result.rows[0] }, null, 2));
} finally { await client.end(); }
