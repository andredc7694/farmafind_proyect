export const notificationTypes=['RESERVA_CREADA','RESERVA_CONFIRMADA','RESERVA_ENTREGADA','RESERVA_CANCELADA','RESERVA_EXPIRADA'] as const;
export type NotificationType=typeof notificationTypes[number];
export interface NotificationEnvelope{eventId:string;version:1;type:NotificationType;pharmacyId:string;reservationId:string;correlationId:string;occurredAt:string;payload:{reservationId:string;state:string}}
export interface OutboxClaim{envelope:NotificationEnvelope;attempt:number;claimId:string}
