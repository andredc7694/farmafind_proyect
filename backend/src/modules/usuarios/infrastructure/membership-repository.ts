import type { MembershipReader, PharmacyReferenceReader } from '../application/ports.js';
import type { Delegation, Membership, PharmacyReference } from '../domain/identity.js';

interface SqlReader {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

function membership(row: Record<string, unknown>): Membership {
  return {
    id: String(row.id), userId: String(row.usuario_id), pharmacyId: String(row.farmacia_id),
    roleCode: String(row.rol), state: row.estado as Membership['state'],
    createdAt: row.created_at as Date, updatedAt: row.updated_at as Date,
    changedByUserId: row.changed_by_usuario_id === null ? null : String(row.changed_by_usuario_id),
  };
}

/** Uses only the verified actor's transaction and the database's own-row RLS. */
export class PgMembershipRepository implements MembershipReader, PharmacyReferenceReader {
  constructor(private readonly client: SqlReader, private readonly actorUserId: string) {}

  async listOwn(userId: string): Promise<readonly Membership[]> {
    if (userId !== this.actorUserId) throw new Error('No autorizado');
    const result = await this.client.query(`
      SELECT id, usuario_id, farmacia_id, rol, estado, created_at, updated_at, changed_by_usuario_id
      FROM f01.usuario_farmacia WHERE usuario_id=$1 ORDER BY farmacia_id
    `, [userId]);
    return result.rows.map(membership);
  }

  async getOwn(userId: string, pharmacyId: string): Promise<Membership | null> {
    if (userId !== this.actorUserId) throw new Error('No autorizado');
    const result = await this.client.query(`
      SELECT id, usuario_id, farmacia_id, rol, estado, created_at, updated_at, changed_by_usuario_id
      FROM f01.usuario_farmacia WHERE usuario_id=$1 AND farmacia_id=$2
    `, [userId, pharmacyId]);
    return result.rows.length === 1 ? membership(result.rows[0]) : null;
  }

  async getActiveOwn(userId: string, pharmacyId: string): Promise<Membership | null> {
    if (userId !== this.actorUserId) throw new Error('No autorizado');
    const result = await this.client.query(`
      SELECT m.id, m.usuario_id, m.farmacia_id, m.rol, m.estado,
             m.created_at, m.updated_at, m.changed_by_usuario_id
      FROM f01.usuario_farmacia AS m
      JOIN f01.farmacia_referencia AS f ON f.id=m.farmacia_id
      WHERE m.usuario_id=$1 AND m.farmacia_id=$2
        AND m.estado='ACTIVA' AND f.estado='ACTIVA'
    `, [userId, pharmacyId]);
    return result.rows.length === 1 ? membership(result.rows[0]) : null;
  }

  async listOwnDelegations(membershipId: string): Promise<readonly Delegation[]> {
    const result = await this.client.query(`
      SELECT d.id, d.membresia_id, d.farmacia_id, d.capacidad, d.estado,
             d.granted_by_usuario_id, d.granted_at, d.revoked_at
      FROM f01.delegacion AS d
      JOIN f01.usuario_farmacia AS m ON m.id=d.membresia_id
      WHERE d.membresia_id=$1 AND m.usuario_id=$2 AND d.estado='ACTIVA'
      ORDER BY d.capacidad
    `, [membershipId, this.actorUserId]);
    return result.rows.map(row => ({
      id: String(row.id), membershipId: String(row.membresia_id), pharmacyId: String(row.farmacia_id),
      capabilityCode: String(row.capacidad), state: row.estado as Delegation['state'],
      grantedByUserId: String(row.granted_by_usuario_id), grantedAt: row.granted_at as Date,
      revokedAt: row.revoked_at as Date | null,
    }));
  }

  async findById(id: string): Promise<PharmacyReference | null> {
    const result = await this.client.query('SELECT id, estado, nombre_publico FROM f01.farmacia_referencia WHERE id=$1', [id]);
    if (result.rows.length !== 1) return null;
    const row = result.rows[0];
    return { id: String(row.id), state: row.estado as PharmacyReference['state'], publicName: String(row.nombre_publico) };
  }
}
