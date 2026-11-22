import type { SqlClient } from '../../usuarios/contracts/tenant.js';
import type { ReconciledImportRow } from '../domain/importacion.js';
import type { ImportRecord } from '../application/ports.js';

function mapImport(row: Record<string, unknown>): ImportRecord {
  return { id: String(row.id), pharmacyId: String(row.farmacia_id),
    actorUserId: String(row.actor_usuario_id), state: row.estado as ImportRecord['state'],
    errorCount: Number(row.error_count), createdAt: (row.created_at as Date).toISOString(),
    expiresAt: (row.expires_at as Date).toISOString(),
    confirmedAt: row.confirmed_at ? (row.confirmed_at as Date).toISOString() : null };
}

const columns = `id,farmacia_id,actor_usuario_id,estado,error_count,created_at,expires_at,confirmed_at`;

export class PgImportRepository {
  constructor(private readonly client: SqlClient, private readonly pharmacyId: string,
    private readonly actorUserId: string) {}

  async create(digest: Buffer, rows: readonly ReconciledImportRow[]): Promise<ImportRecord> {
    const errors = rows.filter(row => row.errorCode !== null).length;
    const created = await this.client.query(`INSERT INTO f02.importacion
      (farmacia_id,actor_usuario_id,digest,expires_at,error_count)
      VALUES($1,$2,$3,now()+interval '30 minutes',$4) RETURNING ${columns}`,
    [this.pharmacyId, this.actorUserId, digest, errors]);
    if (created.rows.length !== 1) throw new Error('Vista previa no creada');
    const id = String(created.rows[0].id);
    for (const row of rows) {
      await this.client.query(`INSERT INTO f02.importacion_fila
        (importacion_id,farmacia_id,actor_usuario_id,numero_fila,medicamento_id,
         precio_centavos,cantidad_fisica,error_code)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id,this.pharmacyId,this.actorUserId,row.line,row.medicationId,
        row.priceCents,row.physicalQuantity,row.errorCode]);
    }
    return mapImport(created.rows[0]);
  }

  async find(id: string, lock = false): Promise<ImportRecord | null> {
    const result = await this.client.query(`SELECT ${columns} FROM f02.importacion
      WHERE id=$1 AND farmacia_id=$2 ${lock ? 'FOR UPDATE' : ''}`, [id, this.pharmacyId]);
    return result.rows.length === 1 ? mapImport(result.rows[0]) : null;
  }

  async rows(id: string): Promise<readonly ReconciledImportRow[]> {
    const result = await this.client.query(`SELECT numero_fila,medicamento_id,precio_centavos,cantidad_fisica,error_code
      FROM f02.importacion_fila WHERE importacion_id=$1 AND farmacia_id=$2 ORDER BY numero_fila`,
    [id, this.pharmacyId]);
    return result.rows.map(row => ({ line: Number(row.numero_fila),
      medicationId: row.medicamento_id === null ? null : String(row.medicamento_id),
      priceCents: row.precio_centavos === null ? null : Number(row.precio_centavos),
      physicalQuantity: row.cantidad_fisica === null ? null : Number(row.cantidad_fisica),
      errorCode: row.error_code === null ? null : String(row.error_code) }));
  }

  async history(): Promise<readonly ImportRecord[]> {
    const result = await this.client.query(`SELECT ${columns} FROM f02.importacion
      WHERE farmacia_id=$1 ORDER BY created_at DESC,id LIMIT 100`, [this.pharmacyId]);
    return result.rows.map(mapImport);
  }

  async transition(id: string, state: 'CONFIRMADA' | 'RECHAZADA' | 'EXPIRADA'): Promise<boolean> {
    const result = await this.client.query(`UPDATE f02.importacion
      SET estado=$3,confirmed_at=CASE WHEN $3='CONFIRMADA' THEN now() ELSE NULL END
      WHERE id=$1 AND farmacia_id=$2 AND estado='VISTA_PREVIA' RETURNING id`,
    [id,this.pharmacyId,state]);
    return result.rows.length === 1;
  }
}
