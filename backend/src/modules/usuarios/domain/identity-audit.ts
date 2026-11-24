/** F011-FR-008: catálogo cerrado de acciones de auditoría de identidad; el tipo no admite campos libres ni secretos. */
export const identityAuditActions = [
  'STAFF_CREATE', 'TEMP_KEY_ISSUE', 'TEMP_KEY_CONSUME', 'INVITE_CREATE', 'INVITE_ACCEPT', 'INVITE_DECLINE',
  'INVITE_REVOKE', 'CAPABILITY_GRANT', 'CAPABILITY_REVOKE', 'MEMBERSHIP_REVOKE', 'PASSWORD_CHANGE',
  'PASSWORD_RESET', 'EMAIL_VERIFY', 'EMAIL_CHANGE', 'MFA_ENROLL', 'MFA_VERIFY', 'MFA_RESET',
  'SESSION_REVOKE', 'ELEVATION_DENIED',
] as const;
export type IdentityAuditAction = (typeof identityAuditActions)[number];

export interface IdentityAuditEvent {
  readonly actorUserId: string | null;
  readonly targetUserId?: string | null;
  readonly pharmacyId?: string | null;
  readonly action: IdentityAuditAction;
  readonly result: 'PERMITIDO' | 'DENEGADO';
  readonly correlationId: string;
}

export interface IdentityAuditSink {
  record(event: IdentityAuditEvent, now?: Date): Promise<void>;
}
