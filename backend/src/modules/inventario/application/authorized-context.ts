import type { IdentityTransaction } from '../../usuarios/contracts/tenant.js';
import { canUseInventory, type InventoryCapability } from '../domain/authorization.js';

export interface AuthorizedInventoryContext {
  readonly actorUserId: string;
  readonly pharmacyId: string;
  readonly capability: InventoryCapability;
}

/** F01 proves identity and membership; F02 checks the precise business capability. */
export async function authorizeInventoryContext(
  identity: IdentityTransaction,
  actorUserId: string,
  pharmacyId: string,
  capability: InventoryCapability,
): Promise<AuthorizedInventoryContext> {
  const membership = await identity.useAuthorizedPharmacy(actorUserId, pharmacyId);
  const pharmacy = await identity.findPharmacyReference(pharmacyId);
  const delegations = await identity.listOwnDelegations(membership.id);
  const allowed = canUseInventory({
    authenticated: true,
    membershipActive: membership.state === 'ACTIVA',
    pharmacyActive: pharmacy?.state === 'ACTIVA',
    actorRole: membership.roleCode,
    selectedPharmacyId: pharmacyId,
    resourcePharmacyId: membership.pharmacyId,
    capabilities: delegations.filter(item => item.state === 'ACTIVA').map(item => item.capabilityCode),
  }, capability);
  if (!allowed) throw new Error('No autorizado');
  return { actorUserId, pharmacyId, capability };
}
