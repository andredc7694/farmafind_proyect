/** One-time, isolated F04 browser fixture cloned only from fictitious F02 FIX-01. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { migrateF04TestDatabase } from '../../backend/dist/modules/reservas/infrastructure/migrate.js';

const source = JSON.parse(readFileSync('.cache/f02-fixture/state.local.json', 'utf8'));
assert.equal(source.kind, 'F02_FIX01_TEST_ONLY');
assert.match(source.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
const statePath = '.cache/f04-fixture/state.local.json';
assert.equal(existsSync(statePath), false, 'La fixture F04 TEST ya existe; no se sobrescribe');
const secret = readFileSync('.cache/f01-docker/postgres-password.txt', 'utf8').trim();
assert.match(secret, /^[a-f0-9]{64}$/i);
const baseUrl = new URL('postgresql://127.0.0.1:55431/farmafind_f01_test');
baseUrl.username = 'f01_migrator'; baseUrl.password = secret;
const database = `farmafind_f01_test_${randomBytes(6).toString('hex')}`;
const testUrl = new URL(baseUrl); testUrl.pathname = `/${database}`;
const connect = async url => { const client = new Client({ connectionString: url }); await client.connect(); return client; };
const base = await connect(baseUrl.toString());
let test;
try {
  const active = await base.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1', [source.database]);
  assert.equal(active.rows[0].count, 0, 'La base F02 TEST está en uso; no se clona');
  const sourcePresent = await base.query('SELECT 1 FROM pg_database WHERE datname=$1', [source.database]);
  assert.equal(sourcePresent.rows.length, 1, 'Falta la base F02 TEST');
  await base.query(`CREATE DATABASE "${database}" TEMPLATE "${source.database}"`);
  await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F04 browser TEST efimera'`);
  const applied = await migrateF04TestDatabase(testUrl.toString(), connect);
  assert.equal(applied.length, 4, 'Migraciones F04 incompletas en nueva base TEST');
  test = await connect(testUrl.toString());
  const membership = await test.query(`SELECT id FROM f01.usuario_farmacia
    WHERE usuario_id=$1 AND farmacia_id=$2 AND estado='ACTIVA'`, [source.users.ownerA.id, source.pharmacies.alfa]);
  assert.equal(membership.rows.length, 1, 'Membresía ficticia Alfa ausente');
  for (const capability of ['reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings']) {
    await test.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
      VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [membership.rows[0].id, source.pharmacies.alfa, capability, source.users.ownerA.id]);
  }
  const stock = await test.query(`SELECT medicamento_id FROM f02.inventario
    WHERE farmacia_id=$1 AND cantidad_fisica-cantidad_comprometida>=2
    ORDER BY medicamento_id LIMIT 1`, [source.pharmacies.alfa]);
  assert.equal(stock.rows.length, 1, 'Fixture F02 TEST sin stock ficticio disponible');
  const authUrl = new URL(source.authUrl); authUrl.pathname = `/${database}`;
  const runtimeUrl = new URL(source.runtimeUrl); runtimeUrl.pathname = `/${database}`;
  for (const url of [authUrl, runtimeUrl]) {
    assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431');
    assert.equal(url.pathname, `/${database}`);
  }
  mkdirSync('.cache/f04-fixture', { recursive: true });
  writeFileSync(statePath, JSON.stringify({ kind: 'F04_TEST_ONLY', database,
    authUrl: authUrl.toString(), runtimeUrl: runtimeUrl.toString(),
    csrfKey: source.csrfKey, abuseKey: source.abuseKey,
    pharmacyId: source.pharmacies.alfa, betaId: source.pharmacies.beta,
    medicationId: stock.rows[0].medicamento_id }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`F04 browser TEST preparada: ${database}; cuatro migraciones F04 y stock ficticio. Base persistente no modificada.`);
} finally {
  if (test) await test.end();
  await base.end();
}
