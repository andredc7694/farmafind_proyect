import type { IdentityTransaction } from '../../usuarios/contracts/tenant.js';
import type { ReservationCapability } from './ports.js';

export async function authorizeReservationContext(identity: IdentityTransaction, actorUserId: string,
  pharmacyId: string, capability: ReservationCapability): Promise<void> {
  const membership = await identity.useAuthorizedPharmacy(actorUserId, pharmacyId);
  const pharmacy = await identity.findPharmacyReference(pharmacyId);
  const delegations = await identity.listOwnDelegations(membership.id);
  if (membership.state !== 'ACTIVA' || pharmacy?.state !== 'ACTIVA' ||
      !['DUENO','ADMINISTRADOR'].includes(membership.roleCode) ||
      !delegations.some(item => item.state === 'ACTIVA' && item.capabilityCode === capability)) {
    throw new Error('No autorizado');
  }
}
