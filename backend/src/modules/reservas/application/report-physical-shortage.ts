import type { Clock } from '../domain/pickup-window.js';
import type { ReservationUnitOfWork } from './ports.js';
export class ReportPhysicalShortage {
  constructor(private readonly uow:ReservationUnitOfWork,private readonly clock:Clock){}
  execute(secret:string,pharmacyId:string,reservationId:string,key:string){return this.uow.run(secret,pharmacyId,'reservation.accept',(ports,actor)=>ports.reservations.transition({reservationId,pharmacyId,actorUserId:actor,target:'CANCELADA',idempotencyKey:key,now:this.clock.now(),reason:'FALTA_FISICA'}));}
}
