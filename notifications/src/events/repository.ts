import type {Pool,PoolClient} from 'pg';import type {NotificationEvent} from './contract.js';
export type Acceptance='NEW'|'REPLAY'|'CONFLICT';
export interface EventRepository{accept(event:NotificationEvent,fingerprint:string,now:Date):Promise<Acceptance>}
export class PgEventRepository implements EventRepository{
  constructor(private readonly pool:Pool){}
  async accept(event:NotificationEvent,hash:string,now:Date):Promise<Acceptance>{const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('SET LOCAL ROLE f05_notifications_runtime');await client.query("SELECT set_config('app.farmacia_id',$1,true)",[event.pharmacyId]);
    const existing=await client.query('SELECT huella FROM f05.recepcion_evento WHERE evento_id=$1',[event.eventId]);if(existing.rows.length){if(existing.rows[0].huella!==hash)await client.query('INSERT INTO f05.conflicto_evento(evento_id,farmacia_id,huella_recibida,ocurrido_en) VALUES($1,$2,$3,$4)',[event.eventId,event.pharmacyId,hash,now]);await client.query('COMMIT');return existing.rows[0].huella===hash?'REPLAY':'CONFLICT';}
    await client.query("INSERT INTO f05.recepcion_evento(evento_id,farmacia_id,tipo,version,huella,correlacion_id,estado,recibido_en,actualizado_en) VALUES($1,$2,$3,1,$4,$5,'RECIBIDO',$6,$6)",[event.eventId,event.pharmacyId,event.type,hash,event.correlationId,now]);
    const started=now;await client.query("INSERT INTO f05.entrega_local(evento_id,farmacia_id,tipo,estado_reserva,correlacion_id,entregado_en) VALUES($1,$2,$3,$4,$5,$6)",[event.eventId,event.pharmacyId,event.type,event.payload.state,event.correlationId,now]);
    await client.query("INSERT INTO f05.intento_entrega(evento_id,farmacia_id,numero,resultado,latencia_ms,iniciado_en,finalizado_en) VALUES($1,$2,1,'EXITO',0,$3,$3)",[event.eventId,event.pharmacyId,started]);
    await client.query("UPDATE f05.recepcion_evento SET estado='ENTREGADO',actualizado_en=$2 WHERE evento_id=$1",[event.eventId,now]);await client.query('COMMIT');return'NEW';
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
}
export class MemoryEventRepository implements EventRepository{private readonly values=new Map<string,string>();async accept(event:NotificationEvent,hash:string):Promise<Acceptance>{const old=this.values.get(event.eventId);if(old)return old===hash?'REPLAY':'CONFLICT';this.values.set(event.eventId,hash);return'NEW';}}
