import type { AbuseRepository, AuditWriter, AuthUnitOfWork, SessionRepository, UserRepository } from '../../application/ports.js';
import { PgSessionRepository, PgUserRepository } from '../identity-repository.js';
import { PgAbuseRepository } from '../abuse-repository.js';
import { PgAuthAuditRepository } from '../audit-repository.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(discard?: boolean): void;
}

interface SqlPool {
  connect(): Promise<SqlClient>;
}

/** A dedicated authentication login may SET ROLE f01_auth, never f01_runtime. */
export class PgAuthUnitOfWork implements AuthUnitOfWork {
  constructor(private readonly pool: SqlPool, private readonly abuseHmacKey: Buffer) {}

  async run<T>(work: (users: UserRepository, sessions: SessionRepository, abuse: AbuseRepository, audit: AuditWriter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let inTransaction = false;
    let discard = false;
    try {
      const role = await client.query(`SELECT rolsuper,rolbypassrls,
        pg_has_role(session_user,'f01_runtime','member') AS runtime_member
        FROM pg_roles WHERE rolname=session_user`);
      if (role.rows.length !== 1 || role.rows[0].rolsuper !== false ||
          role.rows[0].rolbypassrls !== false || role.rows[0].runtime_member !== false) {
        throw new Error('F01: pool de autenticación privilegiado');
      }
      await client.query('BEGIN');
      inTransaction = true;
      await client.query('SET LOCAL ROLE f01_auth');
      const result = await work(new PgUserRepository(client), new PgSessionRepository(client),
        new PgAbuseRepository(client, this.abuseHmacKey), new PgAuthAuditRepository(client));
      await client.query('COMMIT');
      inTransaction = false;
      return result;
    } catch (error) {
      if (inTransaction) {
        try { await client.query('ROLLBACK'); } catch { discard = true; }
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }
}
