import {randomUUID} from 'node:crypto';import type {Pool} from 'pg';
import type {OutboxClaim} from '../domain/notification-event.js';import type {OutboxRepository} from '../application/ports.js';
export class PgOutboxRepository implements OutboxRepository{
  constructor(private readonly pool:Pool){}
  async queueStats(now:Date){const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('SET LOCAL ROLE f05_outbox_publisher');const result=await client.query(`SELECT count(*)::int pending,COALESCE(sum(intentos),0)::int attempts,COALESCE((EXTRACT(EPOCH FROM ($1-min(creado_en)))*1000)::bigint,0) oldest_age_ms FROM f04.outbox_evento WHERE estado_publicacion IN ('PENDIENTE','REINTENTO')`,[now]);await client.query('COMMIT');return{pending:result.rows[0].pending,attempts:result.rows[0].attempts,oldestAgeMs:Number(result.rows[0].oldest_age_ms)};}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
  async claim(now:Date,batch:number,leaseSeconds:number):Promise<OutboxClaim[]>{
    const client=await this.pool.connect();const claimId=randomUUID();
    try{await client.query('BEGIN');await client.query('SET LOCAL ROLE f05_outbox_publisher');
      const result=await client.query(`WITH candidates AS (
        SELECT o.id FROM f04.outbox_evento o WHERE o.estado_publicacion IN ('PENDIENTE','REINTENTO')
        AND o.proximo_intento_en<=$1 AND (o.reclamado_hasta IS NULL OR o.reclamado_hasta<=$1)
        AND NOT EXISTS(SELECT 1 FROM f04.outbox_evento earlier WHERE earlier.reserva_id=o.reserva_id
          AND (earlier.creado_en,earlier.id)<(o.creado_en,o.id) AND earlier.estado_publicacion<>'PUBLICADO')
        ORDER BY o.creado_en,o.id FOR UPDATE SKIP LOCKED LIMIT $2)
        UPDATE f04.outbox_evento o SET reclamo_id=$3,reclamado_hasta=$1+($4||' seconds')::interval,
          intentos=o.intentos+1 FROM candidates c WHERE o.id=c.id
        RETURNING o.id,o.farmacia_id,o.reserva_id,o.tipo,o.payload,o.correlacion_id,o.creado_en,o.intentos`,[now,batch,claimId,leaseSeconds]);
      await client.query('COMMIT');
      return result.rows.map(row=>({claimId,envelope:{eventId:row.id,version:1,type:row.tipo,pharmacyId:row.farmacia_id,reservationId:row.reserva_id,correlationId:row.correlacion_id,occurredAt:new Date(row.creado_en).toISOString(),payload:row.payload},attempt:row.intentos}));
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async published(claim:OutboxClaim,now:Date){await this.update(claim,`estado_publicacion='PUBLICADO',publicado_en=$3,proximo_intento_en=NULL,ultimo_error_codigo=NULL`,[now]);}
  async failed(claim:OutboxClaim,now:Date,code:string,next:Date|null){await this.update(claim,`estado_publicacion=$3,proximo_intento_en=$4,ultimo_error_codigo=$5`,[next?'REINTENTO':'BLOQUEADO',next,code]);}
  private async update(claim:OutboxClaim,set:string,values:unknown[]){const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('SET LOCAL ROLE f05_outbox_publisher');const result=await client.query(`UPDATE f04.outbox_evento SET ${set},reclamo_id=NULL,reclamado_hasta=NULL WHERE id=$1 AND reclamo_id=$2`,[claim.envelope.eventId,claim.claimId,...values]);if(result.rowCount!==1)throw new Error('F05: reclamo perdido');await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
}
