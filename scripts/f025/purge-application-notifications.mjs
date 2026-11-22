/** Optional bounded TEST maintenance: only F02.5 local notification rows older than retention. */
import {readFileSync,existsSync} from 'node:fs';
import {Client} from 'pg';

const raw=process.env.F025_RETENTION_DATABASE_URL;
const days=Number(process.env.F025_NOTIFICATION_RETENTION_DAYS??'30');
if(!raw||!Number.isInteger(days)||days<1||days>365)
  throw new Error('F02.5: destino TEST y retención de 1–365 días requeridos');
const target=new URL(raw);
if(!['postgres:','postgresql:'].includes(target.protocol)||target.hostname!=='127.0.0.1'||
  target.port!=='55431'||!/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(target.pathname)||
  target.username!=='f01_migrator'||!target.password||target.search||target.hash)
  throw new Error('F02.5: mantenimiento solo en base efímera TEST local');
const manual='.cache/f025-docker/state.manual.local.json';
if(existsSync(manual)&&JSON.parse(readFileSync(manual,'utf8')).database===target.pathname.slice(1))
  throw new Error('F02.5: base de demostración manual excluida del mantenimiento automático');
const db=new Client({connectionString:raw});
await db.connect();
try{
  const id=(await db.query(`SELECT current_database() database,current_setting('cluster_name') cluster,
    (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
      WHERE datname=current_database())) marker`)).rows[0];
  if(id?.database!==target.pathname.slice(1)||id.cluster!=='farmafind-f025-test'||
    id.marker!=='FarmaFind F07 TEST efimera')
    throw new Error('F02.5: marca de base TEST inválida');
  await db.query('BEGIN');
  try{
    const cutoff=new Date(Date.now()-days*86400000);
    const rows=await db.query(`SELECT evento_id FROM f05.recepcion_solicitud_evento
      WHERE recibido_en<$1 FOR UPDATE`,[cutoff]);
    const ids=rows.rows.map(row=>row.evento_id);
    if(ids.length){
      await db.query('DELETE FROM f05.intento_solicitud WHERE evento_id=ANY($1::uuid[])',[ids]);
      await db.query('DELETE FROM f05.entrega_solicitud_local WHERE evento_id=ANY($1::uuid[])',[ids]);
      await db.query('DELETE FROM f05.recepcion_solicitud_evento WHERE evento_id=ANY($1::uuid[])',[ids]);
    }
    await db.query('COMMIT');
    console.log(JSON.stringify({database:id.database,retentionDays:days,expiredReceipts:ids.length,
      scope:'f05 application notifications only'}));
  }catch(error){await db.query('ROLLBACK');throw error;}
}finally{await db.end();}
