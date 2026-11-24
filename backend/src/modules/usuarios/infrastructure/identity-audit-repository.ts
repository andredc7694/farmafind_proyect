import { identityAuditActions } from '../domain/identity-audit.js';
import type { IdentityAuditEvent, IdentityAuditSink } from '../domain/identity-audit.js';

export { identityAuditActions };
export type { IdentityAuditAction, IdentityAuditEvent } from '../domain/identity-audit.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const allowedKeys = new Set(['actorUserId', 'targetUserId', 'pharmacyId', 'action', 'result', 'correlationId']);

/** Debe usarse dentro de la misma transacción que la operación auditada. */
export class PgIdentityAuditRepository implements IdentityAuditSink {
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
