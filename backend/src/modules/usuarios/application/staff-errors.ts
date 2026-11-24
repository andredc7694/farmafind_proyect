import { MembershipConflictError, MembershipForbiddenError, MembershipNotVisibleError } from './manage-memberships.js';
import type { StaffTransaction } from './ports.js';
import { assertCanManageStaff, StaffPolicyError } from '../domain/staff-policy.js';

/** SQLSTATE de las funciones de F01.1: 42501 permiso · F0404 no visible · F0409 conflicto · 22023 entrada inválida. */
export function mapStaffDatabaseError(error: unknown): Error {
  const code = (error as { code?: string }).code;
  if (code === '23505' || code === 'F0409') return new MembershipConflictError();
  if (code === '42501') return new MembershipForbiddenError();
  if (code === 'F0404') return new MembershipNotVisibleError();
  if (code === '22023') return new Error('Entrada inválida');
  return error instanceof Error ? error : new Error('Error');
}

/** Valida membresía propia, farmacia activa y permiso explícito de gestión antes de operar sobre personal. */
export async function authorizeStaffManager(transaction: StaffTransaction, actorUserId: string, pharmacyId: string): Promise<void> {
  let membership;
  try { membership = await transaction.useAuthorizedPharmacy(actorUserId, pharmacyId); }
  catch { throw new MembershipNotVisibleError(); }
  const pharmacy = await transaction.findPharmacyReference(pharmacyId);
  const delegations = await transaction.listOwnDelegations(membership.id);
  try {
    assertCanManageStaff({ actorUserId, actorRole: membership.roleCode, actorMembershipState: membership.state,
      actorPermissionCodes: delegations.filter(item => item.state === 'ACTIVA').map(item => item.capabilityCode),
      actorPharmacyId: membership.pharmacyId, pharmacyId, pharmacyState: pharmacy?.state ?? 'INACTIVA',
      targetUserId: null, requestedRole: 'TRABAJADOR' });
  } catch (error) {
    if (error instanceof StaffPolicyError) throw new MembershipForbiddenError();
    throw error;
  }
}
