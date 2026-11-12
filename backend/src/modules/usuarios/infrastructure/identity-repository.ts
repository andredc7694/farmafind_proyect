import type { Session, User } from '../domain/identity.js';
import { DuplicateIdentityError } from '../application/ports.js';
import type { SessionRepository, UserRepository } from '../application/ports.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id), canonicalEmail: String(row.email_canonico),
    passwordHash: String(row.password_hash), state: row.estado as User['state'],
    createdAt: row.created_at as Date, updatedAt: row.updated_at as Date,
  };
}

function fingerprintBuffer(fingerprint: string): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(fingerprint)) throw new Error('Huella de sesión inválida');
  return Buffer.from(fingerprint, 'hex');
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: String(row.id), userId: String(row.usuario_id),
    tokenFingerprint: (row.token_fingerprint as Buffer).toString('hex'),
    state: row.estado as Session['state'], createdAt: row.created_at as Date,
    lastUsedAt: row.last_used_at as Date, idleExpiresAt: row.idle_expires_at as Date,
    absoluteExpiresAt: row.absolute_expires_at as Date, revokedAt: row.revoked_at as Date | null,
  };
}

/** Caller supplies a scoped authentication connection, never the business RLS role. */
export class PgUserRepository implements UserRepository {
  constructor(private readonly client: SqlClient) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.client.query(`
      SELECT id,email_canonico,password_hash,estado,created_at,updated_at
      FROM f01.usuario WHERE id=$1
    `, [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findByCanonicalEmail(email: string): Promise<User | null> {
    const result = await this.client.query(`
      SELECT id,email_canonico,password_hash,estado,created_at,updated_at
      FROM f01.usuario WHERE email_canonico=$1
    `, [email]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async createCustomer(input: { canonicalEmail: string; passwordHash: string }): Promise<User> {
    const result = await this.client.query(`INSERT INTO f01.usuario(email_canonico,password_hash)
      VALUES($1,$2) ON CONFLICT (email_canonico) DO NOTHING
      RETURNING id,email_canonico,password_hash,estado,created_at,updated_at`,
    [input.canonicalEmail, input.passwordHash]);
    if (!result.rows[0]) throw new DuplicateIdentityError();
    return mapUser(result.rows[0]);
  }
}

/** The raw opaque secret never crosses this repository boundary. */
export class PgSessionRepository implements SessionRepository {
  constructor(private readonly client: SqlClient) {}

  async findByFingerprint(fingerprint: string): Promise<Session | null> {
    await this.client.query("SELECT set_config('app.auth_fingerprint',$1,true)", [fingerprintBuffer(fingerprint).toString('hex')]);
    const result = await this.client.query(`
      SELECT id,usuario_id,token_fingerprint,estado,created_at,last_used_at,
             idle_expires_at,absolute_expires_at,revoked_at
      FROM f01.sesion WHERE token_fingerprint=$1
    `, [fingerprintBuffer(fingerprint)]);
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async save(session: Session): Promise<void> {
    await this.client.query("SELECT set_config('app.auth_user_id',$1,true)", [session.userId]);
    await this.client.query(`
      INSERT INTO f01.sesion(id,usuario_id,token_fingerprint,estado,created_at,last_used_at,
        idle_expires_at,absolute_expires_at,revoked_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [session.id, session.userId, fingerprintBuffer(session.tokenFingerprint), session.state,
      session.createdAt, session.lastUsedAt, session.idleExpiresAt, session.absoluteExpiresAt, session.revokedAt]);
  }

  async revoke(fingerprint: string, at: Date): Promise<void> {
    const bytes = fingerprintBuffer(fingerprint);
    await this.client.query("SELECT set_config('app.auth_fingerprint',$1,true)", [fingerprint]);
    await this.client.query(`UPDATE f01.sesion SET estado='REVOCADA',revoked_at=$2
      WHERE token_fingerprint=$1 AND estado='VIGENTE'`, [bytes, at]);
  }

  async touch(fingerprint: string, at: Date, idleExpiresAt: Date): Promise<void> {
    const bytes = fingerprintBuffer(fingerprint);
    await this.client.query("SELECT set_config('app.auth_fingerprint',$1,true)", [fingerprint]);
    await this.client.query(`UPDATE f01.sesion
      SET last_used_at=$2,idle_expires_at=LEAST(absolute_expires_at,$3)
      WHERE token_fingerprint=$1 AND estado='VIGENTE'`, [bytes, at, idleExpiresAt]);
  }
}
