/** Provision one F02.5 TEST reviewer. No pharmacy or inventory is preloaded. */
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {Client} from 'pg';
import {Argon2PasswordHasher} from '../../backend/dist/modules/usuarios/infrastructure/argon2-password.js';
import {assertF025ConnectedTarget} from './test-env.mjs';
import {localStateName} from './demo-slot.mjs';

const directory=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL(localStateName('state.local.json'),directory),'utf8'));
const database=state.database;
assert.match(database,/^farmafind_f01_test_[a-f0-9]{12}$/);
const demoFile=new URL(localStateName('demo.local.json'),directory);
const credentialFile=new URL(localStateName('credentials.local.json'),directory);
if(existsSync(demoFile)||existsSync(credentialFile)){
  assert(existsSync(demoFile)&&existsSync(credentialFile),'Estado DEMO parcial: requiere revisión manual');
  console.log('F02.5 DEMO TEST ya preparada; no se repite BOOT-01.');
  process.exit(0);
}
const adminSecret=readFileSync(new URL('postgres-password.txt',directory),'utf8').trim();
assert.match(adminSecret,/^[a-f0-9]{64}$/);
function url(role,password){const value=new URL(`postgresql://127.0.0.1:55431/${database}`);
  value.username=role;value.password=password;return value.toString();}
const admin=new Client({connectionString:url('f01_migrator',adminSecret)});
await admin.connect();
try{
  await assertF025ConnectedTarget(admin,database);
  const suffix=database.slice(-12);
  const roles={};
  for(const [kind,group] of [['auth','f01_auth'],['runtime','f01_runtime']]){
    const role=`ff_f025_${kind}_${suffix}`,password=randomBytes(32).toString('hex');
    assert.match(role,/^ff_f025_(auth|runtime)_[a-f0-9]{12}$/);
    await admin.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB
      NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
    await admin.query(`GRANT ${group} TO "${role}"`);
    roles[kind]=url(role,password);
  }
  const reviewerPassword=`${randomBytes(24).toString('base64url')}Aa1!`;
  const reviewerEmail=`f025-reviewer-${suffix}@example.invalid`;
  const approval=randomUUID(),correlation=randomUUID();
  const reason='Revisor único TEST DEMO F02.5 aprobado por responsable del proyecto';
  const document={kind:'F025_TEST_REVIEWER_ONLY',database,operation:'INITIAL_PLATFORM_ADMIN',
    reason,approvalId:approval,correlationId:correlation};
  const integrity=createHash('sha256').update(JSON.stringify(document)).digest('hex');
  const hasher=new Argon2PasswordHasher();
  await admin.query('BEGIN');
  try{
    const reviewer=(await admin.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
      VALUES($1,$2) RETURNING id`,[reviewerEmail,await hasher.hash(reviewerPassword)])).rows[0].id;
    await admin.query('SET LOCAL ROLE f01_bootstrap_executor');
    await admin.query(`SELECT f01.record_privileged_approval($1,'INITIAL_PLATFORM_ADMIN',$2,
      NULL,'ADMINISTRADOR_PLATAFORMA',$3,now()+interval '1 hour',$4)`,
      [approval,reviewer,reason,integrity]);
    await admin.query('SELECT f01.execute_initial_bootstrap($1,$2,$3)',
      [approval,`f025-test-${randomBytes(12).toString('hex')}`,correlation]);
    await admin.query('SET LOCAL ROLE f01_migrator');
    for(const capability of ['F025_APPLICATION_READ','F025_APPLICATION_REVIEW',
      'F025_DOCUMENT_READ','F025_APPLICATION_DECIDE','F025_PHARMACY_ACTIVATE']){
      await admin.query(`INSERT INTO f025.platform_capability_grant(actor_id,capability_code,
        approval_id,approval_sha256,reason) VALUES($1,$2,$3,$4,$5)`,
        [reviewer,capability,randomUUID(),integrity,reason]);
    }
    await admin.query('COMMIT');
  }catch(error){await admin.query('ROLLBACK');throw error;}
  const appState={kind:'F025_TEST_DEMO_ONLY',database,roles,
    csrfKey:randomBytes(32).toString('hex'),abuseKey:randomBytes(32).toString('hex'),
    reviewerApproval:approval};
  writeFileSync(credentialFile,JSON.stringify({reviewer:{email:reviewerEmail,
    password:reviewerPassword}},null,2),{flag:'wx',mode:0o600});
  writeFileSync(demoFile,JSON.stringify(appState,null,2),{flag:'wx',mode:0o600});
  console.log('F02.5 DEMO TEST: revisor único provisionado; cero farmacias e inventarios precargados.');
  console.log(`Credenciales: .cache/f025-docker/${localStateName('credentials.local.json')} (ignorado por Git).`);
}finally{await admin.end();}
