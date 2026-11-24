import { canManageLocalWorkers } from './grant-policy.js';
import type { LocalManagerContext } from './grant-policy.js';

/**
 * Permisos de personal (F011-FR-005, EXC-01/ROL-01). Códigos existentes de F02/F04;
 * «membership.manage» (gestión de personal) pertenece al propietario y no se delega.
 */
export const STAFF_DELEGABLE_CAPABILITIES = [
  'reservation.read', 'reservation.accept', 'reservation.deliver', 'reservation.settings',
  'inventory.read', 'inventory.write', 'inventory.import.preview', 'inventory.import.confirm', 'inventory.history',
] as const;
export type StaffCapability = (typeof STAFF_DELEGABLE_CAPABILITIES)[number];
export const STAFF_MANAGE_CAPABILITY = 'membership.manage';
export const INVITATION_TTL_DAYS = 7;

export class StaffPolicyError extends Error {
  constructor(readonly code: 'CAPACIDAD_INVALIDA' | 'ELEVACION' | 'ROL_NO_PERMITIDO') { super(code); }
}

/** Devuelve la lista sin duplicados; rechaza códigos desconocidos o no delegables (incluida la gestión de personal). */
export function validateRequestedCapabilities(codes: unknown): readonly StaffCapability[] {
  if (!Array.isArray(codes)) throw new StaffPolicyError('CAPACIDAD_INVALIDA');
  const unique = [...new Set(codes)];
  for (const code of unique) {
    if (typeof code !== 'string' || !(STAFF_DELEGABLE_CAPABILITIES as readonly string[]).includes(code)) {
      throw new StaffPolicyError('CAPACIDAD_INVALIDA');
    }
  }
  return unique as StaffCapability[];
}

export interface StaffActionContext extends LocalManagerContext {
  readonly actorUserId: string;
  readonly targetUserId: string | null;
  readonly requestedRole: string;
}

/** Solo propietario/administrador autorizado de la propia farmacia; únicamente el rol TRABAJADOR; sin auto-concesión. */
export function canManageStaff(input: StaffActionContext): boolean {
  return canManageLocalWorkers(input) && input.requestedRole === 'TRABAJADOR' &&
    (input.targetUserId === null || input.targetUserId !== input.actorUserId);
}

export function assertCanManageStaff(input: StaffActionContext): void {
  if (input.requestedRole !== 'TRABAJADOR') throw new StaffPolicyError('ROL_NO_PERMITIDO');
  if (input.targetUserId !== null && input.targetUserId === input.actorUserId) throw new StaffPolicyError('ELEVACION');
  if (!canManageStaff(input)) throw new StaffPolicyError('ELEVACION');
}

export function invitationExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITATION_TTL_DAYS * 86_400_000);
}

export type InvitationState = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA' | 'REVOCADA';

/** Estado efectivo: una invitación pendiente cuya fecha pasó se considera vencida. */
export function effectiveInvitationState(input: { state: InvitationState; expiresAt: Date; now: Date }): InvitationState {
  return input.state === 'PENDIENTE' && input.expiresAt.getTime() <= input.now.getTime() ? 'VENCIDA' : input.state;
}

export function canRespondToInvitation(input: { state: InvitationState; expiresAt: Date; now: Date;
  actorUserId: string; targetUserId: string }): boolean {
  return input.actorUserId === input.targetUserId && effectiveInvitationState(input) === 'PENDIENTE';
}
