/** Create and migrate only the dedicated F02.5 ephemeral TEST database. */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase, migrateF07TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import { migrateF04TestDatabase } from '../../backend/dist/modules/reservas/infrastructure/migrate.js';
import { migrateF05TestDatabase } from '../../backend/dist/modules/notificaciones/infrastructure/migrate.js';
import { migrateF025TestDatabase } from '../../backend/dist/modules/farmacias/infrastructure/migrate-f025.js';
import { assertF025EphemeralDatabase, assertF025ConnectedTarget, F025_CLUSTER_NAME, F025_TEST_MARKER } from './test-env.mjs';
import { localStateName } from './demo-slot.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const local = path.join(root, '.cache/f025-docker');
const stateFile = path.join(local, localStateName('state.local.json'));
const secret = readFileSync(path.join(local, 'postgres-password.txt'), 'utf8').trim();
assert.match(secret, /^[a-f0-9]{64}$/i, 'Secreto TEST local inválido');
const reviewed = Object.freeze({
  '001_applications.sql': '0DC2EDB8326D5BF72558883EB06677D9E02A69FA82F557464157BC2456236C7D',
  '002_platform_permissions.sql': 'FC7427191D8EDC0680FBA2C12D9A8CCC94DE09DF91205BE5EBEA7AEB2590282C',
  '003_rls.sql': '5B467815BAD93D298B1FF82EB474C89AB0EFEAB1F000EFC21AD00A8507CEBAFC',
  '004_activation.sql': '090C26AD66FFA70A1F0E15F40D24AAD8D72C1A1A8E2A5692569234C848ED6004',
  '005_outbox.sql': '5EA8CCA911F2C47DC794AF63CFE09A01A1DD42298DCC3679BC95F9CE5392C32A',
});
const files = Object.entries(reviewed).map(([name, expected]) => {
  const sql = readFileSync(path.join(root, 'backend/migrations/f025', name), 'utf8');
  // Solo la comparación normaliza CRLF→LF (checkout de Windows); el SQL ejecutado no se modifica.
  assert.equal(createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex').toUpperCase(), expected, `${name}: cambió desde la revisión humana`);
  return { name, sql };
});
function url(database) {
  const value = new URL(`postgresql://127.0.0.1:55431/${database}`);
  value.username = 'f01_migrator';
  value.password = secret;
  return value.toString();
}
async function connect(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}
const admin = await connect(url('farmafind_f025_cluster'));
let database;
try {
  const identity = (await admin.query("SELECT current_database() AS database, current_user AS role, current_setting('cluster_name') AS cluster")).rows[0];
  assert.deepEqual(identity, { database: 'farmafind_f025_cluster', role: 'f01_migrator', cluster: F025_CLUSTER_NAME });
  if (existsSync(stateFile)) {
    database = JSON.parse(readFileSync(stateFile, 'utf8')).database;
    assertF025EphemeralDatabase(url(database), { migration: true });
    const row = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rows[0];
    assert.ok(row, 'Base TEST registrada pero ausente; no crear otra automáticamente');
  } else {
    database = `farmafind_f01_test_${randomBytes(6).toString('hex')}`;
    assertF025EphemeralDatabase(url(database), { migration: true });
    await admin.query(`CREATE DATABASE "${database}"`);
    writeFileSync(stateFile, JSON.stringify({ database }, null, 2), { flag: 'wx', mode: 0o600 });
  }
  await admin.query(`COMMENT ON DATABASE "${database}" IS '${F025_TEST_MARKER}'`);
} finally {
  await admin.end();
}

const target = url(database);
const check = await connect(target);
try {
  await assertF025ConnectedTarget(check, database);
} finally {
  await check.end();
}
const baseline = [];
baseline.push(['F01', await migrateTestDatabase(target, connect)]);
baseline.push(['F02', await migrateF02TestDatabase(target, connect)]);
baseline.push(['F03', await migrateF03TestDatabase(target, connect)]);
baseline.push(['F04', await migrateF04TestDatabase(target, connect)]);
baseline.push(['F05', await migrateF05TestDatabase(target, connect)]);
baseline.push(['F07', await migrateF07TestDatabase(target, connect)]);

// Apply the reviewed F02.5 package through the guarded, reusable migration adapter.
const guardedApplied = await migrateF025TestDatabase(target, connect);

const client = await connect(target);
try {
  await assertF025ConnectedTarget(client, database);
  await client.query('BEGIN');
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS f025');
    await client.query(`CREATE TABLE IF NOT EXISTS f025.schema_migrations
      (filename text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const known = new Map((await client.query('SELECT filename,sha256 FROM f025.schema_migrations')).rows
      .map(row => [row.filename, row.sha256]));
    const applied = [];
    for (const { name, sql } of files) {
      const hash = reviewed[name];
      if (known.has(name)) {
        assert.equal(known.get(name), hash, `${name}: hash de migración aplicada no coincide`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO f025.schema_migrations(filename,sha256) VALUES($1,$2)', [name, hash]);
      applied.push(name);
    }
    await client.query('COMMIT');
    const role = (await client.query(`SELECT rolname,rolcanlogin,rolsuper,rolbypassrls FROM pg_roles
      WHERE rolname IN ('f01_runtime','f025_policy','f025_activation_executor') ORDER BY rolname`)).rows;
    assert.equal(role.length, 3);
    assert.ok(role.every(row => !row.rolcanlogin && !row.rolsuper && !row.rolbypassrls));
    console.log(JSON.stringify({ database, cluster: F025_CLUSTER_NAME,
      baseline: baseline.map(([name, result]) => ({ name, result })), f025Applied: [...guardedApplied,...applied], f025Roles: role }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
} finally {
  await client.end();
}
