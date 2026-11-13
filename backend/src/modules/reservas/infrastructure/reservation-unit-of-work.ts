import type { VerifiedTenantTransactions } from '../../usuarios/contracts/tenant.js';
import { authorizeReservationContext } from '../application/authorization.js';
import type { ReservationCapability, ReservationOperationPorts, ReservationUnitOfWork } from '../application/ports.js';
import { PgReservationRepository } from './reservation-repository.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PgReservationUnitOfWork implements ReservationUnitOfWork {
  constructor(private readonly identity: VerifiedTenantTransactions) {}

  run<T>(sessionSecret: string, pharmacyId: string | null, capability: ReservationCapability | null,
    work: (ports: ReservationOperationPorts, actorUserId: string) => Promise<T>): Promise<T> {
    return this.identity.runWithClient(sessionSecret, async (transaction, client, actorUserId) => {
      if (pharmacyId !== null) {
        if (!uuid.test(pharmacyId)) throw new Error('No autorizado');
        if (capability) await authorizeReservationContext(transaction, actorUserId, pharmacyId, capability);
        else {
          const pharmacy=await client.query("SELECT id FROM f01.farmacia_referencia WHERE id=$1 AND estado='ACTIVA'",[pharmacyId]);
          if (pharmacy.rows.length!==1) throw new Error('No visible');
          await client.query("SELECT set_config('app.farmacia_id',$1,true)",[pharmacyId]);
        }
      }
      return work({ reservations:new PgReservationRepository(client) },actorUserId);
    });
  }
}
