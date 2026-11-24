import type { AccountTokenRepository } from '../application/ports.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Conexión de autenticación (rol f01_auth). Nunca recibe el token en claro, solo su resumen SHA-256. */
export class PgAccountTokenRepository implements AccountTokenRepository {
  constructor(private readonly client: SqlClient) {}

  async create(input: { userId: string; purpose: 'VERIFICAR_CORREO' | 'RESTABLECER_CLAVE'; tokenHash: Buffer;
    ttlSeconds: number }): Promise<void> {
    if (!uuid.test(input.userId) || input.tokenHash.length !== 32 || !Number.isInteger(input.ttlSeconds) ||
        input.ttlSeconds < 60 || input.ttlSeconds > 86_400) throw new Error('Entrada inválida');
    await this.client.query("SELECT set_config('app.auth_user_id',$1,true)", [input.userId]);
    await this.client.query(
      'INSERT INTO f01.token_cuenta(usuario_id,proposito,token_hash,expira_at) VALUES($1,$2,$3,now() + make_interval(secs => $4))',
      [input.userId, input.purpose, input.tokenHash, input.ttlSeconds]);
  }

  async completePasswordReset(tokenHash: Buffer, newPasswordHash: string): Promise<boolean> {
    if (tokenHash.length !== 32) return false;
    const result = await this.client.query('SELECT f01.complete_password_reset($1,$2) AS ok', [tokenHash, newPasswordHash]);
    return result.rows[0].ok === true;
  }

  async verifyEmail(tokenHash: Buffer): Promise<boolean> {
    if (tokenHash.length !== 32) return false;
    const result = await this.client.query('SELECT f01.verify_email($1) AS ok', [tokenHash]);
    return result.rows[0].ok === true;
  }
}
