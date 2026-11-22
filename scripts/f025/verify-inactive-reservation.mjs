/** Verify F04 rejects inactive pharmacies before stock lookup; rollback all fixtures. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025EphemeralDatabase,assertF025ConnectedTarget} from './test-env.mjs';

const local=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL('state.local.json',local),'utf8'));
const password=readFileSync(new URL('postgres-password.txt',local),'utf8').trim();
const target=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
target.username='f01_migrator';target.password=password;
assertF025EphemeralDatabase(target.toString(),{migration:true});
const db=new Client({connectionString:target.toString()});
await db.connect();
let begun=false;
try{
  await assertF025ConnectedTarget(db,state.database);
  await db.query('BEGIN');begun=true;
  const marker=randomBytes(6).toString('hex');
  const user=(await db.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
    VALUES($1,'$argon2id$fixture-only') RETURNING id`,[`f025-reservation-${marker}@example.invalid`])).rows[0].id;
  const active=(await db.query(`INSERT INTO f01.farmacia_referencia(nombre_publico,estado)
    VALUES($1,'ACTIVA') RETURNING id`,[`Farmacia Activa ${marker}`])).rows[0].id;
  const inactive=(await db.query(`INSERT INTO f01.farmacia_referencia(nombre_publico,estado)
    VALUES($1,'INACTIVA') RETURNING id`,[`Farmacia Inactiva ${marker}`])).rows[0].id;
  const fingerprint=randomBytes(32).toString('hex');
  await db.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
    VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '1 day')`,[user,fingerprint]);
  await db.query('SET LOCAL ROLE f01_runtime');
  await db.query("SELECT set_config('app.actor_user_id',$1,true)",[user]);
  await db.query("SELECT set_config('app.session_fingerprint',$1,true)",[fingerprint]);
  const reserve=async pharmacy=>db.query(`SELECT f04.reserve_stock($1,$2,$3,1,
    now()+interval '20 minutes',$4)`, [user,pharmacy,randomUUID(),randomUUID()]);
  await db.query("SELECT set_config('app.farmacia_id',$1,true)",[active]);
  await db.query('SAVEPOINT active_without_stock');
  await assert.rejects(reserve(active),error=>error.code==='23514');
  await db.query('ROLLBACK TO SAVEPOINT active_without_stock');
  await db.query("SELECT set_config('app.farmacia_id',$1,true)",[inactive]);
  await db.query('SAVEPOINT inactive_denied');
  await assert.rejects(reserve(inactive),error=>error.code==='42501');
  await db.query('ROLLBACK TO SAVEPOINT inactive_denied');
  console.log(JSON.stringify({kind:'F025_INACTIVE_RESERVATION',activeWithoutStock:'NO_AVAILABILITY',
    inactive:'DENIED',rolledBack:true,persistentTouched:false}));
}finally{
  if(begun)await db.query('ROLLBACK');
  await db.end();
}
