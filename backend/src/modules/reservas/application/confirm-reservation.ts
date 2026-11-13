import type { Clock } from '../domain/pickup-window.js';
import type { ReservationUnitOfWork } from './ports.js';
export class ConfirmReservation {
  constructor(private readonly uow:ReservationUnitOfWork,private readonly clock:Clock){}
  list(secret:string,pharmacyId:string){return this.uow.run(secret,pharmacyId,'reservation.read',ports=>ports.reservations.listPharmacy(pharmacyId));}
  execute(secret:string,pharmacyId:string,reservationId:string,key:string){return this.uow.run(secret,pharmacyId,'reservation.accept',async(ports,actor)=>ports.reservations.transition({reservationId,pharmacyId,actorUserId:actor,target:'CONFIRMADA',idempotencyKey:key,now:this.clock.now(),pickupWindowHours:await ports.reservations.pickupWindow(pharmacyId)}));}
}
