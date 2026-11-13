import type { Clock } from '../domain/pickup-window.js';
import { pendingExpiration } from '../domain/pickup-window.js';
import { assertPositiveQuantity } from '../domain/reservation.js';
import type { ReservationUnitOfWork } from './ports.js';

export class CreateReservation {
  constructor(private readonly uow:ReservationUnitOfWork,private readonly clock:Clock,private readonly pendingMinutes:number){}
  execute(secret:string,input:{pharmacyId:string;medicationId:string;quantity:number;idempotencyKey:string}){
    const quantity=assertPositiveQuantity(input.quantity);const now=this.clock.now();
    return this.uow.run(secret,input.pharmacyId,null,(ports,actorUserId)=>ports.reservations.create({
      actorUserId,pharmacyId:input.pharmacyId,medicationId:input.medicationId,quantity,
      responseExpiresAt:pendingExpiration(now,this.pendingMinutes),idempotencyKey:input.idempotencyKey,
    }));
  }
}
