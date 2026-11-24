import type { TemporaryCredentialRepository, TemporaryCredentialRow } from '../application/ports.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Conexión de autenticación (rol f01_auth); el contexto de usuario se fija antes de cada acceso (RLS). */
export class PgTemporaryCredentialRepository implements TemporaryCredentialRepository {
  constructor(private readonly client: SqlClient) {}

  private async scope(userId: string): Promise<void> {
    if (!uuid.test(userId)) throw new Error('Entrada inválida');
    await this.client.query("SELECT set_config('app.auth_user_id',$1,true)", [userId]);
  }

  async find(userId: string): Promise<TemporaryCredentialRow | null> {
    await this.scope(userId);
    const result = await this.client.query(
      'SELECT usuario_id,clave_hash,expira_at,consumida_at FROM f01.credencial_temporal WHERE usuario_id=$1', [userId]);
    const row = result.rows[0];
    return row ? { userId: String(row.usuario_id), hash: String(row.clave_hash), expiresAt: row.expira_at as Date,
      consumedAt: (row.consumida_at as Date | null) ?? null } : null;
  }

  async consume(userId: string, at: Date): Promise<boolean> {
    await this.scope(userId);
    const result = await this.client.query(
      'UPDATE f01.credencial_temporal SET consumida_at=$2 WHERE usuario_id=$1 AND consumida_at IS NULL RETURNING usuario_id',
      [userId, at]);
    return result.rows.length === 1;
  }

  async completePasswordChange(newPasswordHash: string): Promise<void> {
    await this.client.query('SELECT f01.complete_password_change($1)', [newPasswordHash]);
  }
}
