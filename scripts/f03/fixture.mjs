/** Create one isolated F03 TEST database; never mutate the persistent F01 database. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { migrateTestDatabase } from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import { migrateF02TestDatabase } from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import { migrateF03TestDatabase } from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';

const root = fileURLToPath(new URL('../../',import.meta.url));
const privateDir = path.join(root,'.cache/f03-fixture'); const stateFile = path.join(privateDir,'state.local.json');
const postgresSecretFile = path.join(root,'.cache/f01-docker/postgres-password.txt');
const redisSecretFile = path.join(root,'.cache/f03-docker/redis-password.txt');
const hex = size => randomBytes(size).toString('hex');
function urlFor(database='farmafind_f01_test') {
  const secret=readFileSync(postgresSecretFile,'utf8').trim(); assert.match(secret,/^[a-f0-9]{64}$/i);
  const url=new URL('postgresql://127.0.0.1:55431/farmafind_f01_test'); url.username='f01_migrator'; url.password=secret; url.pathname=`/${database}`; return url.toString();
}
async function connect(url) { const client=new Client({connectionString:url}); await client.connect(); return client; }
async function baseCounts(client) { return (await client.query(`SELECT (SELECT count(*)::int FROM f01.usuario) users,
  (SELECT count(*)::int FROM f01.sesion) sessions,(SELECT count(*)::int FROM f01.farmacia_referencia) pharmacies,
  (SELECT count(*)::int FROM f01.usuario_farmacia) memberships`)).rows[0]; }
async function prepare() {
  assert.equal(existsSync(stateFile),false,'El fixture F03 ya existe; no se sobrescribe');
  const base=await connect(urlFor()); let demo;
  try {
    const before=await baseCounts(base); const suffix=hex(6); const database=`farmafind_f01_test_${suffix}`;
    const authRole=`f03_fixture_auth_${suffix}`; const runtimeRole=`f03_fixture_runtime_${suffix}`;
    const authPassword=hex(32); const runtimePassword=hex(32);
    await base.query(`CREATE DATABASE "${database}"`); await base.query(`COMMENT ON DATABASE "${database}" IS 'FarmaFind F03 TEST ficticio'`);
    await migrateTestDatabase(urlFor(database),connect); await migrateF02TestDatabase(urlFor(database),connect); await migrateF03TestDatabase(urlFor(database),connect);
    await base.query(`CREATE ROLE "${authRole}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${authPassword}'`);
    await base.query(`GRANT f01_auth TO "${authRole}"`);
    await base.query(`CREATE ROLE "${runtimeRole}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${runtimePassword}'`);
    await base.query(`GRANT f01_runtime TO "${runtimeRole}"`);
    demo=await connect(urlFor(database)); await demo.query('BEGIN');
    try {
      const pharmacies={};
      for (const [label,name,address,latitude,longitude] of [['alfa','Farmacia Alfa','Av. Alfa 100, Lima',-12.0464,-77.0428],['beta','Farmacia Beta','Av. Beta 200, Lima',-12.0800,-77.0600]]) {
        const id=(await demo.query('INSERT INTO f01.farmacia_referencia(nombre_publico) VALUES($1) RETURNING id',[name])).rows[0].id;
        pharmacies[label]=id; await demo.query('INSERT INTO f03.farmacia_publica(farmacia_id,direccion_texto,latitud,longitud) VALUES($1,$2,$3,$4)',[id,address,latitude,longitude]);
      }
      const medication=(await demo.query(`INSERT INTO f02.medicamento(nombre,principio_activo,concentracion,presentacion,clasificacion)
        VALUES('paracetamol ficticio','paracetamol','500 mg','tabletas','venta libre') RETURNING id`)).rows[0].id;
      await demo.query(`INSERT INTO f02.inventario(farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
        VALUES($1,$3,1250,10,2,now()),($2,$3,1390,6,1,now())`,[pharmacies.alfa,pharmacies.beta,medication]);
      await demo.query('COMMIT');
      const runtimeUrl=new URL(urlFor(database)); runtimeUrl.username=runtimeRole; runtimeUrl.password=runtimePassword;
      const authUrl=new URL(urlFor(database)); authUrl.username=authRole; authUrl.password=authPassword;
      const redisSecret=readFileSync(redisSecretFile,'utf8').trim(); assert.match(redisSecret,/^[a-f0-9]{64}$/i);
      const redisUrl=new URL('redis://127.0.0.1:56379/0'); redisUrl.password=redisSecret;
      mkdirSync(privateDir,{recursive:true}); writeFileSync(stateFile,`${JSON.stringify({ kind:'F03_TEST_ONLY',database,
        authUrl:authUrl.toString(),runtimeUrl:runtimeUrl.toString(),redisUrl:redisUrl.toString(),csrfKey:hex(32),abuseKey:hex(32),
        pharmacies,medication,baseBefore:before,createdAt:new Date().toISOString() },null,2)}\n`,{flag:'wx',mode:0o600});
      assert.deepEqual(await baseCounts(base),before,'La base persistente cambió');
      console.log('Fixture F03 aislado preparado: 2 farmacias y 2 ofertas ficticias.');
    } catch(error) { await demo.query('ROLLBACK'); throw error; }
  } finally { if(demo) await demo.end(); await base.end(); }
}
async function verify() {
  const state=JSON.parse(readFileSync(stateFile,'utf8')); assert.equal(state.kind,'F03_TEST_ONLY');
  const base=await connect(urlFor()); const demo=await connect(urlFor(state.database));
  try { assert.deepEqual(await baseCounts(base),state.baseBefore,'La base persistente cambió');
    const rows=await demo.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('f02.inventario'::regclass,'f03.farmacia_publica'::regclass)`);
    assert.equal(rows.rows.length,2); assert(rows.rows.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
    console.log('Fixture F03 verificado; base persistente intacta y RLS activo.');
  } finally { await demo.end(); await base.end(); }
}
if(process.argv[2]==='prepare') await prepare(); else if(process.argv[2]==='verify') await verify(); else throw new Error('Uso: node scripts/f03/fixture.mjs prepare|verify');
