import {randomUUID} from 'node:crypto';
interface Client{query(sql:string,values?:unknown[]):Promise<{rows:Array<Record<string,unknown>>}>;release(discard?:boolean):void}
interface Pool{connect():Promise<Client>}
export class PgExpirationWorker {
  constructor(private readonly pool:Pool){}
  async run(now:Date,limit:number):Promise<number>{const client=await this.pool.connect();let begun=false,discard=false;try{await client.query('BEGIN');begun=true;await client.query('SET LOCAL ROLE f04_expiration_worker');const due=await client.query(`SELECT id,farmacia_id,inventario_id,cantidad,estado FROM f04.reserva
      WHERE (estado='PENDIENTE' AND respuesta_expira_en<=$1) OR (estado='CONFIRMADA' AND recogida_expira_en<=$1)
      ORDER BY COALESCE(recogida_expira_en,respuesta_expira_en),id FOR UPDATE SKIP LOCKED LIMIT $2`,[now,limit]);
    for(const row of due.rows){await client.query('UPDATE f02.inventario SET cantidad_comprometida=cantidad_comprometida-$3,version=version+1 WHERE id=$1 AND farmacia_id=$2 AND cantidad_comprometida>=$3',[row.inventario_id,row.farmacia_id,row.cantidad]);const correlation=randomUUID();await client.query("UPDATE f04.reserva SET estado='EXPIRADA',motivo_cierre='VENCIMIENTO' WHERE id=$1",[row.id]);await client.query("INSERT INTO f04.transicion_reserva(reserva_id,farmacia_id,estado_origen,estado_destino,origen,motivo,correlacion_id) VALUES($1,$2,$3,'EXPIRADA','WORKER','VENCIMIENTO',$4)",[row.id,row.farmacia_id,row.estado,correlation]);await client.query("INSERT INTO f04.outbox_evento(farmacia_id,reserva_id,tipo,payload,correlacion_id) VALUES($1,$2,'RESERVA_EXPIRADA',$3,$4) ON CONFLICT(reserva_id,tipo) DO NOTHING",[row.farmacia_id,row.id,JSON.stringify({reservationId:row.id,state:'EXPIRADA'}),correlation]);}
    await client.query('COMMIT');begun=false;return due.rows.length;}catch(e){if(begun)try{await client.query('ROLLBACK');}catch{discard=true}throw e;}finally{client.release(discard);}}
}
