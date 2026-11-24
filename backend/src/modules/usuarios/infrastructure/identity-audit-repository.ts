/** F011-FR-008: auditoría de identidad con catálogo cerrado; el tipo no admite campos libres ni secretos. */
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

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const allowedKeys = new Set(['actorUserId', 'targetUserId', 'pharmacyId', 'action', 'result', 'correlationId']);

/** Debe usarse dentro de la misma transacción que la operación auditada. */
export class PgIdentityAuditRepository {
  constructor(private readonly client: SqlClient) {}

  async record(event: IdentityAuditEvent, now: Date = new Date()): Promise<void> {
    for (const key of Object.keys(event)) {
      if (!allowedKeys.has(key)) throw new Error('Auditoría: campo no permitido');
    }
    if (!(identityAuditActions as readonly string[]).includes(event.action)) throw new Error('Auditoría: acción fuera del catálogo');
    if (event.result !== 'PERMITIDO' && event.result !== 'DENEGADO') throw new Error('Auditoría: resultado inválido');
    await this.client.query(
      `INSERT INTO f01.auditoria_identidad(actor_usuario_id,objetivo_usuario_id,farmacia_id,accion,resultado,ocurrido_at,correlation_id)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [event.actorUserId, event.targetUserId ?? null, event.pharmacyId ?? null, event.action, event.result, now, event.correlationId]);
  }
}
