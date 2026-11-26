/** Synthetic TEST-only workflow; all rows are rolled back. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Client} from 'pg';
import {assertF025EphemeralDatabase,assertF025ConnectedTarget} from './test-env.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const local=path.join(root,'.cache/f025-docker');
const database=JSON.parse(readFileSync(path.join(local,'state.local.json'),'utf8')).database;
const secret=readFileSync(path.join(local,'postgres-password.txt'),'utf8').trim();
const url=new URL(`postgresql://127.0.0.1:55431/${database}`);
url.username='f01_migrator';url.password=secret;
assertF025EphemeralDatabase(url.toString(),{migration:true});
const client=new Client({connectionString:url.toString()});
await client.connect();
let passed=0;
try{
  await assertF025ConnectedTarget(client,database);
  await client.query('BEGIN');
  const marker=randomBytes(5).toString('hex');
  const users=[];
  for(const key of ['owner','other','admin']){
    const id=(await client.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
      VALUES($1,'$argon2id$synthetic-fixture-only') RETURNING id`,
      [`f025-workflow-${marker}-${key}@example.invalid`])).rows[0].id;
    const fingerprint=randomBytes(32).toString('hex');
    await client.query(`INSERT INTO f01.sesion(usuario_id,token_fingerprint,idle_expires_at,absolute_expires_at)
      VALUES($1,decode($2,'hex'),now()+interval '1 hour',now()+interval '1 day')`,[id,fingerprint]);
    users.push({id,fingerprint});
  }
  await client.query('SET LOCAL ROLE f01_runtime');
  const actor=async user=>{
    await client.query("SELECT set_config('app.actor_user_id',$1,true)",[user.id]);
    await client.query("SELECT set_config('app.session_fingerprint',$1,true)",[user.fingerprint]);
  };
  await actor(users[0]);
  const request=(await client.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,contacto,
    direccion,departamento,provincia,distrito,representante)
    VALUES($1,$2,'Contacto TEST','Dirección TEST','Lima','Lima','Lima','Representante TEST')
    RETURNING id`,[users[0].id,`Farmacia Workflow ${marker}`])).rows[0].id;
  assert.ok(request);passed++;
  const edited=await client.query(`SELECT f025.edit_application($1,1,$2,$3,$4,$5,$6,$7,$8,$9)
    AS version`,[request,`Farmacia Workflow ${marker} Editada`,'Contacto TEST','Dirección TEST',
      'Lima','Lima','Lima','Representante TEST',null]);
  assert.equal(edited.rows[0].version,2);passed++;
  const sent=await client.query("SELECT * FROM f025.change_application($1,2,'ENVIAR',NULL,$2)",
    [request,randomUUID()]);
  assert.equal(sent.rows[0].new_state,'PENDIENTE');passed++;
  const duplicate=(await client.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,contacto,
    direccion,departamento,provincia,distrito,representante)
    VALUES($1,$2,'Contacto TEST','Dirección TEST','Lima','Lima','Lima','Representante TEST')
    RETURNING id`,[users[0].id,`Farmacia Workflow ${marker} Editada`])).rows[0].id;
  await client.query('SAVEPOINT duplicate_submit');
  await assert.rejects(client.query("SELECT * FROM f025.change_application($1,1,'ENVIAR',NULL,$2)",
    [duplicate,randomUUID()]),error=>error.code==='23505');passed++;
  await client.query('ROLLBACK TO SAVEPOINT duplicate_submit');
  const cancelled=await client.query("SELECT * FROM f025.change_application($1,1,'CANCELAR',NULL,$2)",
    [duplicate,randomUUID()]);
  assert.equal(cancelled.rows[0].new_state,'CANCELADA');passed++;
  await client.query('SAVEPOINT cancelled_resend');
  await assert.rejects(client.query("SELECT * FROM f025.change_application($1,2,'REENVIAR',NULL,$2)",
    [duplicate,randomUUID()]),error=>error.code==='42501');passed++;
  await client.query('ROLLBACK TO SAVEPOINT cancelled_resend');
  await client.query('SET LOCAL ROLE f01_migrator');
  assert.equal(Number((await client.query('SELECT count(*) AS count FROM f025.outbox_evento WHERE solicitud_id=$1',
    [request])).rows[0].count),1);passed++;
  await client.query('SET LOCAL ROLE f01_runtime');
  await actor(users[1]);
  assert.equal(Number((await client.query('SELECT count(*) AS count FROM f025.solicitud WHERE id=$1',
    [request])).rows[0].count),0);passed++;
  await client.query('SAVEPOINT denied');
  await assert.rejects(client.query("SELECT * FROM f025.change_application($1,3,'CANCELAR',NULL,$2)",
    [request,randomUUID()]),error=>error.code==='42501');passed++;
  await client.query('ROLLBACK TO SAVEPOINT denied');
  await client.query('SAVEPOINT other_edit');
  await assert.rejects(client.query(`SELECT f025.edit_application($1,3,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [request,'Farmacia Ajena','Contacto TEST','Dirección TEST','Lima','Lima','Lima',
      'Representante TEST',null]),error=>error.code==='42501');passed++;
  await client.query('ROLLBACK TO SAVEPOINT other_edit');
  await client.query('SAVEPOINT private_outbox');
  await assert.rejects(client.query('SELECT count(*) FROM f025.outbox_evento'),
    error=>error.code==='42501');passed++;
  await client.query('ROLLBACK TO SAVEPOINT private_outbox');
  await client.query('SET LOCAL ROLE f01_migrator');
  const approval=randomUUID();
  await client.query(`INSERT INTO f01.privileged_approval(id,operation,target_usuario_id,role_code,
    reason,expires_at,integrity_hash) VALUES($1,'INITIAL_PLATFORM_ADMIN',$2,
    'ADMINISTRADOR_PLATAFORMA','Fixture sintético TEST',now()+interval '1 hour',$3)`,
    [approval,users[2].id,'a'.repeat(64)]);
  await client.query(`INSERT INTO f01.platform_role_assignment(usuario_id,role_code,approval_id)
    VALUES($1,'ADMINISTRADOR_PLATAFORMA',$2)`, [users[2].id,approval]);
  for(const capability of ['F025_APPLICATION_READ','F025_APPLICATION_REVIEW',
    'F025_APPLICATION_DECIDE','F025_PHARMACY_ACTIVATE']){
    await client.query(`INSERT INTO f025.platform_capability_grant(actor_id,capability_code,
      approval_id,approval_sha256,reason) VALUES($1,$2,$3,$4,'Fixture sintético TEST')`,
      [users[2].id,capability,randomUUID(),'b'.repeat(64)]);
  }
  await client.query('SET LOCAL ROLE f01_runtime');
  await actor(users[2]);
  const listed=await client.query('SELECT * FROM f025.list_applications(NULL,20)');
  assert.ok(listed.rows.some(row=>row.id===request));passed++;
  const ownAdminRequest=(await client.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,
    contacto,direccion,departamento,provincia,distrito,representante)
    VALUES($1,$2,'Contacto TEST','Direccion TEST','Lima','Lima','Lima','Representante TEST')
    RETURNING id`,[users[2].id,`Farmacia Revisor ${marker}`])).rows[0].id;
  await client.query("SELECT * FROM f025.change_application($1,1,'ENVIAR',NULL,$2)",
    [ownAdminRequest,randomUUID()]);
  await client.query('SAVEPOINT self_review');
  await assert.rejects(client.query("SELECT * FROM f025.change_application($1,2,'INICIAR_REVISION','Motivo TEST',$2)",
    [ownAdminRequest,randomUUID()]),error=>error.code==='42501');passed++;
  await client.query('ROLLBACK TO SAVEPOINT self_review');
  const detail=await client.query('SELECT * FROM f025.read_application($1)',[request]);
  assert.equal(detail.rows[0].solicitante_id,users[0].id);passed++;
  const reviewed=await client.query(`SELECT * FROM f025.change_application(
    $1,3,'INICIAR_REVISION','Revisión TEST',$2)`, [request,randomUUID()]);
  assert.equal(reviewed.rows[0].new_state,'EN_REVISION');passed++;
  await actor(users[0]);
  const reviewCancellation=(await client.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,
    contacto,direccion,departamento,provincia,distrito,representante)
    VALUES($1,$2,'Contacto TEST','Direccion TEST','Lima','Lima','Lima','Representante TEST')
    RETURNING id`,[users[0].id,`Farmacia Cancelable ${marker}`])).rows[0].id;
  await client.query("SELECT * FROM f025.change_application($1,1,'ENVIAR',NULL,$2)",
    [reviewCancellation,randomUUID()]);
  await actor(users[2]);
  const secondReview=await client.query("SELECT * FROM f025.change_application($1,2,'INICIAR_REVISION',NULL,$2)",
    [reviewCancellation,randomUUID()]);
  assert.equal(secondReview.rows[0].new_state,'EN_REVISION');passed++;
  await actor(users[0]);
  const cancelledInReview=await client.query("SELECT * FROM f025.change_application($1,3,'CANCELAR',NULL,$2)",
    [reviewCancellation,randomUUID()]);
  assert.equal(cancelledInReview.rows[0].new_state,'CANCELADA');passed++;
  await actor(users[2]);
  await client.query('SAVEPOINT cancelled_review');
  await assert.rejects(client.query("SELECT * FROM f025.change_application($1,4,'RECHAZAR','Motivo de prueba',$2)",
    [reviewCancellation,randomUUID()]),error=>error.code==='42501');passed++;
  await client.query('ROLLBACK TO SAVEPOINT cancelled_review');
  await actor(users[0]);
  const resubmission=(await client.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,
    contacto,direccion,departamento,provincia,distrito,representante)
    VALUES($1,$2,'Contacto TEST','Direccion TEST','Lima','Lima','Lima','Representante TEST')
    RETURNING id`,[users[0].id,`Farmacia Reenvio ${marker}`])).rows[0].id;
  const initialSend=await client.query("SELECT * FROM f025.change_application($1,1,'ENVIAR',NULL,$2)",
    [resubmission,randomUUID()]);
  assert.equal(initialSend.rows[0].new_state,'PENDIENTE');passed++;
  await actor(users[2]);
  const reviewForResend=await client.query("SELECT * FROM f025.change_application($1,2,'INICIAR_REVISION','Revision TEST',$2)",
    [resubmission,randomUUID()]);
  assert.equal(reviewForResend.rows[0].new_state,'EN_REVISION');passed++;
  const observed=await client.query("SELECT * FROM f025.change_application($1,3,'OBSERVAR','Correccion TEST',$2)",
    [resubmission,randomUUID()]);
  assert.equal(observed.rows[0].new_state,'OBSERVADA');passed++;
  await actor(users[0]);
  const resent=await client.query("SELECT * FROM f025.change_application($1,4,'REENVIAR',NULL,$2)",
    [resubmission,randomUUID()]);
  assert.equal(resent.rows[0].new_state,'PENDIENTE');passed++;
  await client.query('SET LOCAL ROLE f01_migrator');
  const recorded=(await client.query(`SELECT accion,estado_anterior,estado_nuevo,actor_id,motivo,occurred_at
    FROM f025.revision WHERE solicitud_id=$1 AND accion IN ('INICIAR_REVISION','OBSERVAR')
    ORDER BY occurred_at`,[resubmission])).rows;
  assert.equal(recorded.length,2);
  assert(recorded.every(row=>row.actor_id===users[2].id));
  assert(recorded.every(row=>typeof row.motivo==='string'&&row.motivo.length>0));
  assert(recorded.every(row=>row.occurred_at instanceof Date));
  assert(recorded.every(row=>!JSON.stringify(row).includes(users[2].fingerprint)));passed++;
  await client.query('SET LOCAL ROLE f01_runtime');
  await actor(users[2]);
  const activated=await client.query('SELECT * FROM f025.activate_application($1,4,$2,$3,$4)',
    [request,`test-${randomBytes(12).toString('hex')}`,'Aprobación sintética TEST',randomUUID()]);
  assert.equal(activated.rows.length,1);passed++;
  const publicRow=await client.query('SELECT farmacia_id FROM f03.get_public_pharmacy($1)',
    [activated.rows[0].activated_farmacia_id]);
  assert.equal(publicRow.rows[0]?.farmacia_id,activated.rows[0].activated_farmacia_id);passed++;
  await client.query('SET LOCAL ROLE f01_migrator');
  const delegated=await client.query(`SELECT capacidad FROM f01.delegacion
    WHERE membresia_id=$1 ORDER BY capacidad`,[activated.rows[0].owner_membership_id]);
  assert.deepEqual(delegated.rows.map(row=>row.capacidad),[
    'inventory.history','inventory.import.confirm','inventory.import.preview',
    'inventory.read','inventory.write','membership.manage','pharmacy.profile.read','pharmacy.profile.write',
    'reservation.accept','reservation.deliver',
    'reservation.read','reservation.settings']);passed++;
  await client.query('SET LOCAL ROLE f01_runtime');
  await actor(users[0]);
  assert.equal((await client.query('SELECT capacidad FROM f01.delegacion')).rows.length,12);passed++;
  await client.query("SELECT set_config('app.farmacia_id',$1,true)",
    [activated.rows[0].activated_farmacia_id]);
  assert.equal((await client.query("SELECT f02.can_inventory_action($1,'inventory.import.confirm') AS allowed",
    [activated.rows[0].activated_farmacia_id])).rows[0].allowed,true);passed++;
  assert.equal((await client.query("SELECT f04.can_reservation_action($1,'reservation.read') AS allowed",
    [activated.rows[0].activated_farmacia_id])).rows[0].allowed,true);passed++;
  await actor(users[1]);
  assert.equal((await client.query('SELECT capacidad FROM f01.delegacion')).rows.length,0);passed++;
  assert.equal((await client.query("SELECT f02.can_inventory_action($1,'inventory.read') AS allowed",
    [activated.rows[0].activated_farmacia_id])).rows[0].allowed,false);passed++;
  assert.equal((await client.query("SELECT f04.can_reservation_action($1,'reservation.read') AS allowed",
    [activated.rows[0].activated_farmacia_id])).rows[0].allowed,false);passed++;
  await actor(users[2]);
  assert.equal(Number((await client.query('SELECT count(*) AS count FROM f02.inventario')).rows[0].count),0);
  passed++;
  // F025-FR-029: solo el dueño de la activación recibe membership.manage; reparación repetible.
  const pharmacy=activated.rows[0].activated_farmacia_id,owner=activated.rows[0].owner_membership_id;
  await client.query('SET LOCAL ROLE f01_migrator');
  const worker=(await client.query(`INSERT INTO f01.usuario_farmacia(usuario_id,farmacia_id,rol)
    VALUES($1,$2,'TRABAJADOR') RETURNING id`,[users[1].id,pharmacy])).rows[0].id;
  const manage=async()=>(await client.query(`SELECT m.rol,d.estado FROM f01.delegacion d
    JOIN f01.usuario_farmacia m ON m.id=d.membresia_id WHERE d.capacidad='membership.manage'
    AND d.farmacia_id=$1 ORDER BY 1`,[pharmacy])).rows.map(row=>`${row.rol}/${row.estado}`);
  assert.deepEqual(await manage(),['DUENO/ACTIVA']);passed++;
  assert.equal(Number((await client.query(`SELECT count(*) FROM f01.delegacion d
    JOIN f01.usuario_farmacia m ON m.id=d.membresia_id WHERE m.usuario_id=$1`,[users[2].id])).rows[0].count),0);passed++;
  await client.query('SAVEPOINT executor_worker');
  await client.query('SET LOCAL ROLE f025_activation_executor');
  await actor(users[2]);
  await client.query("SELECT set_config('app.f025_application_id',$1,true)",[request]);
  await assert.rejects(client.query(`INSERT INTO f01.delegacion(membresia_id,farmacia_id,capacidad,estado,
    granted_by_usuario_id) VALUES($1,$2,'membership.manage','ACTIVA',$3)`,[worker,pharmacy,users[2].id]),
    error=>error.code==='42501');passed++;
  await client.query('ROLLBACK TO SAVEPOINT executor_worker');
  await client.query('SET LOCAL ROLE f01_migrator');
  const repair=readFileSync(path.join(root,'backend/migrations/f025/016_owner_staff_manage_test.sql'),'utf8')
    .replaceAll('\r\n','\n').match(/DO \$repair\$[\s\S]*?END \$repair\$;/)[0];
  const audits=async()=>Number((await client.query(`SELECT count(*) FROM f01.auditoria_identidad
    WHERE accion='CAPABILITY_GRANT' AND actor_usuario_id IS NULL AND farmacia_id=$1`,[pharmacy])).rows[0].count);
  await client.query(`DELETE FROM f01.delegacion WHERE membresia_id=$1 AND capacidad IN
    ('membership.manage','pharmacy.profile.read')`,[owner]);
  await client.query(`UPDATE f01.delegacion SET estado='REVOCADA',revoked_at=now() WHERE membresia_id=$1
    AND capacidad='pharmacy.profile.write'`,[owner]);
  await client.query(repair);
  const after=(await client.query(`SELECT capacidad,estado,granted_by_usuario_id FROM f01.delegacion
    WHERE membresia_id=$1 AND capacidad IN ('membership.manage','pharmacy.profile.read','pharmacy.profile.write')
    ORDER BY 1`,[owner])).rows;
  assert.deepEqual(after.map(row=>`${row.capacidad}/${row.estado}`),
    ['membership.manage/ACTIVA','pharmacy.profile.read/ACTIVA','pharmacy.profile.write/REVOCADA']);passed++;
  assert(after.every(row=>row.granted_by_usuario_id===users[2].id));passed++;
  assert.equal(await audits(),2);passed++;
  await client.query(repair);
  assert.equal(await audits(),2);passed++;
  assert.deepEqual(await manage(),['DUENO/ACTIVA']);passed++;
  console.log(JSON.stringify({cluster:'farmafind-f025-test',database,passed,rolledBack:true}));
}finally{await client.query('ROLLBACK');await client.end();}
