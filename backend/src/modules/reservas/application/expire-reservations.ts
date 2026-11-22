import type { Clock } from '../domain/pickup-window.js';
import type { ReservationRepository } from './ports.js';
export class ExpireReservations {
  constructor(private readonly repository:ReservationRepository,private readonly clock:Clock,private readonly batchSize:number){}
  execute(){return this.repository.expireBatch(this.clock.now(),this.batchSize);}
}
