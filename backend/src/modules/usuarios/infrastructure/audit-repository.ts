import type { AuditEvent, AuditWriter } from '../application/ports.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

/** The auth role can only append identity events; it cannot read or change them. */
export class PgAuthAuditRepository implements AuditWriter {
  constructor(private readonly client: SqlClient) {}

  async record(event: AuditEvent): Promise<void> {
    if (event.pharmacyId !== null || event.resourceType !== 'IDENTITY' ||
        !['REGISTER', 'LOGIN', 'LOGOUT', 'MEMBERSHIP_LIST', 'PHARMACY_SELECT'].includes(event.action) ||
        !['PERMITIDO', 'DENEGADO'].includes(event.result)) {
      throw new Error('Evento de auditoria F01 invalido');
    }
    await this.client.query(`INSERT INTO f01.auditoria_acceso
      (actor_usuario_id,farmacia_id,accion,recurso_tipo,resultado,occurred_at,correlation_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [event.actorUserId, null, event.action, event.resourceType, event.result,
      event.occurredAt, event.correlationId]);
  }
}
