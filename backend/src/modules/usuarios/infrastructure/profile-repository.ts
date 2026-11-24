import type { OwnProfile, OwnSession, ProfileRepository } from '../application/ports.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/**
 * Conexión de autenticación (rol f01_auth). La sesión del contexto (`app.auth_fingerprint`, fijada al buscarla)
 * es la única fuente del usuario: ninguna función recibe un identificador de usuario.
 */
export class PgProfileRepository implements ProfileRepository {
  constructor(private readonly client: SqlClient) {}

  async get(): Promise<OwnProfile> {
    const result = await this.client.query('SELECT * FROM f01.get_own_profile()');
    const row = result.rows[0];
    if (!row) throw new Error('No autorizado');
    return { userId: String(row.usuario_id), displayName: (row.nombre as string | null) ?? null,
      phone: (row.telefono as string | null) ?? null, avatarPreset: row.avatar_preset === null ? null : Number(row.avatar_preset),
      theme: row.tema as OwnProfile['theme'], notifyReservations: row.notif_reservas === true,
      notifySecurity: row.notif_seguridad === true, email: (row.email as string | null) ?? null,
      emailVerified: row.email_verificado === true };
  }

  async update(patch: Readonly<Record<string, unknown>>): Promise<void> {
    await this.client.query('SELECT f01.update_own_profile($1::jsonb)', [JSON.stringify(patch)]);
  }

  async listSessions(): Promise<readonly OwnSession[]> {
    const result = await this.client.query('SELECT * FROM f01.list_own_sessions()');
    return result.rows.map(row => ({ id: String(row.id), createdAt: new Date(String(row.created_at)),
      lastUsedAt: new Date(String(row.last_used_at)), current: row.is_current === true }));
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      await this.client.query('SAVEPOINT own_session_revoke');
      await this.client.query('SELECT f01.revoke_own_session($1)', [sessionId]);
      await this.client.query('RELEASE SAVEPOINT own_session_revoke');
      return true;
    } catch (error) {
      if ((error as { code?: string }).code !== 'F0404') throw error;
      await this.client.query('ROLLBACK TO SAVEPOINT own_session_revoke');
      return false;
    }
  }

  async revokeOthers(): Promise<number> {
    const result = await this.client.query('SELECT f01.revoke_other_sessions() AS closed');
    return Number(result.rows[0].closed);
  }

  async changePassword(newHash: string): Promise<void> {
    await this.client.query('SELECT f01.change_own_password($1)', [newHash]);
  }
}
