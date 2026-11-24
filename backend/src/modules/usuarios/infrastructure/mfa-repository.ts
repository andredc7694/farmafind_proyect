import type { MfaRepository } from '../application/ports.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Conexión de autenticación (rol f01_auth). Las transiciones sensibles pasan por funciones con autorización explícita (015). */
export class PgMfaRepository implements MfaRepository {
  constructor(private readonly client: SqlClient) {}

  private async scope(userId: string): Promise<void> {
    if (!uuid.test(userId)) throw new Error('Entrada inválida');
    await this.client.query("SELECT set_config('app.auth_user_id',$1,true)", [userId]);
  }

  async requirement(userId: string): Promise<'NONE' | 'ENROLL' | 'VERIFY'> {
    await this.scope(userId);
    const result = await this.client.query('SELECT f01.mfa_requirement() AS requirement');
    const value = result.rows[0]?.requirement;
    if (value !== 'NONE' && value !== 'ENROLL' && value !== 'VERIFY') throw new Error('Respuesta inesperada');
    return value;
  }

  async beginEnrollment(sealed: { ciphertext: Buffer; nonce: Buffer }): Promise<'OK' | 'FORBIDDEN' | 'CONFLICT'> {
    const result = await this.client.query('SELECT f01.begin_mfa_enrollment($1,$2) AS outcome', [sealed.ciphertext, sealed.nonce]);
    const value = result.rows[0]?.outcome;
    if (value !== 'OK' && value !== 'FORBIDDEN' && value !== 'CONFLICT') throw new Error('Respuesta inesperada');
    return value;
  }

  async load(userId: string) {
    await this.scope(userId);
    const result = await this.client.query(
      'SELECT estado,secreto_cifrado,nonce,ultimo_paso_usado FROM f01.mfa_totp WHERE usuario_id=$1', [userId]);
    const row = result.rows[0];
    if (!row) return null;
    return { state: row.estado as 'PENDIENTE' | 'ACTIVO' | 'REINICIADO', ciphertext: row.secreto_cifrado as Buffer,
      nonce: row.nonce as Buffer, lastStep: row.ultimo_paso_usado === null ? null : Number(row.ultimo_paso_usado) };
  }

  async complete(mode: 'ACTIVATE' | 'VERIFY', step: number): Promise<'OK' | 'REUSED' | 'INVALID_STATE'> {
    const result = await this.client.query('SELECT f01.complete_mfa($1,$2) AS outcome', [mode, step]);
    const value = result.rows[0]?.outcome;
    if (value !== 'OK' && value !== 'REUSED' && value !== 'INVALID_STATE') throw new Error('Respuesta inesperada');
    return value;
  }
}
