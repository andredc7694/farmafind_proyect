export const allowedTypes=['RESERVA_CREADA','RESERVA_CONFIRMADA','RESERVA_ENTREGADA','RESERVA_CANCELADA','RESERVA_EXPIRADA'] as const;
export type EventType=typeof allowedTypes[number];
export interface NotificationEvent{eventId:string;version:1;type:EventType;pharmacyId:string;reservationId:string;correlationId:string;occurredAt:string;payload:{reservationId:string;state:string}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const states=new Set(['PENDIENTE','CONFIRMADA','ENTREGADA','CANCELADA','EXPIRADA']);
export function parseEvent(value:unknown):NotificationEvent{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CONTRACT');
  const v=value as Record<string,unknown>,keys=['correlationId','eventId','occurredAt','payload','pharmacyId','reservationId','type','version'];
  if(Object.keys(v).sort().join(',')!==keys.join(','))throw new Error('CONTRACT');
  if(v.version!==1||!allowedTypes.includes(v.type as EventType)||![v.eventId,v.pharmacyId,v.reservationId,v.correlationId].every(x=>typeof x==='string'&&uuid.test(x))||typeof v.occurredAt!=='string'||!Number.isFinite(Date.parse(v.occurredAt)))throw new Error('CONTRACT');
  if(!v.payload||typeof v.payload!=='object'||Array.isArray(v.payload))throw new Error('CONTRACT');
  const p=v.payload as Record<string,unknown>;if(Object.keys(p).sort().join(',')!=='reservationId,state'||p.reservationId!==v.reservationId||typeof p.state!=='string'||!states.has(p.state))throw new Error('CONTRACT');
  return v as unknown as NotificationEvent;
}
