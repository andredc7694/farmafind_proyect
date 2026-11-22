import type { VerifiedTenantTransactions } from '../../usuarios/contracts/tenant.js';
import { canUseInventory } from '../../inventario/contracts/authorization.js';
import type { CatalogSessionReader, CatalogRow } from '../application/ports.js';
import { PgCatalogRepository } from './catalog-repository.js';

export class AuthorizedCatalogReader implements CatalogSessionReader {
  constructor(private readonly transactions: VerifiedTenantTransactions) {}

  list(secret: string, query: string, page: number): Promise<readonly CatalogRow[]> {
    return this.transactions.runWithClient(secret, async (identity, client, actorUserId) => {
      const memberships = await identity.listOwnMemberships(actorUserId);
      let eligible = false;
      for (const membership of memberships) {
        if (membership.state !== 'ACTIVA') continue;
        const pharmacy = await identity.findPharmacyReference(membership.pharmacyId);
        const delegations = await identity.listOwnDelegations(membership.id);
        if (canUseInventory({ authenticated: true, membershipActive: true,
          pharmacyActive: pharmacy?.state === 'ACTIVA', actorRole: membership.roleCode,
          selectedPharmacyId: membership.pharmacyId, resourcePharmacyId: membership.pharmacyId,
          capabilities: delegations.filter(item => item.state === 'ACTIVA').map(item => item.capabilityCode),
        }, 'inventory.read')) { eligible = true; break; }
      }
      if (!eligible) throw new Error('No autorizado');
      return new PgCatalogRepository(client).list(query, page);
    });
  }
}
