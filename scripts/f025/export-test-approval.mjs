/** Local audit export for the single TEST reviewer bootstrap; no secrets included. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {Client} from 'pg';
import {assertF025ConnectedTarget} from './test-env.mjs';
import {localStateName} from './demo-slot.mjs';

const directory=new URL('../../.cache/f025-docker/',import.meta.url);
const output=new URL(localStateName('approval.local.json'),directory);
if(existsSync(output)){console.log('Expediente TEST local ya exportado.');process.exit(0);}
const state=JSON.parse(readFileSync(new URL(localStateName('demo.local.json'),directory),'utf8'));
assert.equal(state.kind,'F025_TEST_DEMO_ONLY');
const password=readFileSync(new URL('postgres-password.txt',directory),'utf8').trim();
const url=new URL(`postgresql://127.0.0.1:55431/${state.database}`);
url.username='f01_migrator';url.password=password;
const client=new Client({connectionString:url.toString()});await client.connect();
try{
  await assertF025ConnectedTarget(client,state.database);
  const result=await client.query(`SELECT a.id,a.operation,a.reason,a.integrity_hash,a.created_at,
    a.consumed_at,g.action,g.result,g.correlation_id,g.occurred_at
    FROM f01.privileged_approval a JOIN f01.global_audit g ON g.approval_id=a.id
    WHERE a.id=$1 AND a.operation='INITIAL_PLATFORM_ADMIN'
      AND g.action='BOOTSTRAP_PLATFORM_ADMIN' AND g.result='PERMITIDO'`,
    [state.reviewerApproval]);
  assert.equal(result.rows.length,1);
  assert(result.rows[0].consumed_at);
  writeFileSync(output,JSON.stringify({kind:'F025_TEST_OFFLINE_APPROVAL',
    database:state.database,approval:result.rows[0]},null,2),{flag:'wx',mode:0o600});
  console.log('Expediente TEST local de BOOT-01 exportado sin credenciales.');
}finally{await client.end();}
