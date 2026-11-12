import { randomUUID } from 'node:crypto';
import { canManageLocalWorkers, canManageWorkerMembership } from '../domain/grant-policy.js';
import type { AdminMembershipTransaction, AdminMembershipUnitOfWork, WorkerMembershipRow } from './ports.js';

export class MembershipForbiddenError extends Error { constructor() { super('Permiso insuficiente'); } }
export class MembershipNotVisibleError extends Error { constructor() { super('No visible'); } }
export class MembershipConflictError extends Error { constructor() { super('Conflicto'); } }

/** A session is revalidated by the UoW; the tenant is selected only after own membership validation. */
export class ManageMemberships {
  constructor(private readonly transactions: AdminMembershipUnitOfWork) {}

  private withManager<T>(secret: string, pharmacyId: string,
    work: (transaction: AdminMembershipTransaction, actorUserId: string,
      role: string, permissions: readonly string[]) => Promise<T>): Promise<T> {
    return this.transactions.runAdmin(secret, async (transaction, actorUserId) => {
      let membership;
      try { membership = await transaction.useAuthorizedPharmacy(actorUserId, pharmacyId); }
      catch { throw new MembershipNotVisibleError(); }
      const pharmacy = await transaction.findPharmacyReference(pharmacyId);
      const delegations = await transaction.listOwnDelegations(membership.id);
      const permissions = delegations.filter(item => item.state === 'ACTIVA').map(item => item.capabilityCode);
      if (!canManageLocalWorkers({ actorRole: membership.roleCode, actorMembershipState: membership.state,
        actorPermissionCodes: permissions, actorPharmacyId: membership.pharmacyId,
        pharmacyId, pharmacyState: pharmacy?.state ?? 'INACTIVA' })) throw new MembershipForbiddenError();
      return work(transaction, actorUserId, membership.roleCode, permissions);
    });
  }

  list(secret: string, pharmacyId: string): Promise<readonly WorkerMembershipRow[]> {
    return this.withManager(secret, pharmacyId, transaction => transaction.listWorkers(pharmacyId));
  }

  async grant(secret: string, pharmacyId: string, targetUserId: string,
    requestedRole: string): Promise<WorkerMembershipRow> {
    try {
      return await this.withManager(secret, pharmacyId, async (transaction, actorUserId, role, permissions) => {
        if (!canManageWorkerMembership({ actorUserId, actorRole: role, actorMembershipState: 'ACTIVA',
          actorPermissionCodes: permissions, actorPharmacyId: pharmacyId, pharmacyId,
          pharmacyState: 'ACTIVA', targetUserId, targetPharmacyId: pharmacyId,
          targetRole: null, requestedRole, action: 'GRANT' })) throw new MembershipForbiddenError();
        const member = await transaction.grantWorker(pharmacyId, targetUserId);
        await transaction.recordWorkerChange(pharmacyId, 'MEMBERSHIP_GRANT', randomUUID());
        return member;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new MembershipConflictError();
      if ((error as { code?: string }).code === '23503') throw new MembershipNotVisibleError();
      if ((error as { code?: string }).code === '42501') throw new MembershipForbiddenError();
      throw error;
    }
  }

  async revoke(secret: string, pharmacyId: string, membershipId: string): Promise<WorkerMembershipRow> {
    try {
      return await this.withManager(secret, pharmacyId, async (transaction, actorUserId, role, permissions) => {
        const target = await transaction.findWorker(pharmacyId, membershipId);
        if (!target) throw new MembershipNotVisibleError();
        if (target.status !== 'ACTIVA') throw new MembershipConflictError();
        if (!canManageWorkerMembership({ actorUserId, actorRole: role, actorMembershipState: 'ACTIVA',
          actorPermissionCodes: permissions, actorPharmacyId: pharmacyId, pharmacyId,
          pharmacyState: 'ACTIVA', targetUserId: target.userId, targetPharmacyId: target.pharmacyId,
          targetRole: target.role, requestedRole: 'TRABAJADOR', action: 'REVOKE' })) {
          throw new MembershipForbiddenError();
        }
        const member = await transaction.revokeWorker(pharmacyId, membershipId);
        if (!member) throw new MembershipConflictError();
        await transaction.recordWorkerChange(pharmacyId, 'MEMBERSHIP_REVOKE', randomUUID());
        return member;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '42501') throw new MembershipForbiddenError();
      throw error;
    }
  }
}
