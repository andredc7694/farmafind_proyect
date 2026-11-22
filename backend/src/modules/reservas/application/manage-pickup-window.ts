import { validatePickupWindow } from '../domain/pickup-window.js';
import type { ReservationUnitOfWork } from './ports.js';
export class ManagePickupWindow {
  constructor(private readonly uow:ReservationUnitOfWork){}
  get(secret:string,pharmacyId:string){return this.uow.run(secret,pharmacyId,'reservation.read',async ports=>({pickupWindowHours:await ports.reservations.pickupWindow(pharmacyId)}));}
  save(secret:string,pharmacyId:string,hours:number){validatePickupWindow(hours);return this.uow.run(secret,pharmacyId,'reservation.settings',async(ports,actor)=>({pickupWindowHours:await ports.reservations.savePickupWindow(pharmacyId,actor,hours)}));}
}
