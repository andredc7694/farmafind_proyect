import type { AdminMembershipTransaction, AdminMembershipUnitOfWork, IdentityTransaction, IdentityUnitOfWork,
  WorkerMembershipRow } from '../../application/ports.js';
import type { Delegation, Membership, PharmacyReference } from '../../domain/identity.js';
import { createHash } from 'node:crypto';
import { PgMembershipRepository } from '../membership-repository.js';

interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(discard?: boolean): void;
}

interface SqlPool {
  connect(): Promise<SqlClient>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validId(value: string): boolean {
  return uuidPattern.test(value);
}

/** Actor identity is obtained from a live opaque session in the same transaction. */
function workerRow(row: Record<string, unknown>): WorkerMembershipRow {
  return { id: String(row.id), userId: String(row.usuario_id), pharmacyId: String(row.farmacia_id),
    role: 'TRABAJADOR', status: row.estado as WorkerMembershipRow['status'] };
}

class PgIdentityTransaction implements AdminMembershipTransaction {
  private readonly memberships: PgMembershipRepository;

  constructor(private readonly client: SqlClient, private readonly actorUserId: string) {
    this.memberships = new PgMembershipRepository(client, actorUserId);
  }

  async listOwnMemberships(actorUserId: string): Promise<readonly Membership[]> {
    return this.memberships.listOwn(actorUserId);
  }

  async findPharmacyReference(pharmacyId: string): Promise<PharmacyReference | null> {
    return this.memberships.findById(pharmacyId);
  }

  async listOwnDelegations(membershipId: string): Promise<readonly Delegation[]> {
    return this.memberships.listOwnDelegations(membershipId);
  }

  async useAuthorizedPharmacy(actorUserId: string, pharmacyId: string): Promise<Membership> {
    if (actorUserId !== this.actorUserId || !validId(pharmacyId)) throw new Error('No autorizado');
    const membership = await this.memberships.getActiveOwn(actorUserId, pharmacyId);
    if (!membership) throw new Error('No autorizado');
    await this.client.query("SELECT set_config('app.farmacia_id',$1,true)", [pharmacyId]);
    return membership;
  }

  async context(): Promise<{ actorUserId: string | null; pharmacyId: string | null; role: string }> {
    const result = await this.client.query(`
      SELECT NULLIF(current_setting('app.actor_user_id',true),'') AS actor,
             NULLIF(current_setting('app.farmacia_id',true),'') AS pharmacy,
             current_user AS role
    `);
    const row = result.rows[0];
    return { actorUserId: row.actor as string | null, pharmacyId: row.pharmacy as string | null, role: String(row.role) };
  }

  async listWorkers(pharmacyId: string): Promise<readonly WorkerMembershipRow[]> {
    const result = await this.client.query(`SELECT id,usuario_id,farmacia_id,estado
      FROM f01.usuario_farmacia WHERE farmacia_id=$1 AND rol='TRABAJADOR' ORDER BY id`, [pharmacyId]);
    return result.rows.map(workerRow);
  }

  async findWorker(pharmacyId: string, membershipId: string): Promise<WorkerMembershipRow | null> {
    const result = await this.client.query(`SELECT id,usuario_id,farmacia_id,estado
      FROM f01.usuario_farmacia WHERE id=$1 AND farmacia_id=$2 AND rol='TRABAJADOR'`, [membershipId, pharmacyId]);
    return result.rows.length === 1 ? workerRow(result.rows[0]) : null;
  }

  async grantWorker(pharmacyId: string, targetUserId: string): Promise<WorkerMembershipRow> {
    const result = await this.client.query(`INSERT INTO f01.usuario_farmacia
      (usuario_id,farmacia_id,rol,estado,changed_by_usuario_id)
      VALUES($1,$2,'TRABAJADOR','ACTIVA',$3)
      RETURNING id,usuario_id,farmacia_id,estado`, [targetUserId, pharmacyId, this.actorUserId]);
    if (result.rows.length !== 1) throw new Error('No visible');
    return workerRow(result.rows[0]);
  }

  async revokeWorker(pharmacyId: string, membershipId: string): Promise<WorkerMembershipRow | null> {
    const result = await this.client.query(`UPDATE f01.usuario_farmacia
      SET estado='REVOCADA',changed_by_usuario_id=$3,updated_at=now()
      WHERE id=$1 AND farmacia_id=$2 AND rol='TRABAJADOR' AND estado='ACTIVA'
      RETURNING id,usuario_id,farmacia_id,estado`, [membershipId, pharmacyId, this.actorUserId]);
    return result.rows.length === 1 ? workerRow(result.rows[0]) : null;
  }

  async recordWorkerChange(pharmacyId: string, action: 'MEMBERSHIP_GRANT' | 'MEMBERSHIP_REVOKE',
    correlationId: string): Promise<void> {
    await this.client.query(`INSERT INTO f01.auditoria_acceso
      (actor_usuario_id,farmacia_id,accion,recurso_tipo,resultado,occurred_at,correlation_id)
      VALUES($1,$2,$3,'MEMBERSHIP','PERMITIDO',now(),$4)`,
    [this.actorUserId, pharmacyId, action, correlationId]);
  }
}

/** One pool client per operation; role and GUCs are transaction-local and released in finally. */
export class PgIdentityUnitOfWork implements IdentityUnitOfWork, AdminMembershipUnitOfWork {
  constructor(private readonly pool: SqlPool) {}

  async run<T>(sessionSecret: string, work: (transaction: IdentityTransaction, actorUserId: string) => Promise<T>): Promise<T> {
    if (!/^[a-f0-9]{64}$/i.test(sessionSecret)) throw new Error('No autorizado');
    const fingerprint = createHash('sha256').update(Buffer.from(sessionSecret, 'hex')).digest();
    const fingerprintHex = fingerprint.toString('hex');
    const client = await this.pool.connect();
    let inTransaction = false;
    let discard = false;
    try {
      const role = await client.query(`
        SELECT rolsuper, rolbypassrls,
               pg_has_role(session_user,'f01_auth','member') AS auth_member
        FROM pg_roles WHERE rolname=session_user
      `);
      if (role.rows.length !== 1 || role.rows[0].rolsuper !== false ||
          role.rows[0].rolbypassrls !== false || role.rows[0].auth_member !== false) {
        throw new Error('F01: pool con rol privilegiado');
      }
      await client.query('BEGIN');
      inTransaction = true;
      await client.query('SET LOCAL ROLE f01_runtime');
      await client.query("SELECT set_config('app.session_fingerprint',$1,true)", [fingerprintHex]);
      const active = await client.query(`
        SELECT u.id FROM f01.sesion AS s JOIN f01.usuario AS u ON u.id=s.usuario_id
        WHERE s.token_fingerprint=$1 AND s.estado='VIGENTE'
          AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
          AND u.estado='ACTIVO'
      `, [fingerprint]);
      if (active.rows.length !== 1 || !validId(String(active.rows[0].id))) throw new Error('No autorizado');
      const actorUserId = String(active.rows[0].id);
      await client.query("SELECT set_config('app.actor_user_id',$1,true)", [actorUserId]);
      const result = await work(new PgIdentityTransaction(client, actorUserId), actorUserId);
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

  runAdmin<T>(sessionSecret: string,
    work: (transaction: AdminMembershipTransaction, actorUserId: string) => Promise<T>): Promise<T> {
    return this.run(sessionSecret, (transaction, actorUserId) =>
      work(transaction as AdminMembershipTransaction, actorUserId));
  }
}
