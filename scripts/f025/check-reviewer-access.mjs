/** Read-only verification of the DEMO reviewer and a named application. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025EphemeralDatabase,assertF025ConnectedTarget} from './test-env.mjs';

const local=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL('state.manual.local.json',local),'utf8'));
const credentials=JSON.parse(readFileSync(new URL('credentials.manual.local.json',local),'utf8'));
const password=readFileSync(new URL('postgres-password.txt',local),'utf8').trim();
const url=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username='f01_migrator';url.password=password;
assertF025EphemeralDatabase(url.toString(),{migration:true});
const db=new Client({connectionString:url.toString()});
await db.connect();
try {
  await assertF025ConnectedTarget(db,state.database);
  const users=(await db.query('SELECT id,estado FROM f01.usuario WHERE email_canonico=$1',
    [credentials.reviewer.email])).rows;
  assert.equal(users.length,1,'Revisor TEST ausente o duplicado');
  const id=users[0].id;
  const roles=await db.query(`SELECT role_code FROM f01.platform_role_assignment
    WHERE usuario_id=$1 AND estado='ACTIVA' ORDER BY role_code`,[id]);
  const grants=await db.query(`SELECT capability_code FROM f025.platform_capability_grant
    WHERE actor_id=$1 AND estado='ACTIVA' ORDER BY capability_code`,[id]);
  const memberships=await db.query(`SELECT count(*)::int AS total FROM f01.usuario_farmacia
    WHERE usuario_id=$1 AND estado='ACTIVA'`,[id]);
  const applications=await db.query(`SELECT estado,version,(SELECT count(*)::int FROM f025.revision r
    WHERE r.solicitud_id=s.id) AS reviews FROM f025.solicitud s
    WHERE nombre_comercial=$1 ORDER BY created_at DESC`,[process.argv[2]??'HUAMANFAR']);
  console.log(JSON.stringify({kind:'F025_MANUAL_REVIEW_READ_ONLY',
    reviewerActive:users[0].estado==='ACTIVO',
    roles:roles.rows.map(row=>row.role_code),
    capabilities:grants.rows.map(row=>row.capability_code),
    reviewerPharmacyMemberships:memberships.rows[0].total,
    applications:applications.rows}));
} finally {await db.end();}
