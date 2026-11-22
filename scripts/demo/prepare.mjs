/** Create one writable, isolated manual DEMO; never modify the persistent F01 database. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { Argon2PasswordHasher } from '../../backend/dist/modules/usuarios/infrastructure/argon2-password.js';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase, migrateF07TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import { migrateF04TestDatabase } from '../../backend/dist/modules/reservas/infrastructure/migrate.js';
import { migrateF05TestDatabase } from '../../backend/dist/modules/notificaciones/infrastructure/migrate.js';

const directory = new URL('../../.cache/manual-demo/', import.meta.url);
const stateFile = new URL('state.local.json', directory);
const credentialsFile = new URL('credentials.local.json', directory);
const randomHex = size => randomBytes(size).toString('hex');
const connect = async url => { const client = new Client({ connectionString: url }); await client.connect(); return client; };
const adminSecret = readFileSync(new URL('../../.cache/f01-docker/postgres-password.txt', import.meta.url), 'utf8').trim();
assert.match(adminSecret, /^[a-f0-9]{64}$/i);
function adminUrl(database = 'farmafind_f01_test') {
  const url = new URL(`postgresql://127.0.0.1:55431/${database}`);
  url.username = 'f01_migrator'; url.password = adminSecret; return url.toString();
}
function assertTestDatabase(database) { assert.match(database, /^farmafind_f01_test_[a-f0-9]{12}$/); }
async function counts(client) {
  return (await client.query(`SELECT (SELECT count(*)::int FROM f01.usuario) users,
    (SELECT count(*)::int FROM f01.sesion) sessions,
    (SELECT count(*)::int FROM f01.farmacia_referencia) pharmacies,
    (SELECT count(*)::int FROM f01.usuario_farmacia) memberships`)).rows[0];
}
async function prepare() {
  assert(!existsSync(stateFile) && !existsSync(credentialsFile), 'DEMO ya preparada; no se sobrescribe');
  const base = await connect(adminUrl());
  let demo;
  try {
    assert.equal((await base.query('SELECT current_database() AS db')).rows[0].db, 'farmafind_f01_test');
    const baseBefore = await counts(base);
    const suffix = randomHex(6), database = `farmafind_f01_test_${suffix}`;
    assertTestDatabase(database);
    await base.query(`CREATE DATABASE "${database}"`);
    // The F07 migrator deliberately requires this exact TEST-only marker.
    await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F07 TEST efimera'`);
    const migrations = {
      f01: (await migrateTestDatabase(adminUrl(database), connect)).applied,
      f02: await migrateF02TestDatabase(adminUrl(database), connect),
      f03: await migrateF03TestDatabase(adminUrl(database), connect),
      f04: await migrateF04TestDatabase(adminUrl(database), connect),
      f05: await migrateF05TestDatabase(adminUrl(database), connect),
      f07: await migrateF07TestDatabase(adminUrl(database), connect),
    };
    const roles = {};
    for (const [key, group] of Object.entries({ auth: 'f01_auth', runtime: 'f01_runtime',
      notifier: 'f05_notifications_runtime', publisher: 'f05_outbox_publisher' })) {
      const role = `ff_demo_${key}_${suffix}`, password = randomHex(32);
      await base.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
      await base.query(`GRANT ${group} TO "${role}"`);
      const url = new URL(adminUrl(database)); url.username = role; url.password = password;
      roles[key] = url.toString();
    }
    demo = await connect(adminUrl(database));
    const hasher = new Argon2PasswordHasher();
    const accounts = {}, pharmacies = {};
    await demo.query('BEGIN');
    try {
      for (const [key, name, address, latitude, longitude] of [
        ['alfa', 'Farmacia Alfa DEMO', 'Av. Alfa 100, Lima', -12.0464, -77.0428],
        ['beta', 'Farmacia Beta DEMO', 'Av. Beta 200, Lima', -12.0800, -77.0600],
      ]) {
        pharmacies[key] = (await demo.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id', [name])).rows[0].id;
        await demo.query('INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto,latitud,longitud) VALUES($1,$2,$3,$4)',
          [pharmacies[key], address, latitude, longitude]);
      }
      for (const [key, pharmacy] of [['cliente', null], ['adminAlfa', 'alfa'], ['revisorAlfa', 'alfa'],
        ['adminBeta', 'beta'], ['revisorBeta', 'beta']]) {
        const email = `demo-${key.toLowerCase()}-${suffix}@example.invalid`;
        const password = `${randomBytes(24).toString('base64url')}Aa1!`;
        const id = (await demo.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2) RETURNING id',
          [email, await hasher.hash(password)])).rows[0].id;
        accounts[key] = { id, email, password, pharmacy };
        if (pharmacy) {
          const membership = (await demo.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
            VALUES($1,$2,'ADMINISTRADOR') RETURNING id`, [id, pharmacies[pharmacy]])).rows[0].id;
          const capabilities = key.startsWith('revisor') ? ['GEO_LOCATION_REVIEW'] : [
            'membership.manage', 'inventory.read', 'inventory.write', 'inventory.import.preview',
            'inventory.import.confirm', 'inventory.history', 'reservation.read',
            'reservation.accept', 'reservation.deliver', 'reservation.settings', 'GEO_LOCATION_PROPOSE',
          ];
          for (const capability of capabilities) await demo.query(`INSERT INTO f01.delegacion
            (membresia_id,farmacia_id,capacidad,granted_by_usuario_id) VALUES($1,$2,$3,$4)`,
          [membership, pharmacies[pharmacy], capability, id]);
        }
      }
      for (const [name, concentration, presentation] of [
        ['producto demo a', '10 mg', 'tabletas'], ['producto demo b', '20 mg', 'capsulas'],
      ]) await demo.query(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
        VALUES($1,'principio ficticio',$2,$3,'venta libre')`, [name, concentration, presentation]);
      for (const [pharmacy, proposer, reviewer, city] of [
        ['alfa', 'adminAlfa', 'revisorAlfa', 'lima'], ['beta', 'adminBeta', 'revisorBeta', 'lima'],
      ]) await demo.query(`UPDATE f03.farmacia_publica SET ciudad=$2,fuente='Fixture DEMO local',
        estado_ubicacion='PUBLICADA_VERIFICADA',propuesta_por=$3,revisada_por=$4,
        fecha_verificacion=now(),updated_at=now() WHERE farmacia_id=$1`,
      [pharmacies[pharmacy], city, accounts[proposer].id, accounts[reviewer].id]);
      await demo.query('COMMIT');
    } catch (error) { await demo.query('ROLLBACK'); throw error; }
    const redisSecret = readFileSync(new URL('../../.cache/f03-docker/redis-password.txt', import.meta.url), 'utf8').trim();
    assert.match(redisSecret, /^[a-f0-9]{64}$/i);
    const redisUrl = new URL('redis://127.0.0.1:56379/0'); redisUrl.password = redisSecret;
    mkdirSync(directory, { recursive: true });
    writeFileSync(credentialsFile, `${JSON.stringify(Object.fromEntries(Object.entries(accounts)
      .map(([key, value]) => [key, { email: value.email, password: value.password }])), null, 2)}\n`,
    { flag: 'wx', mode: 0o600 });
    writeFileSync(stateFile, `${JSON.stringify({ kind: 'FARMAFIND_MANUAL_DEMO_TEST_ONLY', database,
      roles, redisUrl: redisUrl.toString(), csrfKey: randomHex(32), abuseKey: randomHex(32),
      notificationSecret: randomHex(32), pharmacies, baseBefore, migrations }, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 });
    assert.deepEqual(await counts(base), baseBefore, 'La base persistente cambió');
    console.log(`DEMO TEST preparada: ${database}; 2 farmacias, 5 cuentas ficticias, catálogo mínimo y cero inventarios cargados.`);
    console.log('Credenciales privadas: .cache/manual-demo/credentials.local.json');
  } finally { if (demo) await demo.end(); await base.end(); }
}
async function verify() {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(state.kind, 'FARMAFIND_MANUAL_DEMO_TEST_ONLY'); assertTestDatabase(state.database);
  const base = await connect(adminUrl()); const demo = await connect(adminUrl(state.database));
  try {
    assert.deepEqual(await counts(base), state.baseBefore, 'La base persistente cambió');
    const marker = (await demo.query(`SELECT description FROM pg_shdescription
      WHERE objoid=(SELECT oid FROM pg_database WHERE datname=current_database())`)).rows[0]?.description;
    assert.equal(marker, 'FarmaFind F07 TEST efimera');
    const data = await counts(demo);
    assert.equal(data.pharmacies, 2); assert.equal(data.memberships, 4);
    const rls = await demo.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid IN ('f01.usuario_farmacia'::regclass,'f02.inventario'::regclass,
        'f03.farmacia_publica'::regclass,'f04.reserva'::regclass,'f05.entrega_local'::regclass)`);
    assert.equal(rls.rows.length, 5);
    assert(rls.rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
    console.log(`DEMO TEST verificada: ${state.database}; RLS/FORCE RLS activo y base persistente intacta.`);
  } finally { await demo.end(); await base.end(); }
}
if (process.argv[2] === 'prepare') await prepare();
else if (process.argv[2] === 'verify') await verify();
else throw new Error('Uso: node scripts/demo/prepare.mjs prepare|verify');
