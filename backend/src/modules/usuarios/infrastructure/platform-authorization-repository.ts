import type { PlatformAssignment, PlatformAuthorizationTransaction,
  PlatformAuthorizationUnitOfWork } from '../application/manage-platform-authorizations.js';
import type { PgIdentityUnitOfWork, SqlClient } from './db/tenant-transaction.js';

function assignment(row: Record<string, unknown>): PlatformAssignment {
  return {
    id: String(row.id), userId: String(row.usuario_id), role: 'ADMINISTRADOR_PLATAFORMA',
    status: row.estado as PlatformAssignment['status'], grantedAt: new Date(String(row.granted_at)).toISOString(),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : null,
  };
}

class PgPlatformAuthorizationTransaction implements PlatformAuthorizationTransaction {
  constructor(private readonly client: SqlClient) {}
  async list(): Promise<readonly PlatformAssignment[]> {
    const result = await this.client.query('SELECT * FROM f01.list_platform_role_assignments()');
    return result.rows.map(assignment);
  }
  async grant(targetUserId: string, role: string, approvalId: string, correlationId: string): Promise<PlatformAssignment> {
    const result = await this.client.query('SELECT * FROM f01.grant_platform_role($1,$2,$3,$4)',
      [targetUserId, role, approvalId, correlationId]);
    if (result.rows.length !== 1) throw new Error('No visible');
    return assignment(result.rows[0]);
  }
  async revoke(assignmentId: string, approvalId: string, correlationId: string): Promise<PlatformAssignment> {
    const result = await this.client.query('SELECT * FROM f01.revoke_platform_role($1,$2,$3)',
      [assignmentId, approvalId, correlationId]);
    if (result.rows.length !== 1) throw new Error('No visible');
    return assignment(result.rows[0]);
  }
}

export class PgPlatformAuthorizationUnitOfWork implements PlatformAuthorizationUnitOfWork {
  constructor(private readonly identity: PgIdentityUnitOfWork) {}
  runPlatform<T>(secret: string,
    work: (transaction: PlatformAuthorizationTransaction, actorUserId: string) => Promise<T>): Promise<T> {
    return this.identity.runWithClient(secret, (_identity, client, actorUserId) =>
      work(new PgPlatformAuthorizationTransaction(client), actorUserId));
  }
}
