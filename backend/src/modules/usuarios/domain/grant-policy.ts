/** EXC-01/ROL-01: an explicit local permission, never a role name alone. */
export interface WorkerMembershipDecision {
  readonly actorUserId: string;
  readonly actorRole: string;
  readonly actorMembershipState: string;
  readonly actorPermissionCodes: readonly string[];
  readonly actorPharmacyId: string;
  readonly pharmacyId: string;
  readonly pharmacyState: string;
  readonly targetUserId: string;
  readonly targetPharmacyId: string;
  readonly targetRole: string | null;
  readonly requestedRole: string;
  readonly requestedDelegationCodes?: readonly string[];
  readonly action: 'GRANT' | 'REVOKE';
}

export type LocalManagerContext = Pick<WorkerMembershipDecision,
  'actorRole' | 'actorMembershipState' | 'actorPermissionCodes' |
  'actorPharmacyId' | 'pharmacyId' | 'pharmacyState'>;

export function canManageLocalWorkers(input: LocalManagerContext): boolean {
  return (input.actorRole === 'DUENO' || input.actorRole === 'ADMINISTRADOR') &&
    input.actorMembershipState === 'ACTIVA' && input.pharmacyState === 'ACTIVA' &&
    input.actorPermissionCodes.includes('membership.manage') &&
    input.actorPharmacyId === input.pharmacyId;
}

export function canManageWorkerMembership(input: WorkerMembershipDecision): boolean {
  return canManageLocalWorkers(input) &&
    input.targetPharmacyId === input.pharmacyId &&
    input.actorUserId !== input.targetUserId &&
    input.requestedRole === 'TRABAJADOR' &&
    (input.targetRole === null || input.targetRole === 'TRABAJADOR') &&
    (input.requestedDelegationCodes?.length ?? 0) === 0 &&
    (input.action === 'GRANT' || input.action === 'REVOKE');
}
