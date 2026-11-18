import type { IdentityTransaction } from '../../usuarios/contracts/tenant.js';
import { LocationForbiddenError } from '../domain/pharmacy-location.js';
import type { AuthorizedLocationContext } from './location-ports.js';

export async function authorizeLocationContext(transaction:IdentityTransaction,actorId:string,pharmacyId:string,
  capability:AuthorizedLocationContext['capability']):Promise<AuthorizedLocationContext> {
  let membership;
  try { membership=await transaction.useAuthorizedPharmacy(actorId,pharmacyId); }
  catch { throw new LocationForbiddenError('Farmacia no autorizada'); }
  const delegations=await transaction.listOwnDelegations(membership.id);
  if (!delegations.some(item=>item.pharmacyId===pharmacyId && item.capabilityCode===capability && item.state==='ACTIVA'))
    throw new LocationForbiddenError('Capacidad insuficiente');
  return {pharmacyId,actorId,capability};
}
