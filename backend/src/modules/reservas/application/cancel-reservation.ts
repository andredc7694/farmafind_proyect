import type { Clock } from '../domain/pickup-window.js';
import type { ReservationUnitOfWork } from './ports.js';
export class CancelReservation {
  constructor(private readonly uow:ReservationUnitOfWork,private readonly clock:Clock){}
  execute(secret:string,reservationId:string,key:string){return this.uow.run(secret,null,null,async(ports,actor)=>{
    const own=await ports.reservations.findOwn(actor,reservationId);if(!own)throw new Error('No visible');
    return ports.reservations.transition({reservationId,pharmacyId:own.pharmacyId,actorUserId:actor,target:'CANCELADA',idempotencyKey:key,now:this.clock.now(),reason:'CANCELADA_POR_USUARIO'});
  });}
}
