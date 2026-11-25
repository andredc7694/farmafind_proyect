import { createHash, randomUUID } from 'node:crypto';
import type { SqlClient } from '../../usuarios/contracts/tenant.js';
import type { AttentionFilters, AttentionItem, HistoryFilters, HistoryItem, ReservationRepository, ReservationRow } from '../application/ports.js';
import type { ReservationState } from '../domain/reservation.js';
import { pickupExpiration } from '../domain/pickup-window.js';
import type { PickupPreference } from '../domain/pickup-preference.js';

function map(row:Record<string,unknown>):ReservationRow { return {
  id:String(row.id),userId:String(row.usuario_id),pharmacyId:String(row.farmacia_id),inventoryId:String(row.inventario_id),
  medicationId:String(row.medicamento_id),quantity:Number(row.cantidad),state:row.estado as ReservationState,
  responseExpiresAt:(row.respuesta_expira_en as Date).toISOString(),confirmedAt:row.confirmado_en?(row.confirmado_en as Date).toISOString():null,
  pickupExpiresAt:row.recogida_expira_en?(row.recogida_expira_en as Date).toISOString():null,version:Number(row.version),pickupPreference:null,
}; }
/** F04.1: adjunta la preferencia (si existe) leyendo la tabla propia; las políticas RLS deciden qué filas se ven. */
async function withPreferences(client:SqlClient,rows:ReservationRow[]):Promise<ReservationRow[]>{
  if(rows.length===0)return rows;
  const found=await client.query('SELECT reserva_id,tipo,minutos,franja_inicio,franja_fin FROM f04.preferencia_recogida WHERE reserva_id=ANY($1::uuid[])',[rows.map(row=>row.id)]);
  const byId=new Map<string,PickupPreference>();
  for(const row of found.rows)byId.set(String(row.reserva_id),row.tipo==='MINUTOS'?{type:'MINUTES',minutes:Number(row.minutos) as 30|60|120}:{type:'WINDOW',start:(row.franja_inicio as Date).toISOString(),end:(row.franja_fin as Date).toISOString()});
  return rows.map(row=>({...row,pickupPreference:byId.get(row.id)??null}));
}
const columns='id,usuario_id,farmacia_id,inventario_id,medicamento_id,cantidad,estado,respuesta_expira_en,confirmado_en,recogida_expira_en,version';
function keyHash(key:string){return createHash('sha256').update(key).digest('hex');}
function fingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}

const medicationName="m.nombre||' '||m.concentracion||' '||m.presentacion";
const iso=(value:unknown):string=>(value as Date).toISOString();
const optionalIso=(value:unknown):string|null=>value?iso(value):null;

export class PgReservationRepository implements ReservationRepository {
  constructor(private readonly client:SqlClient){}

  async summary(pharmacyId:string){
    const result=await this.client.query(`SELECT
      (count(*) FILTER (WHERE estado='PENDIENTE'))::int AS pendientes,
      (count(*) FILTER (WHERE estado='CONFIRMADA'))::int AS confirmadas,
      (count(*) FILTER (WHERE estado='CONFIRMADA' AND recogida_expira_en>now() AND recogida_expira_en<=now()+interval '60 minutes'))::int AS por_vencer
      FROM f04.reserva WHERE farmacia_id=$1 AND estado IN ('PENDIENTE','CONFIRMADA')`,[pharmacyId]);
    const row=result.rows[0];return {pending:Number(row.pendientes),confirmed:Number(row.confirmadas),expiringSoon:Number(row.por_vencer)};
  }

  /** F04.1: cola de atención. El contexto de farmacia y la política RLS ya delimitan las filas; el filtro explícito es defensa en profundidad. */
  async attention(pharmacyId:string,filters:AttentionFilters):Promise<readonly AttentionItem[]>{
    const params:unknown[]=[pharmacyId];const where=["r.farmacia_id=$1","r.estado IN ('PENDIENTE','CONFIRMADA')"];
    if(filters.state){params.push(filters.state);where.push(`r.estado=$${params.length}`);}
    if(filters.from){params.push(filters.from);where.push(`r.creado_en>=$${params.length}`);}
    if(filters.to){params.push(filters.to);where.push(`r.creado_en<=$${params.length}`);}
    const result=await this.client.query(`SELECT r.id,r.estado,r.cantidad,${medicationName} AS medicamento,r.creado_en,
      COALESCE(r.recogida_expira_en,r.respuesta_expira_en) AS vence FROM f04.reserva r JOIN f02.medicamento m ON m.id=r.medicamento_id
      WHERE ${where.join(' AND ')} ORDER BY COALESCE(r.recogida_expira_en,r.respuesta_expira_en),r.id LIMIT 500`,params);
    const items=result.rows.map(row=>({id:String(row.id),state:row.estado as AttentionItem['state'],quantity:Number(row.cantidad),
      medication:String(row.medicamento),createdAt:iso(row.creado_en),expiresAt:iso(row.vence),pickupPreference:null as AttentionItem['pickupPreference']}));
    const preferences=await this.preferences(items.map(item=>item.id));
    return items.map(item=>({...item,pickupPreference:preferences.get(item.id)??null}));
  }

  private historyQuery(pharmacyId:string,filters:Omit<HistoryFilters,'limit'|'cursor'>&{cursor?:{createdAt:string;id:string}},limit:number){
    const params:unknown[]=[pharmacyId];const where=["r.farmacia_id=$1","r.estado IN ('ENTREGADA','CANCELADA','EXPIRADA')"];
    if(filters.state){params.push(filters.state);where.push(`r.estado=$${params.length}`);}
    if(filters.from){params.push(filters.from);where.push(`r.creado_en>=$${params.length}`);}
    if(filters.to){params.push(filters.to);where.push(`r.creado_en<=$${params.length}`);}
    if(filters.cursor){params.push(filters.cursor.createdAt,filters.cursor.id);where.push(`(r.creado_en,r.id)<($${params.length-1}::timestamptz,$${params.length}::uuid)`);}
    params.push(limit);
    return {sql:`SELECT r.id,r.estado,r.cantidad,${medicationName} AS medicamento,r.creado_en,r.confirmado_en,r.recogida_expira_en,r.motivo_cierre
      FROM f04.reserva r JOIN f02.medicamento m ON m.id=r.medicamento_id WHERE ${where.join(' AND ')} ORDER BY r.creado_en DESC,r.id DESC LIMIT $${params.length}`,params};
  }
  private async historyItems(rows:Array<Record<string,unknown>>):Promise<HistoryItem[]>{
    const preferences=await this.preferences(rows.map(row=>String(row.id)));
    return rows.map(row=>({id:String(row.id),code:String(row.id).slice(0,8),state:row.estado as HistoryItem['state'],quantity:Number(row.cantidad),
      medication:String(row.medicamento),createdAt:iso(row.creado_en),confirmedAt:optionalIso(row.confirmado_en),pickupExpiresAt:optionalIso(row.recogida_expira_en),
      closeReason:(row.motivo_cierre as string|null)??null,pickupPreference:preferences.get(String(row.id))??null}));
  }
  private async preferences(ids:string[]){
    const map=new Map<string,NonNullable<ReservationRow['pickupPreference']>>();if(ids.length===0)return map;
    const found=await this.client.query('SELECT reserva_id,tipo,minutos,franja_inicio,franja_fin FROM f04.preferencia_recogida WHERE reserva_id=ANY($1::uuid[])',[ids]);
    for(const row of found.rows)map.set(String(row.reserva_id),row.tipo==='MINUTOS'?{type:'MINUTES',minutes:Number(row.minutos) as 30|60|120}:{type:'WINDOW',start:iso(row.franja_inicio),end:iso(row.franja_fin)});
    return map;
  }
  async history(pharmacyId:string,filters:HistoryFilters){
    const query=this.historyQuery(pharmacyId,filters,filters.limit+1);
    const result=await this.client.query(query.sql,query.params);
    const more=result.rows.length>filters.limit;const page=more?result.rows.slice(0,filters.limit):result.rows;
    const items=await this.historyItems(page);const last=items[items.length-1];
    return {items,next:more&&last?{createdAt:last.createdAt,id:last.id}:null};
  }
  async exportHistory(pharmacyId:string,filters:Omit<HistoryFilters,'limit'|'cursor'>,max:number){
    const query=this.historyQuery(pharmacyId,filters,max+1);
    const result=await this.client.query(query.sql,query.params);
    const truncated=result.rows.length>max;
    return {rows:await this.historyItems(truncated?result.rows.slice(0,max):result.rows),truncated};
  }

  async create(input:{actorUserId:string;pharmacyId:string;medicationId:string;quantity:number;responseExpiresAt:Date;idempotencyKey:string;preference?:PickupPreference|null}) {
    const hash=keyHash(input.idempotencyKey); const print=fingerprint({...input,preference:input.preference??null});
    const known=await this.client.query("SELECT huella,reserva_id FROM f04.idempotencia WHERE actor_usuario_id=$1 AND operacion='CREATE' AND clave_hash=$2",[input.actorUserId,hash]);
    if(known.rows.length){
      if(known.rows[0].huella!==print) throw new Error('Idempotencia en conflicto');
      const replay=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE id=$1`,[known.rows[0].reserva_id]);
      if(replay.rows.length!==1) throw new Error('Idempotencia incompleta');
      return {reservation:(await withPreferences(this.client,[map(replay.rows[0])]))[0],replay:true};
    }
    const correlation=randomUUID();
    const created=await this.client.query('SELECT f04.reserve_stock($1,$2,$3,$4,$5,$6) AS id',
      [input.actorUserId,input.pharmacyId,input.medicationId,input.quantity,input.responseExpiresAt,correlation]);
    const visible=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE id=$1`,[created.rows[0].id]);
    if(visible.rows.length!==1) throw new Error('Reserva no visible');
    let reservation=map(visible.rows[0]);
    if(input.preference){
      // Misma transacción que reserve_stock: si falla, se revierte toda la creación. No lee ni escribe vencimientos.
      const p=input.preference;
      await this.client.query('INSERT INTO f04.preferencia_recogida(reserva_id,farmacia_id,usuario_id,tipo,minutos,franja_inicio,franja_fin) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [reservation.id,reservation.pharmacyId,input.actorUserId,p.type==='MINUTES'?'MINUTOS':'FRANJA',p.type==='MINUTES'?p.minutes:null,p.type==='WINDOW'?p.start:null,p.type==='WINDOW'?p.end:null]);
      reservation={...reservation,pickupPreference:p};
    }
    await this.client.query("INSERT INTO f04.idempotencia(actor_usuario_id,operacion,clave_hash,huella,reserva_id,resultado) VALUES($1,'CREATE',$2,$3,$4,$5)",
      [input.actorUserId,hash,print,reservation.id,JSON.stringify({id:reservation.id})]);
    return {reservation,replay:false};
  }

  async listOwn(actorUserId:string){const r=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE usuario_id=$1 ORDER BY creado_en DESC,id`,[actorUserId]);return withPreferences(this.client,r.rows.map(map));}
  async findOwn(actorUserId:string,id:string){const r=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE id=$1 AND usuario_id=$2`,[id,actorUserId]);return r.rows.length?(await withPreferences(this.client,[map(r.rows[0])]))[0]:null;}
  async listPharmacy(pharmacyId:string){const r=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE farmacia_id=$1 ORDER BY creado_en,id`,[pharmacyId]);return withPreferences(this.client,r.rows.map(map));}
  async pickupWindow(pharmacyId:string){const r=await this.client.query('SELECT plazo_recogida_horas FROM f04.configuracion_farmacia WHERE farmacia_id=$1',[pharmacyId]);return r.rows.length?Number(r.rows[0].plazo_recogida_horas):4;}
  async savePickupWindow(pharmacyId:string,actorUserId:string,hours:number){await this.client.query(`INSERT INTO f04.configuracion_farmacia(farmacia_id,plazo_recogida_horas,actualizado_por)
    VALUES($1,$2,$3) ON CONFLICT(farmacia_id) DO UPDATE SET plazo_recogida_horas=EXCLUDED.plazo_recogida_horas,actualizado_por=EXCLUDED.actualizado_por,actualizado_en=now()`,[pharmacyId,hours,actorUserId]);return hours;}

  async transition(input:{reservationId:string;pharmacyId:string;actorUserId:string;target:ReservationState;idempotencyKey:string;now:Date;reason?:string;pickupWindowHours?:number}){
    const operation=`TRANSITION:${input.target}:${input.reservationId}`;const hash=keyHash(input.idempotencyKey);const print=fingerprint({target:input.target,reason:input.reason});
    const known=await this.client.query('SELECT huella,reserva_id FROM f04.idempotencia WHERE actor_usuario_id=$1 AND operacion=$2 AND clave_hash=$3',[input.actorUserId,operation,hash]);
    if(known.rows.length){if(known.rows[0].huella!==print)throw new Error('Idempotencia en conflicto');const r=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE id=$1`,[known.rows[0].reserva_id]);if(r.rows.length!==1)throw new Error('No visible');return map(r.rows[0]);}
    const locked=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE id=$1 AND farmacia_id=$2 FOR UPDATE`,[input.reservationId,input.pharmacyId]);
    if(locked.rows.length!==1)throw new Error('No visible');const before=map(locked.rows[0]);
    await this.client.query("SELECT set_config('app.farmacia_id',$1,true)",[before.pharmacyId]);
    if(before.state===input.target)return before;
    const permitted=(before.state==='PENDIENTE'&&['CONFIRMADA','CANCELADA','EXPIRADA'].includes(input.target))||(before.state==='CONFIRMADA'&&['ENTREGADA','CANCELADA','EXPIRADA'].includes(input.target));
    if(!permitted)throw new Error('Transicion no permitida');
    if(input.target==='ENTREGADA'&&(!before.pickupExpiresAt||new Date(before.pickupExpiresAt)<=input.now))throw new Error('Reserva vencida');
    let confirmedAt:Date|null=before.confirmedAt?new Date(before.confirmedAt):null;let pickup:Date|null=before.pickupExpiresAt?new Date(before.pickupExpiresAt):null;
    if(input.target==='CONFIRMADA'){confirmedAt=input.now;pickup=pickupExpiration(input.now,input.pickupWindowHours??4);}
    const correlation=randomUUID();
    if(input.target==='CANCELADA'||input.target==='ENTREGADA'){
      await this.client.query('SELECT f04.close_reservation_stock($1,$2,$3,$4,$5,$6,$7)',
        [input.actorUserId,input.reservationId,input.pharmacyId,input.target,input.reason??null,input.now,correlation]);
    }else if(input.target==='CONFIRMADA'){
      await this.client.query('UPDATE f04.reserva SET estado=$3,confirmado_en=$4,recogida_expira_en=$5,motivo_cierre=$6 WHERE id=$1 AND farmacia_id=$2',
        [input.reservationId,input.pharmacyId,input.target,confirmedAt,pickup,input.reason??null]);
    }else throw new Error('Worker requiere contexto dedicado');
    const updated=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE id=$1 AND farmacia_id=$2`,
      [input.reservationId,input.pharmacyId]);
    if(updated.rows.length!==1)throw new Error('Conflicto de reserva');const reservation=map(updated.rows[0]);
    if(input.target==='CONFIRMADA'){
      await this.client.query('INSERT INTO f04.transicion_reserva(reserva_id,farmacia_id,estado_origen,estado_destino,actor_usuario_id,origen,motivo,correlacion_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [reservation.id,input.pharmacyId,before.state,input.target,input.actorUserId,'FARMACIA',input.reason??null,correlation]);
      await this.outbox(reservation,`RESERVA_${input.target}`,correlation);
    }
    await this.client.query('INSERT INTO f04.idempotencia(actor_usuario_id,operacion,clave_hash,huella,reserva_id,resultado) VALUES($1,$2,$3,$4,$5,$6)',[input.actorUserId,operation,hash,print,reservation.id,JSON.stringify({id:reservation.id,state:reservation.state})]);
    return reservation;
  }

  async expireBatch(_now:Date,_limit:number):Promise<number>{throw new Error('Worker requiere contexto dedicado');}
  private async outbox(reservation:ReservationRow,type:string,correlation:string){await this.client.query('INSERT INTO f04.outbox_evento(farmacia_id,reserva_id,tipo,payload,correlacion_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(reserva_id,tipo) DO NOTHING',[reservation.pharmacyId,reservation.id,type,JSON.stringify({reservationId:reservation.id,state:reservation.state}),correlation]);}
}
