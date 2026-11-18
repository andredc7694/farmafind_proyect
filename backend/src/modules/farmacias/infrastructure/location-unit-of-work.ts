import type { VerifiedTenantTransactions } from '../../usuarios/contracts/tenant.js';
import { authorizeLocationContext } from '../application/location-authorization.js';
import type { AuthorizedLocationContext, LocationUnitOfWork, LocationRepository } from '../application/location-ports.js';
import { PgLocationRepository } from './location-repository.js';

/** Reuse F01's live-session transaction and transaction-local tenant context. */
export class PgLocationUnitOfWork implements LocationUnitOfWork {
  constructor(private readonly identity:VerifiedTenantTransactions) {}
  run<T>(secret:string,pharmacyId:string,capability:AuthorizedLocationContext['capability'],
    work:(repository:LocationRepository,context:AuthorizedLocationContext)=>Promise<T>):Promise<T> {
    return this.identity.runWithClient(secret,async(transaction,client,actorId)=>{
      const context=await authorizeLocationContext(transaction,actorId,pharmacyId,capability);
      return work(new PgLocationRepository(client,pharmacyId),context);
    });
  }
}
