/** Isolated F02.5 profile RLS regression. Creates and removes only its own marked child DB. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {migrateTestDatabase} from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import {migrateF02TestDatabase} from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import {migrateF03TestDatabase,migrateF07TestDatabase} from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import {migrateF04TestDatabase} from '../../backend/dist/modules/reservas/infrastructure/migrate.js';
import {migrateF05TestDatabase} from '../../backend/dist/modules/notificaciones/infrastructure/migrate.js';
import {migrateF025TestDatabase} from '../../backend/dist/modules/farmacias/infrastructure/migrate-f025.js';

const secret=readFileSync('.cache/f025-docker/postgres-password.txt','utf8').trim();
assert.match(secret,/^[a-f0-9]{64}$/i);
const suffix=randomBytes(6).toString('hex'),db=`farmafind_f01_test_${suffix}`;
const marker='FarmaFind F07 TEST efimera';
const url=name=>`postgresql://f01_migrator:${secret}@127.0.0.1:55431/${name}`;
const connect=async address=>{const client=new Client({connectionString:address});await client.connect();return client;};
const admin=await connect(url('farmafind_f025_cluster'));
let created=false;
let child;
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
try{
  const identity=(await admin.query("SELECT current_database() db,current_setting('cluster_name') cluster,current_user role")).rows[0];
  check('Clúster F02.5 TEST exclusivo',identity.db==='farmafind_f025_cluster'&&
    identity.cluster==='farmafind-f025-test'&&identity.role==='f01_migrator');
  await admin.query(`CREATE DATABASE "${db}"`);created=true;
  await admin.query(`COMMENT ON DATABASE "${db}" IS '${marker}'`);
  for(const migrate of [migrateTestDatabase,migrateF02TestDatabase,migrateF03TestDatabase,
    migrateF04TestDatabase,migrateF05TestDatabase,migrateF07TestDatabase,migrateF025TestDatabase])
    await migrate(url(db),connect);
  child=await connect(url(db));
  await child.query('BEGIN');
  const actors={};
  for(const name of ['alfa','beta','global']){
    const user=(await child.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
      VALUES($1,'$argon2id$fixture-only') RETURNING id`,[`f025-profile-${suffix}-${name}@example.invalid`])).rows[0].id;
    const fingerprint=randomBytes(32).toString('hex');
    await child.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
      VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '1 day')`,[user,fingerprint]);
    actors[name]={user,fingerprint};
    if(name==='global')continue;
    const pharmacy=(await child.query(`INSERT INTO f01.farmacia_referencia(nombre_publico)
      VALUES($1) RETURNING id`,[`Farmacia ${name} TEST ${suffix}`])).rows[0].id;
    const membership=(await child.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
      VALUES($1,$2,'DUENO') RETURNING id`,[user,pharmacy])).rows[0].id;
    for(const capability of ['pharmacy.profile.read','pharmacy.profile.write'])
      await child.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,granted_by_usuario_id)
        VALUES($1,$2,$3,$4)`,[membership,pharmacy,capability,user]);
    await child.query(`INSERT INTO f025.farmacia_perfil(farmacia_id,contacto,direccion,departamento,provincia,distrito)
      VALUES($1,'Contacto ficticio','Dirección ficticia','Lima','Lima','Lima')`,[pharmacy]);
    actors[name].pharmacy=pharmacy;
    actors[name].membership=membership;
  }
  const worker=(await child.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
    VALUES($1,'$argon2id$fixture-only') RETURNING id`,[`f025-profile-${suffix}-worker@example.invalid`])).rows[0].id;
  const workerFingerprint=randomBytes(32).toString('hex');
  await child.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
    VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '1 day')`,[worker,workerFingerprint]);
  await child.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
    VALUES($1,$2,'TRABAJADOR')`,[worker,actors.alfa.pharmacy]);
  actors.worker={user:worker,fingerprint:workerFingerprint};
  await child.query('SET LOCAL ROLE f01_runtime');
  const context=async(name,pharmacy)=>{
    await child.query("SELECT set_config('app.actor_user_id',$1,true)",[actors[name].user]);
    await child.query("SELECT set_config('app.session_fingerprint',$1,true)",[actors[name].fingerprint]);
    await child.query("SELECT set_config('app.farmacia_id',$1,true)",[pharmacy]);
  };
  const count=async()=>Number((await child.query('SELECT count(*) n FROM f025.farmacia_perfil')).rows[0].n);
  await context('alfa',actors.alfa.pharmacy);
  check('Alfa lee su perfil',await count()===1);
  await child.query("SELECT set_config('app.f025_profile_correlation',$1,true)",[randomUUID()]);
  const own=await child.query(`UPDATE f025.farmacia_perfil SET contacto='Contacto Alfa TEST',version=version+1
    WHERE farmacia_id=$1 AND version=1 RETURNING version`,[actors.alfa.pharmacy]);
  check('Stale version cannot overwrite contact',(await child.query(`UPDATE f025.farmacia_perfil
    SET contacto='Stale TEST',version=version+1 WHERE farmacia_id=$1 AND version=1`,
  [actors.alfa.pharmacy])).rowCount===0);
  await child.query('SAVEPOINT protected_column');
  let protectedDenied=false;
  try { await child.query(`UPDATE f025.farmacia_perfil SET direccion='Denied TEST'
    WHERE farmacia_id=$1`,[actors.alfa.pharmacy]); }
  catch(error){protectedDenied=error.code==='42501';}
  await child.query('ROLLBACK TO SAVEPOINT protected_column');
  check('Runtime cannot update protected columns',protectedDenied);
  check('Alfa actualiza contacto y versión',own.rowCount===1&&own.rows[0].version===2);
  await child.query('SET LOCAL ROLE f01_migrator');
  check('Edición queda auditada',Number((await child.query(`SELECT count(*) n FROM f025.perfil_cambio
    WHERE farmacia_id=$1`,[actors.alfa.pharmacy])).rows[0].n)===1);
  await child.query('SET LOCAL ROLE f01_runtime');
  await context('alfa',actors.beta.pharmacy);
  check('Alfa no lee Beta con tenant manipulado',await count()===0);
  check('Alfa no actualiza Beta', (await child.query(`UPDATE f025.farmacia_perfil
    SET contacto='Invasión TEST',version=version+1 WHERE farmacia_id=$1`,[actors.beta.pharmacy])).rowCount===0);
  await context('global',actors.alfa.pharmacy);
  check('Sin membresía no lee perfil',await count()===0);
  await context('worker',actors.alfa.pharmacy);
  check('Worker without profile grant sees no private profile',await count()===0);
  await context('beta',actors.beta.pharmacy);
  check('Beta lee solo su perfil',await count()===1);
  await child.query('SET LOCAL ROLE f01_migrator');
  await child.query(`UPDATE f01.delegacion SET estado='REVOCADA',revoked_at=now()
    WHERE farmacia_id=$1 AND capacidad='pharmacy.profile.read'`,[actors.beta.pharmacy]);
  await child.query('SET LOCAL ROLE f01_runtime');
  check('Revocación de lectura niega acceso inmediato',await count()===0);
  await child.query('ROLLBACK');
  console.log(JSON.stringify({checks:checks.length,passed:checks.length,migrations:'F01–F05/F07/F02.5 en hijo efímero',persistentTouched:false}));
}finally{
  if(child){try{await child.query('ROLLBACK');}catch{}await child.end();}
  if(created){
    const row=(await admin.query(`SELECT shobj_description(oid,'pg_database') marker FROM pg_database
      WHERE datname=$1`,[db])).rows[0];
    if(row?.marker!==marker)throw new Error('F02.5: base hija sin marca, limpieza rechazada');
    await admin.query(`DROP DATABASE "${db}"`);
  }
  await admin.end();
}
