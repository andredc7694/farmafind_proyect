import type { Clock } from '../domain/pickup-window.js';
import type { ReservationUnitOfWork } from './ports.js';
export class DeliverReservation {
  constructor(private readonly uow:ReservationUnitOfWork,private readonly clock:Clock){}
  execute(secret:string,pharmacyId:string,reservationId:string,key:string){return this.uow.run(secret,pharmacyId,'reservation.deliver',(ports,actor)=>ports.reservations.transition({reservationId,pharmacyId,actorUserId:actor,target:'ENTREGADA',idempotencyKey:key,now:this.clock.now()}));}
}
