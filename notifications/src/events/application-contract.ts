export const applicationTypes=['SOLICITUD_ENVIADA','SOLICITUD_OBSERVADA',
  'SOLICITUD_APROBADA','SOLICITUD_RECHAZADA'] as const;
export type ApplicationEventType=typeof applicationTypes[number];
export interface ApplicationNotificationEvent {
  eventId:string;version:1;type:ApplicationEventType;correlationId:string;occurredAt:string;
  payload:{applicationId:string;applicationVersion:number;recipientUserId:string};
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseApplicationEvent(value:unknown):ApplicationNotificationEvent {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CONTRACT');
  const event=value as Record<string,unknown>;
  if(Object.keys(event).sort().join(',')!=='correlationId,eventId,occurredAt,payload,type,version'||
    event.version!==1||!applicationTypes.includes(event.type as ApplicationEventType)||
    ![event.eventId,event.correlationId].every(id=>typeof id==='string'&&uuid.test(id))||
    typeof event.occurredAt!=='string'||!Number.isFinite(Date.parse(event.occurredAt)))
    throw new Error('CONTRACT');
  if(!event.payload||typeof event.payload!=='object'||Array.isArray(event.payload))throw new Error('CONTRACT');
  const payload=event.payload as Record<string,unknown>;
  if(Object.keys(payload).sort().join(',')!=='applicationId,applicationVersion,recipientUserId'||
    ![payload.applicationId,payload.recipientUserId].every(id=>typeof id==='string'&&uuid.test(id))||
    !Number.isSafeInteger(payload.applicationVersion)||Number(payload.applicationVersion)<1)
    throw new Error('CONTRACT');
  return event as unknown as ApplicationNotificationEvent;
}
