import type { Clock } from '../domain/pickup-window.js';
import { pendingExpiration } from '../domain/pickup-window.js';
import { assertPositiveQuantity } from '../domain/reservation.js';
import { validatePickupPreference } from '../domain/pickup-preference.js';
import type { ReservationUnitOfWork } from './ports.js';

export class CreateReservation {
  constructor(private readonly uow:ReservationUnitOfWork,private readonly clock:Clock,private readonly pendingMinutes:number){}
  execute(secret:string,input:{pharmacyId:string;medicationId:string;quantity:number;idempotencyKey:string;pickupPreference?:unknown}){
    const quantity=assertPositiveQuantity(input.quantity);const now=this.clock.now();
    return this.uow.run(secret,input.pharmacyId,null,async(ports,actorUserId)=>{
      // F04.1: la preferencia se valida contra el plazo de recogida vigente de la farmacia (solo orientación).
      const preference=input.pickupPreference===undefined||input.pickupPreference===null?null
        :validatePickupPreference(input.pickupPreference,now,await ports.reservations.pickupWindow(input.pharmacyId));
      return ports.reservations.create({
        actorUserId,pharmacyId:input.pharmacyId,medicationId:input.medicationId,quantity,
        responseExpiresAt:pendingExpiration(now,this.pendingMinutes),idempotencyKey:input.idempotencyKey,preference,
      });
    });
  }
}
