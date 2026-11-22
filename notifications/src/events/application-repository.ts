import type {Pool} from 'pg';
import type {ApplicationNotificationEvent} from './application-contract.js';
import type {Acceptance} from './repository.js';

export interface ApplicationEventRepository {
  accept(event:ApplicationNotificationEvent,hash:string,now:Date):Promise<Acceptance>;
}
export class PgApplicationEventRepository implements ApplicationEventRepository {
  constructor(private readonly pool:Pool,private readonly retentionDays=30){
    if(!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>365)
      throw new Error('F02.5: retención TEST inválida');
  }
  async accept(event:ApplicationNotificationEvent,hash:string,now:Date):Promise<Acceptance>{
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE f05_notifications_runtime');
      const target=await client.query(`SELECT current_database() database,
        current_setting('cluster_name') cluster,
        (SELECT description FROM pg_shdescription WHERE objoid=(SELECT oid FROM pg_database
          WHERE datname=current_database())) marker`);
      if(!/^farmafind_f01_test_[a-f0-9]{12}$/.test(String(target.rows[0]?.database))||
        target.rows[0]?.cluster!=='farmafind-f025-test'||
        target.rows[0]?.marker!=='FarmaFind F07 TEST efimera')
        throw new Error('F02.5: receptor solo en base TEST aislada');
      await client.query("SELECT set_config('app.f05_recipient_id',$1,true)",[event.payload.recipientUserId]);
      const old=await client.query(`SELECT huella FROM f05.recepcion_solicitud_evento WHERE evento_id=$1`,[event.eventId]);
      if(old.rows.length){
        await client.query('COMMIT');
        return old.rows[0].huella===hash?'REPLAY':'CONFLICT';
      }
      const sameLogical=await client.query(`SELECT evento_id FROM f05.recepcion_solicitud_evento
        WHERE solicitud_id=$1 AND tipo=$2 AND version_solicitud=$3 AND destinatario_usuario_id=$4`,
      [event.payload.applicationId,event.type,event.payload.applicationVersion,event.payload.recipientUserId]);
      if(sameLogical.rows.length){await client.query('COMMIT');return'CONFLICT';}
      await client.query(`INSERT INTO f05.recepcion_solicitud_evento
        (evento_id,solicitud_id,destinatario_usuario_id,tipo,version_solicitud,huella,
         correlation_id,estado,recibido_en,actualizado_en)
        VALUES($1,$2,$3,$4,$5,$6,$7,'RECIBIDO',$8,$8)`,
      [event.eventId,event.payload.applicationId,event.payload.recipientUserId,event.type,
        event.payload.applicationVersion,hash,event.correlationId,now]);
      await client.query(`INSERT INTO f05.entrega_solicitud_local
        (evento_id,destinatario_usuario_id,tipo,correlation_id,entregado_en)
        VALUES($1,$2,$3,$4,$5)`,[event.eventId,event.payload.recipientUserId,
        event.type,event.correlationId,now]);
      await client.query(`INSERT INTO f05.intento_solicitud(evento_id,destinatario_usuario_id,
        numero,resultado,ocurrido_en) VALUES($1,$2,1,'EXITO',$3)`,
      [event.eventId,event.payload.recipientUserId,now]);
      await client.query(`UPDATE f05.recepcion_solicitud_evento SET estado='ENTREGADO',actualizado_en=$2
        WHERE evento_id=$1`,[event.eventId,now]);
      const cutoff=new Date(now.getTime()-this.retentionDays*86400000);
      for(const table of ['intento_solicitud','entrega_solicitud_local'])
        await client.query(`DELETE FROM f05.${table} WHERE destinatario_usuario_id=$1
          AND evento_id IN (SELECT evento_id FROM f05.recepcion_solicitud_evento
          WHERE destinatario_usuario_id=$1 AND recibido_en<$2)`,[event.payload.recipientUserId,cutoff]);
      await client.query(`DELETE FROM f05.recepcion_solicitud_evento
        WHERE destinatario_usuario_id=$1 AND recibido_en<$2`,[event.payload.recipientUserId,cutoff]);
      await client.query('COMMIT');
      return'NEW';
    }catch(error){
      await client.query('ROLLBACK');
      if((error as {code?:string})?.code==='23505')return'CONFLICT';
      throw error;
    }
    finally{client.release();}
  }
}
export class MemoryApplicationEventRepository implements ApplicationEventRepository {
  private readonly events=new Map<string,string>();
  private readonly logical=new Set<string>();
  async accept(event:ApplicationNotificationEvent,hash:string):Promise<Acceptance>{
    const old=this.events.get(event.eventId);
    if(old)return old===hash?'REPLAY':'CONFLICT';
    const key=[event.payload.applicationId,event.type,event.payload.applicationVersion,
      event.payload.recipientUserId].join(':');
    if(this.logical.has(key))return'CONFLICT';
    this.events.set(event.eventId,hash);this.logical.add(key);return'NEW';
  }
}
