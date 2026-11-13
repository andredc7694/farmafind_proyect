import { createHash, randomUUID } from 'node:crypto';
import type { SqlClient } from '../../usuarios/contracts/tenant.js';
import type { ReservationRepository, ReservationRow } from '../application/ports.js';
import type { ReservationState } from '../domain/reservation.js';
import { pickupExpiration } from '../domain/pickup-window.js';

function map(row:Record<string,unknown>):ReservationRow { return {
  id:String(row.id),userId:String(row.usuario_id),pharmacyId:String(row.farmacia_id),inventoryId:String(row.inventario_id),
  medicationId:String(row.medicamento_id),quantity:Number(row.cantidad),state:row.estado as ReservationState,
  responseExpiresAt:(row.respuesta_expira_en as Date).toISOString(),confirmedAt:row.confirmado_en?(row.confirmado_en as Date).toISOString():null,
  pickupExpiresAt:row.recogida_expira_en?(row.recogida_expira_en as Date).toISOString():null,version:Number(row.version),
}; }
const columns='id,usuario_id,farmacia_id,inventario_id,medicamento_id,cantidad,estado,respuesta_expira_en,confirmado_en,recogida_expira_en,version';
function keyHash(key:string){return createHash('sha256').update(key).digest('hex');}
function fingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}

export class PgReservationRepository implements ReservationRepository {
  constructor(private readonly client:SqlClient){}

  async create(input:{actorUserId:string;pharmacyId:string;medicationId:string;quantity:number;responseExpiresAt:Date;idempotencyKey:string}) {
    const hash=keyHash(input.idempotencyKey); const print=fingerprint(input);
    const known=await this.client.query("SELECT huella,reserva_id FROM f04.idempotencia WHERE actor_usuario_id=$1 AND operacion='CREATE' AND clave_hash=$2",[input.actorUserId,hash]);
    if(known.rows.length){
      if(known.rows[0].huella!==print) throw new Error('Idempotencia en conflicto');
      const replay=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE id=$1`,[known.rows[0].reserva_id]);
      if(replay.rows.length!==1) throw new Error('Idempotencia incompleta');
      return {reservation:map(replay.rows[0]),replay:true};
    }
    const inventory=await this.client.query(`SELECT id,cantidad_fisica,cantidad_comprometida FROM f02.inventario
      WHERE farmacia_id=$1 AND medicamento_id=$2 FOR UPDATE`,[input.pharmacyId,input.medicationId]);
    if(inventory.rows.length!==1 || Number(inventory.rows[0].cantidad_fisica)-Number(inventory.rows[0].cantidad_comprometida)<input.quantity)
      throw new Error('Sin disponibilidad');
    const created=await this.client.query(`INSERT INTO f04.reserva(usuario_id,farmacia_id,inventario_id,medicamento_id,cantidad,respuesta_expira_en)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING ${columns}`,[input.actorUserId,input.pharmacyId,inventory.rows[0].id,input.medicationId,input.quantity,input.responseExpiresAt]);
    await this.client.query('UPDATE f02.inventario SET cantidad_comprometida=cantidad_comprometida+$3,version=version+1 WHERE id=$1 AND farmacia_id=$2',
      [inventory.rows[0].id,input.pharmacyId,input.quantity]);
    const reservation=map(created.rows[0]); const correlation=randomUUID();
    await this.client.query("INSERT INTO f04.idempotencia(actor_usuario_id,operacion,clave_hash,huella,reserva_id,resultado) VALUES($1,'CREATE',$2,$3,$4,$5)",
      [input.actorUserId,hash,print,reservation.id,JSON.stringify({id:reservation.id})]);
    await this.client.query("INSERT INTO f04.transicion_reserva(reserva_id,farmacia_id,estado_destino,actor_usuario_id,origen,correlacion_id) VALUES($1,$2,'PENDIENTE',$3,'USUARIO',$4)",
      [reservation.id,input.pharmacyId,input.actorUserId,correlation]);
    await this.outbox(reservation,'RESERVA_CREADA',correlation);
    return {reservation,replay:false};
  }

  async listOwn(actorUserId:string){const r=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE usuario_id=$1 ORDER BY creado_en DESC,id`,[actorUserId]);return r.rows.map(map);}
  async findOwn(actorUserId:string,id:string){const r=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE id=$1 AND usuario_id=$2`,[id,actorUserId]);return r.rows.length?map(r.rows[0]):null;}
  async listPharmacy(pharmacyId:string){const r=await this.client.query(`SELECT ${columns} FROM f04.reserva WHERE farmacia_id=$1 ORDER BY creado_en,id`,[pharmacyId]);return r.rows.map(map);}
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
    const stock=(await this.client.query('SELECT cantidad_fisica,cantidad_comprometida,precio_centavos FROM f02.inventario WHERE id=$1 AND farmacia_id=$2 FOR UPDATE',[before.inventoryId,input.pharmacyId])).rows[0];
    if(!stock)throw new Error('Inventario no visible');
    let confirmedAt:Date|null=before.confirmedAt?new Date(before.confirmedAt):null;let pickup:Date|null=before.pickupExpiresAt?new Date(before.pickupExpiresAt):null;
    if(input.target==='CONFIRMADA'){confirmedAt=input.now;pickup=pickupExpiration(input.now,input.pickupWindowHours??4);}
    if(['CANCELADA','EXPIRADA'].includes(input.target))await this.client.query('UPDATE f02.inventario SET cantidad_comprometida=cantidad_comprometida-$3,version=version+1 WHERE id=$1 AND farmacia_id=$2 AND cantidad_comprometida>=$3',[before.inventoryId,input.pharmacyId,before.quantity]);
    if(input.target==='ENTREGADA')await this.client.query('UPDATE f02.inventario SET cantidad_comprometida=cantidad_comprometida-$3,cantidad_fisica=cantidad_fisica-$3,version=version+1 WHERE id=$1 AND farmacia_id=$2 AND cantidad_comprometida>=$3 AND cantidad_fisica>=$3',[before.inventoryId,input.pharmacyId,before.quantity]);
    const updated=await this.client.query(`UPDATE f04.reserva SET estado=$3,confirmado_en=$4,recogida_expira_en=$5,motivo_cierre=$6 WHERE id=$1 AND farmacia_id=$2 RETURNING ${columns}`,
      [input.reservationId,input.pharmacyId,input.target,confirmedAt,pickup,input.reason??null]);
    if(updated.rows.length!==1)throw new Error('Conflicto de reserva');const reservation=map(updated.rows[0]);const correlation=randomUUID();
    await this.client.query('INSERT INTO f04.transicion_reserva(reserva_id,farmacia_id,estado_origen,estado_destino,actor_usuario_id,origen,motivo,correlacion_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [reservation.id,input.pharmacyId,before.state,input.target,input.actorUserId,input.target==='CANCELADA'&&input.reason!=='FALTA_FISICA'?'USUARIO':'FARMACIA',input.reason??null,correlation]);
    if(input.reason==='FALTA_FISICA')await this.client.query('INSERT INTO f04.incidencia_stock(reserva_id,farmacia_id,inventario_id,cantidad,motivo,actor_usuario_id,correlacion_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(reserva_id) DO NOTHING',[reservation.id,input.pharmacyId,reservation.inventoryId,reservation.quantity,'FALTA_FISICA',input.actorUserId,correlation]);
    if(input.reason==='FALTA_FISICA'||input.target==='ENTREGADA')await this.client.query(`INSERT INTO f02.movimiento(farmacia_id,inventario_id,medicamento_id,cantidad_antes,cantidad_despues,precio_antes_centavos,precio_despues_centavos,motivo,actor_usuario_id,correlacion_id)
      VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9)`,[input.pharmacyId,reservation.inventoryId,reservation.medicationId,Number(stock.cantidad_fisica),input.target==='ENTREGADA'?Number(stock.cantidad_fisica)-reservation.quantity:Number(stock.cantidad_fisica),Number(stock.precio_centavos),input.reason==='FALTA_FISICA'?'FALTA_FISICA_RESERVA':'ENTREGA_RESERVA',input.actorUserId,correlation]);
    await this.outbox(reservation,`RESERVA_${input.target}`,correlation);
    await this.client.query('INSERT INTO f04.idempotencia(actor_usuario_id,operacion,clave_hash,huella,reserva_id,resultado) VALUES($1,$2,$3,$4,$5,$6)',[input.actorUserId,operation,hash,print,reservation.id,JSON.stringify({id:reservation.id,state:reservation.state})]);
    return reservation;
  }

  async expireBatch(_now:Date,_limit:number):Promise<number>{throw new Error('Worker requiere contexto dedicado');}
  private async outbox(reservation:ReservationRow,type:string,correlation:string){await this.client.query('INSERT INTO f04.outbox_evento(farmacia_id,reserva_id,tipo,payload,correlacion_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(reserva_id,tipo) DO NOTHING',[reservation.pharmacyId,reservation.id,type,JSON.stringify({reservationId:reservation.id,state:reservation.state}),correlation]);}
}
