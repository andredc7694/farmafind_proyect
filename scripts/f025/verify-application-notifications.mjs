/** F02.5/F05 real Outbox integration on one owned, marked, disposable TEST child. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Client,Pool} from 'pg';
import {createApp} from '../../notifications/dist/app.js';
import {PgApplicationEventRepository} from '../../notifications/dist/events/application-repository.js';
import {MemoryEventRepository} from '../../notifications/dist/events/repository.js';
import {ProcessEvent} from '../../notifications/dist/events/process-event.js';
import {PgApplicationOutbox,HttpApplicationEventTransport,PublishApplicationOutbox}
  from '../../backend/dist/modules/notificaciones/infrastructure/application-outbox-publisher.js';
import {migrateTestDatabase} from '../../backend/dist/modules/usuarios/infrastructure/db/migrate.js';
import {migrateF02TestDatabase} from '../../backend/dist/modules/inventario/infrastructure/migrate.js';
import {migrateF03TestDatabase,migrateF07TestDatabase} from '../../backend/dist/modules/busqueda/infrastructure/migrate.js';
import {migrateF04TestDatabase} from '../../backend/dist/modules/reservas/infrastructure/migrate.js';
import {migrateF05TestDatabase} from '../../backend/dist/modules/notificaciones/infrastructure/migrate.js';
import {migrateF025TestDatabase} from '../../backend/dist/modules/farmacias/infrastructure/migrate-f025.js';

const password=readFileSync('.cache/f025-docker/postgres-password.txt','utf8').trim();
assert.match(password,/^[a-f0-9]{64}$/i);
const suffix=randomBytes(6).toString('hex'),database=`farmafind_f01_test_${suffix}`;
const rolePub=`f025_pub_${suffix}`,roleRecv=`f025_recv_${suffix}`;
const marker='FarmaFind F07 TEST efimera',secret=randomBytes(32).toString('hex');
const url=(db,role='f01_migrator',pass=password)=>{
  const value=new URL(`postgresql://127.0.0.1:55431/${db}`);
  value.username=role;value.password=pass;return value.toString();
};
const connect=async address=>{const c=new Client({connectionString:address});await c.connect();return c;};
const admin=await connect(url('farmafind_f025_cluster'));
let dbCreated=false,roleCreated=false,publisherPool,receiverPool,server;
const check=(name,result)=>{assert.ok(result,name);checks.push(name);};
const checks=[];
try{
  const cluster=(await admin.query("SELECT current_setting('cluster_name') cluster,current_user role")).rows[0];
  check('Clúster TEST aislado',cluster.cluster==='farmafind-f025-test'&&cluster.role==='f01_migrator');
  await admin.query(`CREATE DATABASE "${database}"`);dbCreated=true;
  await admin.query(`COMMENT ON DATABASE "${database}" IS '${marker}'`);
  for(const migrate of [migrateTestDatabase,migrateF02TestDatabase,migrateF03TestDatabase,
    migrateF04TestDatabase,migrateF05TestDatabase,migrateF07TestDatabase,migrateF025TestDatabase])
    await migrate(url(database),connect);
  const source=await connect(url(database));
  let applicationId,eventId;
  try{
    const actor=(await source.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
      VALUES($1,'$argon2id$fixture-only') RETURNING id`,[`f025-outbox-${suffix}@example.invalid`])).rows[0].id;
    applicationId=(await source.query(`INSERT INTO f025.solicitud(solicitante_id,nombre_comercial,
      contacto,direccion,departamento,provincia,distrito,representante)
      VALUES($1,'Farmacia Outbox TEST','Contacto TEST','Dirección TEST','Lima','Lima','Lima',
        'Representante TEST') RETURNING id`,[actor])).rows[0].id;
    eventId=(await source.query(`INSERT INTO f025.outbox_evento(solicitud_id,destinatario_usuario_id,
      tipo,version_solicitud,correlation_id)
      VALUES($1,$2,'SOLICITUD_ENVIADA',1,$3) RETURNING id`,
    [applicationId,actor,randomUUID()])).rows[0].id;
    for(const [role,group] of [[rolePub,'f05_outbox_publisher'],[roleRecv,'f05_notifications_runtime']]){
      await admin.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB
        NOCREATEROLE PASSWORD '${secret}'`);roleCreated=true;
      await admin.query(`GRANT ${group} TO "${role}"`);
    }
    publisherPool=new Pool({connectionString:url(database,rolePub,secret),max:2});
    receiverPool=new Pool({connectionString:url(database,roleRecv,secret),max:2});
    const app=createApp({processor:new ProcessEvent(new MemoryEventRepository(),{now:()=>new Date()}),
      applicationRepository:new PgApplicationEventRepository(receiverPool),secret});
    server=await new Promise(resolve=>{
      const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));
    });
    const endpoint=`http://127.0.0.1:${server.address().port}/internal/v1/pharmacy-application-events`;
    const repository=new PgApplicationOutbox(publisherPool);
    const transport=new HttpApplicationEventTransport(endpoint,secret,3000);
    const config={batchSize:5,leaseSeconds:30,maxAttempts:3,baseDelaySeconds:1,maxDelaySeconds:2};
    const first=await new PublishApplicationOutbox(repository,transport,config).run();
    check('Publicación real una vez',first.claimed===1&&first.published===1);
    const receipt=(await source.query(`SELECT count(*)::int n FROM f05.recepcion_solicitud_evento
      WHERE evento_id=$1`,[eventId])).rows[0].n;
    const delivery=(await source.query(`SELECT count(*)::int n FROM f05.entrega_solicitud_local
      WHERE evento_id=$1`,[eventId])).rows[0].n;
    check('Recepción y entrega local únicas',receipt===1&&delivery===1);
    const second=await new PublishApplicationOutbox(repository,transport,config).run();
    check('Outbox publicado no se reclama de nuevo',second.claimed===0);
    await source.query(`UPDATE f05.recepcion_solicitud_evento
      SET recibido_en=now()-interval '31 days' WHERE evento_id=$1`,[eventId]);
    const other=(await source.query(`INSERT INTO f025.outbox_evento(solicitud_id,destinatario_usuario_id,
      tipo,version_solicitud,correlation_id)
      VALUES($1,$2,'SOLICITUD_OBSERVADA',2,$3) RETURNING id`,
    [applicationId,actor,randomUUID()])).rows[0].id;
    const unavailable=new HttpApplicationEventTransport(
      'http://127.0.0.1:1/internal/v1/pharmacy-application-events',secret,100);
    const failed=await new PublishApplicationOutbox(repository,unavailable,config).run();
    check('Fallo F05 deja solicitud y evento reintentable',failed.retried===1&&
      (await source.query('SELECT estado FROM f025.solicitud WHERE id=$1',[applicationId])).rows[0].estado==='BORRADOR'&&
      (await source.query('SELECT estado FROM f025.outbox_evento WHERE id=$1',[other])).rows[0].estado==='FALLIDO');
    await source.query(`UPDATE f025.outbox_evento SET proximo_intento_en=now() WHERE id=$1`,[other]);
    const recovered=await new PublishApplicationOutbox(repository,transport,config).run();
    check('Recuperación después de fallo',recovered.published===1&&
      (await source.query('SELECT count(*)::int n FROM f05.entrega_solicitud_local WHERE evento_id=$1',[other])).rows[0].n===1);
    check('Retención 30 días elimina solo entrega F02.5 vencida',
      (await source.query('SELECT count(*)::int n FROM f05.recepcion_solicitud_evento WHERE evento_id=$1',[eventId])).rows[0].n===0&&
      (await source.query('SELECT count(*)::int n FROM f05.entrega_solicitud_local WHERE evento_id=$1',[eventId])).rows[0].n===0&&
      (await source.query('SELECT count(*)::int n FROM f04.outbox_evento')).rows[0].n===0);
    console.log(JSON.stringify({checks:checks.length,passed:checks.length,
      postgres:'TEST efímero',outbox:'F02.5 separado de F04',persistentTouched:false}));
  }finally{await source.end();}
}finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(publisherPool)await publisherPool.end();
  if(receiverPool)await receiverPool.end();
  if(dbCreated){
    const row=(await admin.query(`SELECT shobj_description(oid,'pg_database') marker
      FROM pg_database WHERE datname=$1`,[database])).rows[0];
    if(row?.marker!==marker)throw new Error('F02.5: hijo sin marca; no se elimina');
    await admin.query(`DROP DATABASE "${database}"`);
  }
  if(roleCreated){
    for(const role of [rolePub,roleRecv]){
      if((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rows.length)
        await admin.query(`DROP ROLE "${role}"`);
    }
  }
  await admin.end();
}
