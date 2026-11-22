import type { ReservationUnitOfWork } from './ports.js';
export class ListOwnReservations {
  constructor(private readonly uow:ReservationUnitOfWork){}
  list(secret:string){return this.uow.run(secret,null,null,(ports,actor)=>ports.reservations.listOwn(actor));}
  detail(secret:string,id:string){return this.uow.run(secret,null,null,(ports,actor)=>ports.reservations.findOwn(actor,id));}
}
