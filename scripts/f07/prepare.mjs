/** Create a new isolated F07 TEST database; never write to farmafind_f01_test. */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import argon2 from 'argon2';
import { Client } from 'pg';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase, migrateF07TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import { F07_TEST_PHARMACIES, F07_TEST_IDENTITIES, F07_TEST_OFFERS, assertF07EphemeralDatabase } from './fixtures.mjs';

const root = fileURLToPath(new URL('../../',import.meta.url));
const localDir = path.join(root,'.cache/f07-fixture');
const stateFile = path.join(localDir,'state.local.json');
const secretFile = path.join(root,'.cache/f01-docker/postgres-password.txt');
const hex = size => randomBytes(size).toString('hex');
const connect = async url => { const client = new Client({ connectionString:url }); await client.connect(); return client; };

function migratorUrl(name='farmafind_f01_test') {
  const secret = readFileSync(secretFile,'utf8').trim();
  assert.match(secret,/^[a-f0-9]{64}$/i,'Secreto local inválido');
  const url = new URL('postgresql://127.0.0.1:55431/farmafind_f01_test');
  url.username='f01_migrator'; url.password=secret; url.pathname=`/${name}`;
  return url.toString();
}

async function counts(client) {
  return (await client.query(`SELECT (SELECT count(*)::int FROM f01.usuario) usuarios,
    (SELECT count(*)::int FROM f01.sesion) sesiones,
    (SELECT count(*)::int FROM f01.farmacia_referencia) farmacias,
    (SELECT count(*)::int FROM f01.usuario_farmacia) membresias`)).rows[0];
}

async function prepare() {
  assert.equal(existsSync(stateFile),false,'F07: ya existe fixture local; no se sobrescribe');
  const base = await connect(migratorUrl());
  let test;
  try {
    assert.equal((await base.query('SELECT current_database() AS name')).rows[0].name,'farmafind_f01_test');
    const baseBefore = await counts(base);
    const suffix = hex(6); const database = `farmafind_f01_test_${suffix}`;
    const testUrl = migratorUrl(database); assertF07EphemeralDatabase(testUrl);
    const role = `f07_test_runtime_${suffix}`; const runtimePassword = hex(32);
    await base.query(`CREATE DATABASE "${database}"`);
    await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F07 TEST efimera'`);
    const f01 = await migrateTestDatabase(testUrl,connect);
    const f02 = await migrateF02TestDatabase(testUrl,connect);
    const f03 = await migrateF03TestDatabase(testUrl,connect);
    test = await connect(testUrl);
    const pharmacyIds = {};
    await test.query('BEGIN');
    try {
      for (const item of F07_TEST_PHARMACIES) {
        const id = (await test.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id',[item.name])).rows[0].id;
        pharmacyIds[item.key] = id;
        await test.query('INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto,latitud,longitud) VALUES($1,$2,$3,$4)',
          [id,item.address,item.latitude,item.longitude]);
      }
      await test.query('COMMIT');
    } catch (error) { await test.query('ROLLBACK'); throw error; }
    const f07 = await migrateF07TestDatabase(testUrl,connect);
    const legacy = (await test.query(`SELECT count(*)::int AS count FROM f03.farmacia_publica
      WHERE ciudad IS NULL AND estado_ubicacion='PENDIENTE'`)).rows[0].count;
    assert.equal(legacy,5,'Migración F07 alteró filas heredadas');
    const identities = {}; const sessions = {};
    await test.query('BEGIN');
    try {
      const hash = await argon2.hash(hex(32),{ type:argon2.argon2id });
      for (const item of F07_TEST_IDENTITIES) {
        const email = `${item.key}@example.invalid`;
        const userId = (await test.query('INSERT INTO f01.usuario(email_canonico,password_hash) VALUES($1,$2) RETURNING id',[email,hash])).rows[0].id;
        const membershipId=(await test.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
          VALUES($1,$2,'TRABAJADOR') RETURNING id`,[userId,pharmacyIds[item.pharmacy]])).rows[0].id;
        identities[item.key]={userId,membershipId};
        const fingerprint=hex(32); sessions[item.key]=fingerprint;
        await test.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
          VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '1 day')`,[userId,fingerprint]);
      }
      for (const item of F07_TEST_IDENTITIES) {
        const counterpart=item.key.includes('proposer') ? item.key.replace('proposer','reviewer') : item.key.replace('reviewer','proposer');
        await test.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
          VALUES($1,$2,$3,$4)`,[identities[item.key].membershipId,pharmacyIds[item.pharmacy],
          item.capability,identities[counterpart].userId]);
      }
      for (const item of F07_TEST_PHARMACIES) {
        await test.query(`UPDATE f03.farmacia_publica SET ciudad=$2,fuente='Fixture F07 TEST',
          estado_ubicacion='PUBLICADA_VERIFICADA',propuesta_por=$3,revisada_por=$4,
          fecha_verificacion=now(),updated_at=now() WHERE farmacia_id=$1`,
          [pharmacyIds[item.key],item.city,identities['alfa-proposer'].userId,identities['alfa-reviewer'].userId]);
      }
      const productIds = {};
      for (const name of [...new Set(F07_TEST_OFFERS.map(item=>item.product))]) {
        productIds[name] = (await test.query(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
          VALUES($1,'principio ficticio','10 mg','tabletas','venta libre') RETURNING id`,[name])).rows[0].id;
      }
      for (const item of F07_TEST_OFFERS) {
        await test.query(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
          VALUES($1,$2,$3,10,0,now())`,[pharmacyIds[item.pharmacy],productIds[item.product],item.priceCents]);
      }
      await test.query('COMMIT');
    } catch (error) { await test.query('ROLLBACK'); throw error; }
    await base.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${runtimePassword}'`);
    await base.query(`GRANT f01_runtime TO "${role}"`);
    const runtimeUrl = new URL(testUrl); runtimeUrl.username=role; runtimeUrl.password=runtimePassword;
    mkdirSync(localDir,{recursive:true});
    writeFileSync(stateFile,`${JSON.stringify({kind:'F07_TEST_ONLY',database,role,runtimeUrl:runtimeUrl.toString(),
      pharmacyIds,identities,sessions,legacyPendingBeforeFixture:legacy,baseBefore,migrations:{f01:f01.applied,f02,f03,f07}},null,2)}\n`,
      {flag:'wx',mode:0o600});
    assert.deepEqual(await counts(base),baseBefore,'La base persistente cambió');
    console.log(`F07 TEST efímera creada: ${database}; 5 farmacias y 4 identidades ficticias. Base persistente intacta.`);
    console.log(`Migraciones aplicadas: F01 ${f01.applied.length}, F02 ${f02.length}, F03 ${f03.length}, F07 ${f07.length}.`);
  } finally { if (test) await test.end(); await base.end(); }
}

async function verify() {
  const state = JSON.parse(readFileSync(stateFile,'utf8'));
  assert.equal(state.kind,'F07_TEST_ONLY');
  assertF07EphemeralDatabase(migratorUrl(state.database));
  const base = await connect(migratorUrl()); const test = await connect(migratorUrl(state.database));
  try {
    assert.deepEqual(await counts(base),state.baseBefore,'La base persistente cambió');
    assert.equal((await base.query("SELECT to_regnamespace('f07') AS schema_name")).rows[0].schema_name,
      null,'La base persistente contiene un esquema F07 inesperado');
    const marker=(await test.query(`SELECT description FROM pg_shdescription
      WHERE objoid=(SELECT oid FROM pg_database WHERE datname=current_database())`)).rows[0]?.description;
    assert.equal(marker,'FarmaFind F07 TEST efimera');
    assert.equal((await test.query('SELECT count(*)::int AS count FROM f03.farmacia_publica')).rows[0].count,5);
    console.log('F07 TEST verificada: cinco farmacias, marca TEST y base persistente intacta.');
  } finally { await test.end(); await base.end(); }
}

async function enableLocalApi() {
  const state=JSON.parse(readFileSync(stateFile,'utf8'));
  assert.equal(state.kind,'F07_TEST_ONLY');
  assertF07EphemeralDatabase(migratorUrl(state.database));
  if (state.authUrl) { console.log('F07 TEST: rol de autenticación local ya preparado.'); return; }
  const base=await connect(migratorUrl());
  try {
    assert.deepEqual(await counts(base),state.baseBefore,'La base persistente cambió');
    const suffix=state.database.slice(-12);
    const role=`f07_test_auth_${suffix}`; const password=hex(32);
    await base.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
    await base.query(`GRANT f01_auth TO "${role}"`);
    const url=new URL(migratorUrl(state.database)); url.username=role; url.password=password;
    state.authUrl=url.toString(); state.csrfKey=hex(32); state.abuseKey=hex(32);
    writeFileSync(stateFile,`${JSON.stringify(state,null,2)}\n`,{mode:0o600});
    assert.deepEqual(await counts(base),state.baseBefore,'La base persistente cambió');
    console.log('F07 TEST: rol de autenticación local separado, sin SUPERUSER/BYPASSRLS; base persistente intacta.');
  } finally { await base.end(); }
}

async function enableTestSessions() {
  const state=JSON.parse(readFileSync(stateFile,'utf8'));
  assert.equal(state.kind,'F07_TEST_ONLY');
  assertF07EphemeralDatabase(migratorUrl(state.database));
  if (state.sessionSecrets) { console.log('F07 TEST: sesiones ficticias ya preparadas.'); return; }
  const base=await connect(migratorUrl()); const test=await connect(migratorUrl(state.database));
  try {
    assert.deepEqual(await counts(base),state.baseBefore,'La base persistente cambió');
    state.sessionSecrets={};
    await test.query('BEGIN');
    try {
      for (const [key,identity] of Object.entries(state.identities)) {
        const secret=hex(32);
        const fingerprint=createHash('sha256').update(Buffer.from(secret,'hex')).digest();
        await test.query('UPDATE f01.sesion SET token_fingerprint=$1 WHERE usuario_id=$2',[fingerprint,identity.userId]);
        state.sessionSecrets[key]=secret;
        state.sessions[key]=fingerprint.toString('hex');
      }
      await test.query('COMMIT');
    } catch(error){await test.query('ROLLBACK');throw error;}
    writeFileSync(stateFile,`${JSON.stringify(state,null,2)}\n`,{mode:0o600});
    assert.deepEqual(await counts(base),state.baseBefore,'La base persistente cambió');
    console.log('F07 TEST: cuatro sesiones ficticias con secretos locales ignorados por Git; base persistente intacta.');
  } finally { await test.end(); await base.end(); }
}

async function refreshTestSessions() {
  const state=JSON.parse(readFileSync(stateFile,'utf8'));
  assert.equal(state.kind,'F07_TEST_ONLY');
  assertF07EphemeralDatabase(migratorUrl(state.database));
  assert.ok(state.sessionSecrets,'F07: sesiones TEST no preparadas');
  const base=await connect(migratorUrl()); const test=await connect(migratorUrl(state.database));
  try {
    assert.deepEqual(await counts(base),state.baseBefore,'La base persistente cambió');
    for (const [key,identity] of Object.entries(state.identities)) {
      const fingerprint=createHash('sha256').update(Buffer.from(state.sessionSecrets[key],'hex')).digest();
      const result=await test.query(`UPDATE f01.sesion
        SET idle_expires_at=now()+interval '1 hour',absolute_expires_at=now()+interval '1 day'
        WHERE usuario_id=$1 AND token_fingerprint=$2 AND estado='VIGENTE'`,[identity.userId,fingerprint]);
      assert.equal(result.rowCount,1,`F07: sesión TEST ${key} no válida`);
    }
    assert.deepEqual(await counts(base),state.baseBefore,'La base persistente cambió');
    console.log('F07 TEST: vigencia de cuatro sesiones ficticias renovada; base persistente intacta.');
  } finally {await test.end();await base.end();}
}

if (process.argv[2]==='prepare') await prepare();
else if (process.argv[2]==='verify') await verify();
else if (process.argv[2]==='enable-local-api') await enableLocalApi();
else if (process.argv[2]==='enable-test-sessions') await enableTestSessions();
else if (process.argv[2]==='refresh-test-sessions') await refreshTestSessions();
else throw new Error('Uso: node scripts/f07/prepare.mjs prepare|verify|enable-local-api|enable-test-sessions|refresh-test-sessions');
