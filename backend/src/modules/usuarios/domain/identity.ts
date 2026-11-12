/** Identity is global; a pharmacy role is only meaningful inside its membership. */
export const USER_STATES = ['ACTIVO', 'INACTIVO'] as const;
export const MEMBERSHIP_STATES = ['ACTIVA', 'SUSPENDIDA', 'REVOCADA'] as const;
export const SESSION_STATES = ['VIGENTE', 'EXPIRADA', 'REVOCADA'] as const;
export const DELEGATION_STATES = ['ACTIVA', 'REVOCADA'] as const;
export const PHARMACY_STATES = ['ACTIVA', 'INACTIVA'] as const;

export type UserState = (typeof USER_STATES)[number];
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];
export type SessionState = (typeof SESSION_STATES)[number];
export type DelegationState = (typeof DELEGATION_STATES)[number];
export type PharmacyState = (typeof PHARMACY_STATES)[number];

export interface User {
  readonly id: string;
  readonly canonicalEmail: string;
  readonly passwordHash: string;
  readonly state: UserState;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Contains only a fingerprint; the raw session secret is never persisted here. */
export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly tokenFingerprint: string;
  readonly state: SessionState;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
}

/** Role names have no authority until a separate approved permission policy evaluates them. */
export interface Membership {
  readonly id: string;
  readonly userId: string;
  readonly pharmacyId: string;
  readonly roleCode: string;
  readonly state: MembershipState;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly changedByUserId: string | null;
}

/** Delegations are bound to one membership, never to the user globally. */
export interface Delegation {
  readonly id: string;
  readonly membershipId: string;
  readonly pharmacyId: string;
  readonly capabilityCode: string;
  readonly state: DelegationState;
  readonly grantedByUserId: string;
  readonly grantedAt: Date;
  readonly revokedAt: Date | null;
}

/** F01 needs only a reference and state; pharmacy CRUD belongs to its own module. */
export interface PharmacyReference {
  readonly id: string;
  readonly state: PharmacyState;
  readonly publicName: string;
}
