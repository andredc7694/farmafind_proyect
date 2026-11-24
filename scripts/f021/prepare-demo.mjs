/** F02.1 DEMO manual: prepara el fixture TEST marcado (Alfa/Beta). Nunca toca farmafind_f01_test. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import path from 'node:path';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';

const root = process.cwd();
const state = JSON.parse(readFileSync(path.join(root, '.cache/f02-fixture/state.local.json'), 'utf8'));
assert.equal(state.kind, 'F02_FIX01_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
const url = new URL(state.authUrl);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55431');
assert.equal(url.pathname, `/${state.database}`);
url.username = 'f01_migrator';
url.password = readFileSync(path.join(root, '.cache/f01-docker/postgres-password.txt'), 'utf8').trim();
const connect = async connection => { const c = new Client({ connectionString: connection }); await c.connect(); return c; };

const client = await connect(url.toString());
try {
  const row = (await client.query(`SELECT current_database() AS db,
    shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()`)).rows[0];
  assert.equal(row.db, state.database);
  assert.equal(row.marker, 'FarmaFind F02 FIX-01 TEST ficticio');
} finally { await client.end(); }

const f02 = await migrateF02TestDatabase(url.toString(), connect);
assert(f02.every(name => name === '005_smart_import.sql'), 'Migración F02 ajena pendiente');
const f03 = await migrateF03TestDatabase(url.toString(), connect);
assert(f03.every(name => /^00[12]_/.test(name)), 'Migración F03 ajena pendiente');

const fixture = await connect(url.toString());
try {
  const catalog = await fixture.query(`SELECT id FROM f02.medicamento
    WHERE nombre='producto ficticio' AND concentracion='10 mg' AND presentacion='tabletas'`);
  assert.equal(catalog.rows.length, 1, 'Catálogo TEST inesperado');
  await fixture.query(`UPDATE f02.medicamento SET principio_activo='producto ficticio' WHERE principio_activo IS NULL`);
  for (const [id, text] of [[state.pharmacies.alfa, 'Dirección ficticia Alfa'], [state.pharmacies.beta, 'Dirección ficticia Beta']]) {
    await fixture.query(`INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto)
      VALUES($1,$2) ON CONFLICT(farmacia_id) DO NOTHING`, [id, text]);
  }
} finally { await fixture.end(); }
console.log(JSON.stringify({ base: state.database, migraciones_f02: f02, migraciones_f03: f03 }));
