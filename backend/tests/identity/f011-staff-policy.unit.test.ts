import { describe, expect, it } from 'vitest';
import { assertCanManageStaff, canManageStaff, canRespondToInvitation, effectiveInvitationState, invitationExpiry,
  StaffPolicyError, STAFF_DELEGABLE_CAPABILITIES, validateRequestedCapabilities } from '../../src/modules/usuarios/domain/staff-policy.js';

const owner = { actorRole: 'DUENO', actorMembershipState: 'ACTIVA', actorPermissionCodes: ['membership.manage'],
  actorPharmacyId: 'alfa', pharmacyId: 'alfa', pharmacyState: 'ACTIVA', actorUserId: 'dueno-a', targetUserId: 'trabajador-1',
  requestedRole: 'TRABAJADOR' };

describe('F01.1 política de personal', () => {
  it('el catálogo delegable coincide con los códigos reales de F02 y F04 y excluye la gestión de personal', () => {
    expect([...STAFF_DELEGABLE_CAPABILITIES].sort()).toEqual([
      'inventory.history', 'inventory.import.confirm', 'inventory.import.preview', 'inventory.read', 'inventory.write',
      'reservation.accept', 'reservation.deliver', 'reservation.read', 'reservation.settings']);
    expect(STAFF_DELEGABLE_CAPABILITIES).not.toContain('membership.manage' as never);
  });

  it('valida capacidades: sin duplicados y rechaza desconocidas o no delegables', () => {
    expect(validateRequestedCapabilities(['inventory.read', 'inventory.read', 'reservation.read'])).toEqual(['inventory.read', 'reservation.read']);
    expect(validateRequestedCapabilities([])).toEqual([]);
    for (const bad of [['membership.manage'], ['platform.admin'], ['inventory.read', 7], 'inventory.read', null, undefined]) {
      expect(() => validateRequestedCapabilities(bad)).toThrow(StaffPolicyError);
    }
  });

  it('solo el propietario con permiso explícito gestiona personal de su propia farmacia', () => {
    expect(canManageStaff(owner)).toBe(true);
    expect(canManageStaff({ ...owner, actorRole: 'ADMINISTRADOR' })).toBe(true);
    expect(canManageStaff({ ...owner, actorRole: 'TRABAJADOR' })).toBe(false);
    expect(canManageStaff({ ...owner, actorPermissionCodes: [] })).toBe(false);
    expect(canManageStaff({ ...owner, actorMembershipState: 'REVOCADA' })).toBe(false);
    expect(canManageStaff({ ...owner, pharmacyState: 'INACTIVA' })).toBe(false);
    expect(canManageStaff({ ...owner, pharmacyId: 'beta' })).toBe(false);
  });

  it('impide la auto-concesión y roles distintos de TRABAJADOR (propietario, administrador)', () => {
    expect(() => assertCanManageStaff({ ...owner, targetUserId: 'dueno-a' })).toThrow(expect.objectContaining({ code: 'ELEVACION' }));
    for (const role of ['DUENO', 'ADMINISTRADOR', 'ADMINISTRADOR_PLATAFORMA']) {
      expect(() => assertCanManageStaff({ ...owner, requestedRole: role })).toThrow(expect.objectContaining({ code: 'ROL_NO_PERMITIDO' }));
    }
    expect(() => assertCanManageStaff({ ...owner, actorRole: 'TRABAJADOR' })).toThrow(expect.objectContaining({ code: 'ELEVACION' }));
    expect(() => assertCanManageStaff(owner)).not.toThrow();
  });

  it('crear una cuenta nueva (sin destino previo) es válido para el propietario', () => {
    expect(canManageStaff({ ...owner, targetUserId: null })).toBe(true);
  });

  it('la invitación vence a los 7 días y solo el destinatario puede responder', () => {
    const created = new Date('2026-11-23T10:00:00.000Z');
    const expiresAt = invitationExpiry(created);
    expect(expiresAt.toISOString()).toBe('2026-11-30T10:00:00.000Z');
    const before = new Date('2026-11-30T09:59:59.000Z');
    expect(effectiveInvitationState({ state: 'PENDIENTE', expiresAt, now: before })).toBe('PENDIENTE');
    expect(effectiveInvitationState({ state: 'PENDIENTE', expiresAt, now: expiresAt })).toBe('VENCIDA');
    expect(effectiveInvitationState({ state: 'REVOCADA', expiresAt, now: before })).toBe('REVOCADA');
    expect(canRespondToInvitation({ state: 'PENDIENTE', expiresAt, now: before, actorUserId: 'u1', targetUserId: 'u1' })).toBe(true);
    expect(canRespondToInvitation({ state: 'PENDIENTE', expiresAt, now: before, actorUserId: 'u2', targetUserId: 'u1' })).toBe(false);
    expect(canRespondToInvitation({ state: 'PENDIENTE', expiresAt, now: expiresAt, actorUserId: 'u1', targetUserId: 'u1' })).toBe(false);
    expect(canRespondToInvitation({ state: 'ACEPTADA', expiresAt, now: before, actorUserId: 'u1', targetUserId: 'u1' })).toBe(false);
  });
});
