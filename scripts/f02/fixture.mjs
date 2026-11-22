/** FIX-01: create a new isolated F02 TEST database; never write F01 persistent rows. */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { Argon2PasswordHasher } from '../../backend/dist/modules/usuarios/infrastructure/argon2-password.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const privateDir = path.join(root, '.cache/f02-fixture');
const stateFile = path.join(privateDir, 'state.local.json');
const secretFile = path.join(root, '.cache/f01-docker/postgres-password.txt');
const hex = size => randomBytes(size).toString('hex');

function urlFor(database = 'farmafind_f01_test') {
  const secret = readFileSync(secretFile, 'utf8').trim();
  assert.match(secret, /^[a-f0-9]{64}$/i);
  const url = new URL('postgresql://127.0.0.1:55431/farmafind_f01_test');
  url.username = 'f01_migrator';
  url.password = secret;
  url.pathname = `/${database}`;
  return url.toString();
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function baseCounts(client) {
  return (await client.query(`SELECT
    (SELECT count(*)::int FROM f01.usuario) AS users,
    (SELECT count(*)::int FROM f01.sesion) AS sessions,
    (SELECT count(*)::int FROM f01.farmacia_referencia) AS pharmacies,
    (SELECT count(*)::int FROM f01.usuario_farmacia) AS memberships`)).rows[0];
}

async function prepare() {
  assert.equal(existsSync(stateFile), false, 'El fixture F02 ya existe; no se sobrescribe');
  const base = await connect(urlFor());
  let demo;
  try {
    const identity = (await base.query('SELECT current_database() AS db,current_user AS role')).rows[0];
    assert.deepEqual(identity, { db: 'farmafind_f01_test', role: 'f01_migrator' });
    const before = await baseCounts(base);
    const suffix = hex(6);
    const database = `farmafind_f01_test_${suffix}`;
    const authRole = `f02_fixture_auth_${suffix}`;
    const authPassword = hex(32);
    const runtimeRole = `f02_fixture_runtime_${suffix}`;
    const runtimePassword = hex(32);
    await base.query(`CREATE DATABASE "${database}"`);
    await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F02 FIX-01 TEST ficticio'`);
    await migrateTestDatabase(urlFor(database), connect);
    await migrateF02TestDatabase(urlFor(database), connect);
    await base.query(`CREATE ROLE "${authRole}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${authPassword}'`);
    await base.query(`GRANT f01_auth TO "${authRole}"`);
    await base.query(`CREATE ROLE "${runtimeRole}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${runtimePassword}'`);
    await base.query(`GRANT f01_runtime TO "${runtimeRole}"`);
    demo = await connect(urlFor(database));
    const hasher = new Argon2PasswordHasher();
    const users = {};
    const pharmacies = {};
    await demo.query('BEGIN');
    try {
      for (const label of ['ownerA', 'ownerB', 'workerA']) {
        const email = `f02-${label.toLowerCase()}-${suffix}@example.test`;
        const password = `${hex(24)}Aa1!`;
        const hash = await hasher.hash(password);
        const user = (await demo.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2) RETURNING id', [email, hash])).rows[0];
        const secret = hex(32);
        await demo.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
          VALUES($1,$2,now()+interval '1 hour',now()+interval '4 hours')`,
        [user.id, createHash('sha256').update(Buffer.from(secret, 'hex')).digest()]);
        users[label] = { id: user.id, email, password, sessionSecret: secret };
      }
      for (const [label, name] of [['alfa', 'Farmacia Alfa'], ['beta', 'Farmacia Beta']]) {
        pharmacies[label] = (await demo.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id', [name])).rows[0].id;
      }
      for (const [user, pharmacy, role] of [['ownerA','alfa','DUENO'],['ownerB','beta','DUENO'],['workerA','alfa','TRABAJADOR']]) {
        const membership = (await demo.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
          VALUES($1,$2,$3) RETURNING id`, [users[user].id, pharmacies[pharmacy], role])).rows[0];
        if (role === 'DUENO') {
          for (const capability of ['inventory.read','inventory.write','inventory.import.preview','inventory.import.confirm','inventory.history']) {
            await demo.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
              VALUES($1,$2,$3,$4)`, [membership.id, pharmacies[pharmacy], capability, users[user].id]);
          }
        }
      }
      for (const [name, concentration, presentation, classification] of [
        ['producto ficticio','10 mg','tabletas','venta libre'],
        ['producto ficticio','10 mg','jarabe','venta libre'],
      ]) {
        await demo.query(`INSERT INTO f02.medicamento(nombre,concentracion,presentacion,clasificacion)
          VALUES($1,$2,$3,$4)`, [name, concentration, presentation, classification]);
      }
      await demo.query('COMMIT');
    } catch (error) { await demo.query('ROLLBACK'); throw error; }
    const runtimeUrl = new URL(urlFor(database));
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = runtimePassword;
    const authUrl = new URL(urlFor(database));
    authUrl.username = authRole; authUrl.password = authPassword;
    const value = { kind: 'F02_FIX01_TEST_ONLY', database, runtimeUrl: runtimeUrl.toString(),
      authUrl: authUrl.toString(), csrfKey: hex(32), abuseKey: hex(32),
      users, pharmacies, baseBefore: before, createdAt: new Date().toISOString() };
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(stateFile, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    assert.deepEqual(await baseCounts(base), before, 'La base F01 persistente cambió');
    console.log('Fixture F02 aislado preparado: 2 farmacias, 3 usuarios ficticios y 2 referencias.');
    console.log('Credenciales solo en .cache/f02-fixture/state.local.json (ignorado por Git).');
  } finally {
    if (demo) await demo.end();
    await base.end();
  }
}

async function verify() {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(state.kind, 'F02_FIX01_TEST_ONLY');
  assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
  const base = await connect(urlFor());
  const demo = await connect(urlFor(state.database));
  try {
    assert.deepEqual(await baseCounts(base), state.baseBefore, 'La base F01 persistente cambió');
    const values = await baseCounts(demo);
    assert.equal(values.users, 3); assert.equal(values.pharmacies, 2); assert.equal(values.memberships, 3);
    const rls = await demo.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid IN ('f02.inventario'::regclass,'f02.movimiento'::regclass)`);
    assert.equal(rls.rows.length, 2);
    assert(rls.rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
    console.log('Fixture F02 verificado; base F01 persistente intacta.');
  } finally { await demo.end(); await base.end(); }
}

async function upgrade() {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(state.kind, 'F02_FIX01_TEST_ONLY');
  assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
  const base = await connect(urlFor());
  try {
    await migrateF02TestDatabase(urlFor(state.database), connect);
    if (!state.authUrl) {
      const suffix = state.database.slice(-12);
      const authRole = `f02_fixture_auth_${suffix}`;
      const authPassword = hex(32);
      await base.query(`CREATE ROLE "${authRole}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${authPassword}'`);
      await base.query(`GRANT f01_auth TO "${authRole}"`);
      const authUrl = new URL(urlFor(state.database));
      authUrl.username = authRole; authUrl.password = authPassword;
      state.authUrl = authUrl.toString();
      state.csrfKey = hex(32);
      state.abuseKey = hex(32);
      writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    }
    assert.deepEqual(await baseCounts(base), state.baseBefore, 'La base F01 persistente cambió');
    console.log('Fixture F02 aislado actualizado; base F01 persistente intacta.');
  } finally { await base.end(); }
}

const command = process.argv[2];
if (command === 'prepare') await prepare();
else if (command === 'verify') await verify();
else if (command === 'upgrade') await upgrade();
else throw new Error('Uso: node scripts/f02/fixture.mjs prepare|upgrade|verify');
