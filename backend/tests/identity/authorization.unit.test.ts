import { describe, expect, it } from 'vitest';
import { canManageWorkerMembership } from '../../src/modules/usuarios/domain/grant-policy.js';

// T042 is deliberately test-first. T045 introduces the pure policy; no real
// membership mutation may be exposed until T044 proves the PostgreSQL RLS gate.
const pharmacyA = '00000000-0000-4000-8000-00000000000a';
const pharmacyB = '00000000-0000-4000-8000-00000000000b';
const actorId = '00000000-0000-4000-8000-000000000001';
const workerId = '00000000-0000-4000-8000-000000000002';

type LocalDecision = Parameters<typeof canManageWorkerMembership>[0];

function scenario(overrides: Partial<LocalDecision> = {}): LocalDecision {
  return {
    actorUserId: actorId,
    actorRole: 'DUENO',
    actorMembershipState: 'ACTIVA',
    actorPermissionCodes: ['membership.manage'],
    actorPharmacyId: pharmacyA,
    pharmacyId: pharmacyA,
    pharmacyState: 'ACTIVA',
    targetUserId: workerId,
    targetPharmacyId: pharmacyA,
    targetRole: 'TRABAJADOR',
    requestedRole: 'TRABAJADOR',
    action: 'GRANT',
    ...overrides,
  };
}

describe('T042: matriz local de concesion y revocacion TRABAJADOR', () => {
  it.each(['DUENO', 'ADMINISTRADOR'] as const)(
    'permite %s con permiso explicito y membresia activa en A para otra persona', actorRole => {
      expect(canManageWorkerMembership(scenario({ actorRole }))).toBe(true);
      expect(canManageWorkerMembership(scenario({ actorRole, action: 'REVOKE' }))).toBe(true);
    },
  );

  it.each([
    ['autoelevacion', { targetUserId: actorId }],
    ['farmacia B en el recurso', { pharmacyId: pharmacyB, targetPharmacyId: pharmacyB }],
    ['objetivo de B', { targetPharmacyId: pharmacyB }],
    ['actor de B', { actorPharmacyId: pharmacyB }],
    ['membresia suspendida', { actorMembershipState: 'SUSPENDIDA' }],
    ['membresia revocada', { actorMembershipState: 'REVOCADA' }],
    ['farmacia inactiva', { pharmacyState: 'INACTIVA' }],
    ['permiso ausente', { actorPermissionCodes: [] }],
    ['trabajador con permiso aparente', { actorRole: 'TRABAJADOR' }],
    ['usuario comun con permiso aparente', { actorRole: 'CLIENTE' }],
    ['administrador global sin membresia local', { actorRole: 'ADMINISTRADOR_PLATAFORMA', actorMembershipState: 'INACTIVA' }],
    ['rol dueno solicitado', { requestedRole: 'DUENO' }],
    ['rol administrador solicitado', { requestedRole: 'ADMINISTRADOR' }],
    ['objetivo dueno', { targetRole: 'DUENO', action: 'REVOKE' }],
    ['objetivo administrador', { targetRole: 'ADMINISTRADOR', action: 'REVOKE' }],
    ['delegacion de negocio', { requestedRole: 'TRABAJADOR', requestedDelegationCodes: ['INVENTARIO.EDITAR'] }],
  ] as const)('deniega %s', (_reason, overrides) => {
    expect(canManageWorkerMembership(scenario(overrides as Partial<LocalDecision>))).toBe(false);
  });
});
