/** Add the approved TEST-only document-read grant to the single local reviewer. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025ConnectedTarget} from './test-env.mjs';
import {localStateName} from './demo-slot.mjs';

const dir=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL(localStateName('demo.local.json'),dir),'utf8'));
assert.equal(state.kind,'F025_TEST_DEMO_ONLY');
const credential=JSON.parse(readFileSync(new URL(localStateName('credentials.local.json'),dir),'utf8'));
const secret=readFileSync(new URL('postgres-password.txt',dir),'utf8').trim();
const url=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username='f01_migrator';url.password=secret;
const db=new Client({connectionString:url.toString()});await db.connect();
try{
  await assertF025ConnectedTarget(db,state.database);
  await db.query('BEGIN');
  try{
    const actor=(await db.query('SELECT id FROM f01.usuario WHERE email_canonico=$1',
      [credential.reviewer.email])).rows[0]?.id;
    assert(actor,'Revisor TEST no existe');
    const existing=(await db.query(`SELECT count(*)::int AS n FROM f025.platform_capability_grant
      WHERE actor_id=$1 AND capability_code='F025_DOCUMENT_READ' AND estado='ACTIVA'`,[actor])).rows[0].n;
    if(!existing){
      const approval=(await db.query('SELECT integrity_hash FROM f01.privileged_approval WHERE id=$1',
        [state.reviewerApproval])).rows[0];
      assert(approval,'Expediente BOOT-01 TEST ausente');
      await db.query(`INSERT INTO f025.platform_capability_grant(actor_id,capability_code,
        approval_id,approval_sha256,reason) VALUES($1,'F025_DOCUMENT_READ',$2,$3,
        'Acceso a adjuntos sintéticos de revisión TEST F02.5')`,
        [actor,randomUUID(),approval.integrity_hash]);
    }
    await db.query('COMMIT');
    console.log(existing?'Grant TEST documental ya existente.':'Grant TEST documental agregado al revisor.');
  }catch(error){await db.query('ROLLBACK');throw error;}
}finally{await db.end();}
