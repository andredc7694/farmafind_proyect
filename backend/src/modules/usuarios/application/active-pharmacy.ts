import type { IdentityUnitOfWork } from './ports.js';

export interface AvailablePharmacy {
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly roleCode: string;
  readonly delegationCodes: readonly string[];
}

export interface ActivePharmacySelection {
  readonly pharmacyId: string;
  readonly roleCode: string;
  readonly delegationCodes: readonly string[];
}

/** Every call obtains a fresh verified session and membership snapshot. */
export class ActivePharmacyService {
  constructor(private readonly transactions: IdentityUnitOfWork) {}

  async listAvailable(sessionSecret: string): Promise<readonly AvailablePharmacy[]> {
    return this.transactions.run(sessionSecret, async (transaction, actorUserId) => {
      const own = await transaction.listOwnMemberships(actorUserId);
      const result: AvailablePharmacy[] = [];
      for (const membership of own) {
        if (membership.state !== 'ACTIVA') continue;
        const pharmacy = await transaction.findPharmacyReference(membership.pharmacyId);
        if (pharmacy?.state !== 'ACTIVA') continue;
        const delegations = await transaction.listOwnDelegations(membership.id);
        result.push({
          pharmacyId: membership.pharmacyId,
          pharmacyName: pharmacy.publicName,
          roleCode: membership.roleCode,
          delegationCodes: delegations.filter(item => item.state === 'ACTIVA').map(item => item.capabilityCode),
        });
      }
      return result;
    });
  }

  async select(sessionSecret: string, pharmacyId: string): Promise<ActivePharmacySelection> {
    return this.transactions.run(sessionSecret, async (transaction, actorUserId) => {
      const membership = await transaction.useAuthorizedPharmacy(actorUserId, pharmacyId);
      const delegations = await transaction.listOwnDelegations(membership.id);
      return {
        pharmacyId: membership.pharmacyId,
        roleCode: membership.roleCode,
        delegationCodes: delegations.filter(item => item.state === 'ACTIVA').map(item => item.capabilityCode),
      };
    });
  }
}
